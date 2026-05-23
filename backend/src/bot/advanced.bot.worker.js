// Increase max listeners
require('events').EventEmitter.defaultMaxListeners = 200;

const { parentPort, workerData } = require('worker_threads');

if (!workerData) {
    console.error('Worker started without workerData');
    if (parentPort) parentPort.postMessage({ error: 'No worker data provided', metrics: null });
    process.exit(1);
}

const { targetUrl, botCount, durationSeconds, workerId, strategy, strategyConfig } = workerData;

// Request tracking
const pendingRequests = new Map();
const REQUEST_TIMEOUT = 5000;
let requestIdCounter = 0;
let isTestRunning = true;

class TradingBot {
    constructor(botId, metrics) {
        this.botId = botId;
        this.metrics = metrics;
        this.ws = null;
        this.interval = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.isReconnecting = false;
        this.listenersAttached = false;
    }

    generateRequestId() {
        return `${Date.now()}-${workerId}-${++requestIdCounter}-${Math.random().toString(36).substring(2, 6)}`;
    }

    generateOrder() {
        switch(strategy) {
            case 'market_maker':
                return this.generateMarketMakerOrder();
            case 'arbitrage':
                return this.generateArbitrageOrder();
            case 'random_walk':
                return this.generateRandomWalkOrder();
            default:
                return this.generateDefaultOrder();
        }
    }

    generateMarketMakerOrder() {
        const spread = strategyConfig?.spread || 0.01;
        const isBuy = Math.random() > 0.5;
        const basePrice = 100;
        const price = isBuy ? basePrice * (1 - spread) : basePrice * (1 + spread);
        return {
            type: isBuy ? 'BUY' : 'SELL',
            price: Math.round(price * 100) / 100,
            quantity: Math.floor(Math.random() * 5) + 1,
            strategy: 'market_maker',
            timestamp: Date.now()
        };
    }

    generateArbitrageOrder() {
        const isArbitrage = Math.random() > 0.7;
        if (isArbitrage) {
            return {
                type: Math.random() > 0.5 ? 'BUY' : 'SELL',
                price: Math.round((100 * (1 + (Math.random() - 0.5) * 0.05)) * 100) / 100,
                quantity: Math.floor(Math.random() * 3) + 1,
                strategy: 'arbitrage',
                isArbitrage: true,
                timestamp: Date.now()
            };
        }
        return this.generateDefaultOrder();
    }

    generateRandomWalkOrder() {
        const volatility = strategyConfig?.volatility || 0.02;
        const change = (Math.random() - 0.5) * volatility;
        const isBuy = change > 0 ? Math.random() > 0.3 : Math.random() > 0.7;
        return {
            type: isBuy ? 'BUY' : 'SELL',
            price: Math.round((100 * (1 + change)) * 100) / 100,
            quantity: Math.floor(Math.random() * 10) + 1,
            strategy: 'random_walk',
            timestamp: Date.now()
        };
    }

    generateDefaultOrder() {
        return {
            type: Math.random() > 0.5 ? 'BUY' : 'SELL',
            price: Math.floor(Math.random() * 100) + 50,
            quantity: Math.floor(Math.random() * 10) + 1,
            strategy: strategy || 'default',
            timestamp: Date.now()
        };
    }

    sendOrder() {
        if (!this.isConnected || !isTestRunning) return;

        const requestId = this.generateRequestId();
        const order = this.generateOrder();
        const startTime = Date.now();

        pendingRequests.set(requestId, { startTime, order, botId: this.botId });

        const timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
                pendingRequests.delete(requestId);
                this.metrics.timeouts++;
                this.metrics.errors++;
                this.metrics.requestStats.timedOut++;
            }
        }, REQUEST_TIMEOUT);

        const message = JSON.stringify({ ...order, requestId });
        
        if (this.ws && this.ws.readyState === 1) {
            this.ws.send(message, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    pendingRequests.delete(requestId);
                    this.metrics.errors++;
                    this.metrics.requestStats.failed++;
                }
            });
        }

        // Store timeout for cleanup
        pendingRequests.get(requestId).timeout = timeout;
    }

    cleanupListeners() {
        if (!this.ws) return;
        
        // Remove all listeners to prevent memory leak
        this.ws.removeAllListeners('open');
        this.ws.removeAllListeners('message');
        this.ws.removeAllListeners('close');
        this.ws.removeAllListeners('error');
        this.listenersAttached = false;
    }

    connect() {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        const WebSocket = require('ws');
        
        try {
            this.ws = new WebSocket(targetUrl, {
                handshakeTimeout: 5000,
                timeout: 10000
            });

            // Set max listeners on this specific WebSocket
            this.ws.setMaxListeners(10);

            // Use bound methods to ensure proper cleanup
            this.handleOpen = this.handleOpen.bind(this);
            this.handleMessage = this.handleMessage.bind(this);
            this.handleClose = this.handleClose.bind(this);
            this.handleError = this.handleError.bind(this);

            this.ws.on('open', this.handleOpen);
            this.ws.on('message', this.handleMessage);
            this.ws.on('close', this.handleClose);
            this.ws.on('error', this.handleError);
            
            this.listenersAttached = true;
        } catch (err) {
            this.handleReconnect();
        }
    }

    handleOpen() {
        this.isConnected = true;
        this.isReconnecting = false;
        this.reconnectAttempts = 0;
        
        // Start sending orders
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.sendOrder(), Math.random() * 100 + 50);
    }

    handleMessage(data) {
        try {
            const response = JSON.parse(data.toString());
            
            if (response.requestId && pendingRequests.has(response.requestId)) {
                const pending = pendingRequests.get(response.requestId);
                const latency = Date.now() - pending.startTime;
                
                this.metrics.totalLatency += latency;
                this.metrics.latencies.push(latency);
                this.metrics.totalOrders++;
                this.metrics.requestStats.received++;
                
                if (pending.timeout) clearTimeout(pending.timeout);
                pendingRequests.delete(response.requestId);
            }
        } catch (err) {
            // Ignore parse errors
        }
    }

    handleClose() {
        this.isConnected = false;
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.handleReconnect();
    }

    handleError(err) {
        this.metrics.errors++;
        this.metrics.requestStats.failed++;
        // Don't reconnect on error, let close handler handle it
    }

    handleReconnect() {
        if (!isTestRunning) return;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                this.isReconnecting = false;
                this.connect();
            }, 1000 * this.reconnectAttempts);
        }
    }

    stop() {
        isTestRunning = false;
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        this.cleanupListeners();
        
        if (this.ws && this.ws.readyState === 1) {
            this.ws.close();
        }
        
        this.ws = null;
        this.isConnected = false;
    }
}

class AdvancedBotWorker {
    constructor() {
        this.metrics = {
            totalOrders: 0,
            totalLatency: 0,
            errors: 0,
            timeouts: 0,
            latencies: [],
            strategy: strategy,
            durationSeconds: durationSeconds,
            requestStats: { sent: 0, received: 0, timedOut: 0, failed: 0 }
        };
        this.bots = [];
    }

    async run() {
        console.log(`🚀 Worker ${workerId} starting ${botCount} bots with strategy: ${strategy}`);
        
        // Create bots with staggered connection to avoid connection storms
        for (let i = 0; i < botCount; i++) {
            const bot = new TradingBot(i, this.metrics);
            this.bots.push(bot);
            bot.connect();
            
            // Stagger connections
            if (i % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Wait for test duration
        await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));
        
        // Stop all bots
        this.stopAllBots();
        
        // Clean up pending requests
        const now = Date.now();
        for (const [id, pending] of pendingRequests) {
            if (pending.timeout) clearTimeout(pending.timeout);
            if (now - pending.startTime > REQUEST_TIMEOUT) {
                pendingRequests.delete(id);
                this.metrics.timeouts++;
            }
        }
        
        // Calculate metrics
        const sortedLatencies = [...this.metrics.latencies].sort((a, b) => a - b);
        
        return {
            totalOrders: this.metrics.totalOrders,
            errors: this.metrics.errors,
            timeouts: this.metrics.timeouts,
            latencies: this.metrics.latencies,
            p50: this.percentile(sortedLatencies, 50),
            p90: this.percentile(sortedLatencies, 90),
            p99: this.percentile(sortedLatencies, 99),
            strategy: this.metrics.strategy,
            requestStats: this.metrics.requestStats,
            durationSeconds: durationSeconds
        };
    }

    stopAllBots() {
        for (const bot of this.bots) {
            bot.stop();
        }
        this.bots = [];
    }

    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
}

// Run worker
const worker = new AdvancedBotWorker();
worker.run().then(metrics => {
    if (parentPort) parentPort.postMessage({ metrics, workerId });
}).catch(error => {
    console.error(`Worker ${workerId} error:`, error);
    if (parentPort) parentPort.postMessage({ error: error.message, metrics: null, workerId });
});

// Cleanup on exit
process.on('exit', () => {
    for (const [id, pending] of pendingRequests) {
        if (pending.timeout) clearTimeout(pending.timeout);
    }
    pendingRequests.clear();
});