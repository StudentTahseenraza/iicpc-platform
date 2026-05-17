
// Increase max listeners dramatically
require('events').EventEmitter.defaultMaxListeners = 200;

// Also increase for the specific WebSocket instances
process.setMaxListeners(200);

const { parentPort, workerData } = require('worker_threads');



// Handle case when workerData is null or undefined
if (!workerData) {
    console.error('Worker started without workerData');
    if (parentPort) {
        parentPort.postMessage({ error: 'No worker data provided', metrics: null });
    }
    process.exit(1);
}

const { targetUrl, botCount, durationSeconds, workerId, strategy, strategyConfig } = workerData;

// Request tracking
const pendingRequests = new Map();
const REQUEST_TIMEOUT = 5000; // 5 seconds timeout
let requestIdCounter = 0;

class AdvancedBotWorker {
    constructor() {
        this.metrics = {
            totalOrders: 0,
            totalLatency: 0,
            errors: 0,
            timeouts: 0,
            latencies: [],
            strategy: strategy || 'default',
            durationSeconds: durationSeconds,
            requestStats: {
                sent: 0,
                received: 0,
                timedOut: 0,
                failed: 0
            }
        };

        this.bots = [];
        this.activeBots = 0;
        this.isRunning = true;
    }

    generateRequestId() {
        return `${Date.now()}-${workerId}-${++requestIdCounter}-${Math.random().toString(36).substring(2, 6)}`;
    }

    generateOrder() {
        // Strategy-based order generation
        switch (strategy) {
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

    createBot(botId) {
        let ws = null;
        let interval = null;
        let isConnected = false;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;

        const connect = () => {
            if (!this.isRunning) return;

            const WebSocket = require('ws');
            ws = new WebSocket(targetUrl, {
                handshakeTimeout: 5000,
                timeout: 10000
            });

            ws.setMaxListeners(100);

            ws.on('open', () => {
                isConnected = true;
                reconnectAttempts = 0;
                this.activeBots++;

                ws.setMaxListeners(50);

                // Add heartbeat to keep connection alive
                let heartbeatInterval = setInterval(() => {
                    if (ws && ws.readyState === 1) {
                        ws.ping();
                    }
                }, 30000);

                ws.on('pong', () => {
                    // Heartbeat received
                });

                // Store interval for cleanup
                ws.heartbeatInterval = heartbeatInterval;

                // Send order every 50-150ms
                interval = setInterval(() => {
                    if (!isConnected || !this.isRunning) return;

                    const requestId = this.generateRequestId();
                    const order = this.generateOrder();
                    const startTime = Date.now();

                    // Track pending request
                    pendingRequests.set(requestId, {
                        startTime,
                        order,
                        botId,
                        sentAt: startTime
                    });

                    this.metrics.requestStats.sent++;

                    // Set timeout for this request
                    const timeout = setTimeout(() => {
                        const pending = pendingRequests.get(requestId);
                        if (pending) {
                            pendingRequests.delete(requestId);
                            this.metrics.timeouts++;
                            this.metrics.errors++;
                            this.metrics.requestStats.timedOut++;
                        }
                    }, REQUEST_TIMEOUT);

                    // Send order with requestId
                    const message = JSON.stringify({ ...order, requestId });
                    ws.send(message, (err) => {
                        if (err) {
                            clearTimeout(timeout);
                            pendingRequests.delete(requestId);
                            this.metrics.errors++;
                            this.metrics.requestStats.failed++;
                        }
                    });

                    // One-time response handler
                    const messageHandler = (data) => {
                        try {
                            const response = JSON.parse(data.toString());
                            if (response.requestId === requestId) {
                                clearTimeout(timeout);
                                const latency = Date.now() - startTime;

                                this.metrics.totalLatency += latency;
                                this.metrics.latencies.push(latency);
                                this.metrics.totalOrders++;
                                this.metrics.requestStats.received++;

                                pendingRequests.delete(requestId);
                                ws.removeListener('message', messageHandler);
                            }
                        } catch (err) {
                            // Ignore parse errors
                        }
                    };

                    ws.once('message', messageHandler);
                }, Math.random() * 100 + 50);
            });

            ws.on('error', (err) => {
                this.metrics.errors++;
                this.metrics.requestStats.failed++;
            });

            ws.on('close', () => {
                isConnected = false;
                this.activeBots--;

                // Clear heartbeat interval
                if (ws.heartbeatInterval) {
                    clearInterval(ws.heartbeatInterval);
                }

                if (reconnectAttempts < maxReconnectAttempts && this.isRunning) {
                    reconnectAttempts++;
                    setTimeout(connect, 1000 * reconnectAttempts);
                }
            });
        };

        connect();

        return {
            stop: () => {
                if (interval) clearInterval(interval);
                if (ws) {
                    ws.removeAllListeners();
                    ws.close();
                }
            }
        };
    }

    async run() {
        console.log(`🚀 Worker ${workerId} starting ${botCount} bots with strategy: ${strategy}`);

        // Spawn bots
        for (let i = 0; i < botCount; i++) {
            this.bots.push(this.createBot(i));

            // Stagger bot creation to avoid connection storms
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // Run for duration
        await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));

        // Stop all bots
        this.isRunning = false;
        this.bots.forEach(bot => bot.stop());

        // Clean up pending requests
        const now = Date.now();
        for (const [id, pending] of pendingRequests) {
            if (now - pending.startTime > REQUEST_TIMEOUT) {
                pendingRequests.delete(id);
                this.metrics.timeouts++;
            }
        }

        // Calculate metrics for this worker
        const sortedLatencies = [...this.metrics.latencies].sort((a, b) => a - b);
        const p50 = this.percentile(sortedLatencies, 50);
        const p90 = this.percentile(sortedLatencies, 90);
        const p99 = this.percentile(sortedLatencies, 99);

        const result = {
            totalOrders: this.metrics.totalOrders,
            errors: this.metrics.errors,
            timeouts: this.metrics.timeouts,
            latencies: this.metrics.latencies,
            p50, p90, p99,
            strategy: this.metrics.strategy,
            requestStats: this.metrics.requestStats,
            activeBots: this.activeBots,
            durationSeconds: durationSeconds
        };

        console.log(`✅ Worker ${workerId} completed: ${result.totalOrders} orders, ${result.errors} errors`);

        return result;
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
    if (parentPort) {
        parentPort.postMessage({ metrics, workerId });
    }
}).catch(error => {
    console.error(`Worker ${workerId} error:`, error);
    if (parentPort) {
        parentPort.postMessage({ error: error.message, metrics: null, workerId });
    }
});

// Periodic cleanup of stale requests
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, pending] of pendingRequests) {
        if (now - pending.startTime > REQUEST_TIMEOUT) {
            pendingRequests.delete(id);
            cleaned++;
        }
    }
    if (cleaned > 0 && parentPort) {
        parentPort.postMessage({ type: 'cleanup', count: cleaned, workerId });
    }
}, 5000);

// Cleanup interval on exit
process.on('exit', () => {
    clearInterval(cleanupInterval);
});