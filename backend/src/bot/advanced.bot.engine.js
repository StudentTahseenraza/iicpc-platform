const { Worker } = require('worker_threads');
const path = require('path');
const EventBus = require('../events/event-bus');

class AdvancedBotEngine {
    constructor() {
        this.eventBus = new EventBus();
    }

    async launchBots(targetUrl, botCount, durationSeconds = 30, strategyDistribution = null) {
        console.log(`🚀 Launching ${botCount} bots using multiple strategies against ${targetUrl}`);
        
        const defaultDistribution = {
            market_maker: 0.5,
            arbitrage: 0.3,
            random_walk: 0.2
        };
        
        const distribution = strategyDistribution || defaultDistribution;
        
        // Create workers for each strategy
        const workers = [];
        const strategyConfigs = {
            market_maker: { spread: 0.01, maxPosition: 100 },
            arbitrage: { threshold: 0.02 },
            random_walk: { volatility: 0.02, initialPrice: 100 }
        };
        
        for (const [strategy, percentage] of Object.entries(distribution)) {
            const strategyBotCount = Math.floor(botCount * percentage);
            if (strategyBotCount > 0) {
                console.log(`  📊 ${strategy}: ${strategyBotCount} bots`);
                
                const worker = new Worker(path.join(__dirname, 'advanced.bot.worker.js'), {
                    workerData: {
                        targetUrl: targetUrl,
                        botCount: strategyBotCount,
                        durationSeconds: durationSeconds,
                        workerId: `${strategy}-${Date.now()}`,
                        strategy: strategy,
                        strategyConfig: strategyConfigs[strategy] || {}
                    }
                });
                
                workers.push(worker);
            }
        }
        
        // Collect results from all workers
        const results = await Promise.all(
            workers.map(worker => new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    worker.terminate();
                    resolve({ error: 'Timeout', metrics: null });
                }, (durationSeconds + 10) * 1000);
                
                worker.on('message', (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                });
                
                worker.on('error', (err) => {
                    clearTimeout(timeout);
                    resolve({ error: err.message, metrics: null });
                });
            }))
        );
        
        // Clean up workers
        workers.forEach(worker => {
            try {
                worker.terminate();
            } catch (err) {}
        });
        
        // Aggregate metrics
        const aggregated = this.aggregateMetrics(results);
        
        // Calculate score with correctness
        const score = this.calculateCorrectnessScore(aggregated);
        aggregated.score = score;
        
        return aggregated;
    }
    
    aggregateMetrics(results) {
        const validResults = results.filter(r => r.metrics && !r.error);
        
        if (validResults.length === 0) {
            return {
                p50: 0, p90: 0, p99: 0, tps: 0, errorRate: 0,
                totalOrders: 0, score: 0, strategyBreakdown: {}
            };
        }
        
        const allLatencies = validResults.flatMap(r => r.metrics.latencies || []);
        allLatencies.sort((a, b) => a - b);
        
        const totalOrders = validResults.reduce((sum, r) => sum + (r.metrics.totalOrders || 0), 0);
        const totalErrors = validResults.reduce((sum, r) => sum + (r.metrics.errors || 0), 0);
        const totalTimeouts = validResults.reduce((sum, r) => sum + (r.metrics.timeouts || 0), 0);
        const duration = validResults[0]?.metrics?.durationSeconds || 30;
        
        const p50 = this.percentile(allLatencies, 50);
        const p90 = this.percentile(allLatencies, 90);
        const p99 = this.percentile(allLatencies, 99);
        
        return {
            p50,
            p90,
            p99,
            tps: Math.round(totalOrders / duration),
            errorRate: totalOrders > 0 ? (totalErrors / totalOrders) * 100 : 0,
            totalOrders,
            totalErrors,
            totalTimeouts,
            durationSeconds: duration,
            strategyBreakdown: this.getStrategyBreakdown(validResults),
            requestStats: this.getRequestStats(validResults)
        };
    }
    
    getStrategyBreakdown(results) {
        const breakdown = {};
        for (const result of results) {
            if (result.metrics && result.metrics.strategy) {
                breakdown[result.metrics.strategy] = {
                    orders: result.metrics.totalOrders,
                    errors: result.metrics.errors,
                    timeouts: result.metrics.timeouts || 0,
                    avgLatency: result.metrics.latencies?.length > 0 
                        ? result.metrics.latencies.reduce((a, b) => a + b, 0) / result.metrics.latencies.length 
                        : 0
                };
            }
        }
        return breakdown;
    }
    
    getRequestStats(results) {
        const stats = { sent: 0, received: 0, timedOut: 0, failed: 0 };
        for (const result of results) {
            if (result.metrics && result.metrics.requestStats) {
                stats.sent += result.metrics.requestStats.sent || 0;
                stats.received += result.metrics.requestStats.received || 0;
                stats.timedOut += result.metrics.requestStats.timedOut || 0;
                stats.failed += result.metrics.requestStats.failed || 0;
            }
        }
        return stats;
    }
    
    calculateCorrectnessScore(metrics) {
        let score = 100;
        
        // Penalize high error rate
        if (metrics.errorRate > 10) score -= 30;
        else if (metrics.errorRate > 5) score -= 15;
        else if (metrics.errorRate > 1) score -= 5;
        
        // Penalize timeouts
        if (metrics.totalTimeouts > 100) score -= 20;
        else if (metrics.totalTimeouts > 50) score -= 10;
        else if (metrics.totalTimeouts > 10) score -= 5;
        
        // Bonus for high TPS
        if (metrics.tps > 5000) score += 15;
        else if (metrics.tps > 2000) score += 10;
        else if (metrics.tps > 1000) score += 5;
        
        // Bonus for low latency
        if (metrics.p99 < 10) score += 10;
        else if (metrics.p99 < 50) score += 5;
        
        return Math.min(100, Math.max(0, score));
    }
    
    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
}

module.exports = AdvancedBotEngine;