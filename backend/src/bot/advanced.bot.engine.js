const { Worker } = require('worker_threads');
const path = require('path');
const EventBus = require('../events/event-bus');
const MarketMakerStrategy = require('../strategies/market.maker');
const ArbitrageStrategy = require('../strategies/arbitrage');
const RandomWalkStrategy = require('../strategies/random.walk');

class AdvancedBotEngine {
    constructor() {
        this.eventBus = new EventBus();
        this.strategies = {
            market_maker: MarketMakerStrategy,
            arbitrage: ArbitrageStrategy,
            random_walk: RandomWalkStrategy
        };
    }
    
    async launchBots(targetUrl, botCount, durationSeconds = 30, strategyDistribution = null) {
        console.log(`🚀 Launching ${botCount} bots using multiple strategies`);
        
        const defaultDistribution = {
            market_maker: 0.5,  // 50% market makers
            arbitrage: 0.3,      // 30% arbitrage
            random_walk: 0.2     // 20% random walk
        };
        
        const distribution = strategyDistribution || defaultDistribution;
        
        // Create bots with different strategies
        const botGroups = [];
        for (const [strategy, percentage] of Object.entries(distribution)) {
            const count = Math.floor(botCount * percentage);
            if (count > 0) {
                botGroups.push({
                    strategy,
                    count,
                    bots: []
                });
            }
        }
        
        // Launch bot group workers
        const workers = [];
        for (const group of botGroups) {
            const StrategyClass = this.strategies[group.strategy];
            if (StrategyClass) {
                const worker = new Worker(path.join(__dirname, 'advanced.bot.worker.js'), {
                    workerData: {
                        targetUrl,
                        botCount: group.count,
                        durationSeconds,
                        strategy: group.strategy,
                        strategyConfig: this.getStrategyConfig(group.strategy)
                    }
                });
                workers.push(worker);
            }
        }
        
        // Collect results
        const results = await Promise.all(
            workers.map(worker => new Promise((resolve) => {
                worker.on('message', resolve);
                worker.on('error', (err) => resolve({ error: err.message, metrics: null }));
            }))
        );
        
        // Aggregate metrics
        const aggregated = this.aggregateMetrics(results);
        
        // Calculate correctness score
        const correctnessScore = this.calculateCorrectnessScore(aggregated);
        
        // Publish test completed event
        await this.eventBus.publish(EventBus.TOPICS.TEST_COMPLETED, {
            submissionId: targetUrl,
            metrics: aggregated,
            correctnessScore
        });
        
        return aggregated;
    }
    
    getStrategyConfig(strategy) {
        const configs = {
            market_maker: { spread: 0.01, maxPosition: 100 },
            arbitrage: { threshold: 0.02 },
            random_walk: { volatility: 0.02, initialPrice: 100 }
        };
        return configs[strategy] || {};
    }
    
    aggregateMetrics(results) {
        const validResults = results.filter(r => r.metrics);
        
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
        
        const p50 = this.percentile(allLatencies, 50);
        const p90 = this.percentile(allLatencies, 90);
        const p99 = this.percentile(allLatencies, 99);
        
        return {
            p50, p90, p99,
            tps: Math.round(totalOrders / 30),
            errorRate: totalOrders > 0 ? (totalErrors / totalOrders) * 100 : 0,
            totalOrders,
            strategyBreakdown: this.getStrategyBreakdown(validResults)
        };
    }
    
    getStrategyBreakdown(results) {
        const breakdown = {};
        for (const result of results) {
            if (result.metrics && result.metrics.strategy) {
                breakdown[result.metrics.strategy] = {
                    orders: result.metrics.totalOrders,
                    errors: result.metrics.errors
                };
            }
        }
        return breakdown;
    }
    
    calculateCorrectnessScore(metrics) {
        let score = 100;
        
        // Penalize high error rate
        if (metrics.errorRate > 5) score -= 20;
        else if (metrics.errorRate > 1) score -= 10;
        
        // Bonus for high TPS
        if (metrics.tps > 1000) score += 10;
        else if (metrics.tps > 500) score += 5;
        
        return Math.min(100, Math.max(0, score));
    }
    
    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        const index = Math.ceil((p / 100) * sortedArray.length) - 1;
        return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
    }
}

module.exports = AdvancedBotEngine;