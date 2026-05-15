const { Worker } = require('worker_threads');
const path = require('path');
const WebSocket = require('ws');

class BotEngine {
    async launchBots(targetUrl, botCount, durationSeconds = 30) {
        console.log(`🚀 Launching ${botCount} bots against ${targetUrl} for ${durationSeconds}s`);
        
        const cpuCount = require('os').cpus().length;
        const workersCount = Math.min(cpuCount, 8);
        const botsPerWorker = Math.ceil(botCount / workersCount);
        
        const workers = [];
        const startTime = Date.now();
        
        // Create workers
        for (let i = 0; i < workersCount; i++) {
            const worker = new Worker(path.join(__dirname, 'bot.worker.js'), {
                workerData: {
                    targetUrl,
                    botCount: botsPerWorker,
                    durationSeconds,
                    workerId: i,
                    startTime
                }
            });
            workers.push(worker);
        }
        
        // Wait for all workers to complete
        const results = await Promise.all(
            workers.map(worker => new Promise((resolve) => {
                worker.on('message', resolve);
                worker.on('error', (err) => resolve({ error: err.message, metrics: null }));
            }))
        );
        
        // Aggregate metrics
        const aggregatedMetrics = this.aggregateMetrics(results);
        
        // Calculate percentiles
        const allLatencies = results.flatMap(r => r.metrics?.latencies || []);
        allLatencies.sort((a, b) => a - b);
        
        const p50 = this.percentile(allLatencies, 50);
        const p90 = this.percentile(allLatencies, 90);
        const p99 = this.percentile(allLatencies, 99);
        
        const totalOrders = results.reduce((sum, r) => sum + (r.metrics?.totalOrders || 0), 0);
        const totalErrors = results.reduce((sum, r) => sum + (r.metrics?.errors || 0), 0);
        const tps = Math.round(totalOrders / durationSeconds);
        const errorRate = totalOrders > 0 ? (totalErrors / totalOrders) * 100 : 0;
        
        // Calculate score
        const score = this.calculateScore(tps, p99, errorRate);
        
        return {
            p50,
            p90,
            p99,
            tps,
            errorRate,
            totalOrders,
            score,
            durationSeconds
        };
    }
    
    aggregateMetrics(results) {
        const validResults = results.filter(r => r.metrics && !r.error);
        return {
            totalOrders: validResults.reduce((sum, r) => sum + r.metrics.totalOrders, 0),
            totalErrors: validResults.reduce((sum, r) => sum + r.metrics.errors, 0),
            workersCompleted: validResults.length
        };
    }
    
    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
    
    calculateScore(tps, p99Latency, errorRate) {
        // TPS score: max 50 points at 10,000 TPS
        const tpsScore = Math.min(50, (tps / 10000) * 50);
        
        // Latency score: max 30 points at <1ms
        const latencyScore = Math.max(0, 30 - (p99Latency / 10));
        
        // Correctness/error score: max 20 points
        const errorScore = Math.max(0, 20 - errorRate);
        
        return Math.round((tpsScore + latencyScore + errorScore) * 100) / 100;
    }
}

module.exports = BotEngine;