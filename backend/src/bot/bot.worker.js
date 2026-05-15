const { parentPort, workerData } = require('worker_threads');

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
        let isConnected = false;
        
        const connect = () => {
            const WebSocket = require('ws');
            ws = new WebSocket(url);
            
            ws.on('open', () => {
                isConnected = true;
                // Start sending orders
                interval = setInterval(() => {
                    if (!isConnected) return;
                    
                    const startTime = Date.now();
                    const order = this.generateOrder();
                    
                    ws.send(JSON.stringify(order));
                    
                    ws.once('message', () => {
                        const latency = Date.now() - startTime;
                        metrics.totalLatency += latency;
                        metrics.latencies.push(latency);
                        metrics.totalOrders++;
                    });
                }, Math.random() * 100); // Random interval 0-100ms
            });
            
            ws.on('error', () => {
                metrics.errors++;
            });
            
            ws.on('close', () => {
                isConnected = false;
                setTimeout(connect, 1000); // Reconnect
            });
        };
        
        connect();
        
        return {
            stop: () => {
                if (interval) clearInterval(interval);
                if (ws) ws.close();
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