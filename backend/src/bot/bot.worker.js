const { parentPort, workerData } = require('worker_threads');
require('events').EventEmitter.defaultMaxListeners = 100;

const { targetUrl, botCount, durationSeconds, workerId } = workerData;

class BotWorker {
    async run() {
        const metrics = {
            totalOrders: 0,
            totalLatency: 0,
            errors: 0,
            latencies: []
        };

        const bots = [];
        const endTime = Date.now() + (durationSeconds * 1000);

        // Spawn bots
        for (let i = 0; i < botCount; i++) {
            bots.push(this.createBot(targetUrl, i, metrics));
        }

        // Wait for duration
        await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));

        // Stop all bots
        bots.forEach(bot => bot.stop());

        return metrics;
    }

    createBot(url, botId, metrics) {
        let ws = null;
        let interval = null;
        let reconnectTimeout = null;
        let isConnected = false;

        // Track pending requests
        const pendingRequests = new Map();

        const connect = () => {
            const WebSocket = require('ws');

            ws = new WebSocket(url);

            ws.on('open', () => {
                console.log(`✅ Bot ${botId} connected`);

                isConnected = true;

                // SINGLE message listener
                ws.on('message', (data) => {
                    try {
                        const response = JSON.parse(data.toString());

                        // Match response to request
                        if (response.requestId && pendingRequests.has(response.requestId)) {
                            const startTime = pendingRequests.get(response.requestId);

                            const latency = Date.now() - startTime;

                            metrics.totalLatency += latency;
                            metrics.latencies.push(latency);
                            metrics.totalOrders++;

                            pendingRequests.delete(response.requestId);
                        }
                    } catch (err) {
                        metrics.errors++;
                    }
                });

                // Send orders continuously
                interval = setInterval(() => {
                    if (!isConnected || ws.readyState !== WebSocket.OPEN) return;

                    try {
                        const order = this.generateOrder();

                        // Unique request tracking
                        const requestId = `${botId}-${Date.now()}-${Math.random()}`;

                        order.requestId = requestId;

                        pendingRequests.set(requestId, Date.now());

                        ws.send(JSON.stringify(order));
                    } catch (err) {
                        metrics.errors++;
                    }

                }, Math.max(10, Math.random() * 50));
            });

            ws.on('error', (err) => {
                console.error(`❌ Bot ${botId} error:`, err.message);
                metrics.errors++;
            });

            ws.on('close', () => {
                console.log(`⚠️ Bot ${botId} disconnected`);

                isConnected = false;

                if (interval) {
                    clearInterval(interval);
                    interval = null;
                }

                // Clear pending requests
                pendingRequests.clear();

                // Reconnect safely
                reconnectTimeout = setTimeout(() => {
                    connect();
                }, 1000);
            });
        };

        connect();

        return {
            stop: () => {
                isConnected = false;

                if (interval) clearInterval(interval);

                if (reconnectTimeout) clearTimeout(reconnectTimeout);

                pendingRequests.clear();

                if (ws) {
                    ws.removeAllListeners();

                    if (
                        ws.readyState === ws.OPEN ||
                        ws.readyState === ws.CONNECTING
                    ) {
                        ws.close();
                    }
                }
            }
        };
    }

    generateOrder() {
        const types = ['BUY', 'SELL'];
        const type = types[Math.floor(Math.random() * types.length)];

        return {
            type,
            price: Math.floor(Math.random() * 100) + 100,
            quantity: Math.floor(Math.random() * 10) + 1,
            timestamp: Date.now()
        };
    }
}

// Run worker
const worker = new BotWorker();
worker.run().then(metrics => {
    parentPort.postMessage({ metrics, workerId });
}).catch(error => {
    parentPort.postMessage({ error: error.message, workerId });
});