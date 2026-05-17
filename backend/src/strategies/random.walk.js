const BaseStrategy = require('./base.strategy');

class RandomWalkStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'random_walk', ...config });
        this.currentPrice = config.initialPrice || 100;
        this.volatility = config.volatility || 0.02; // 2% volatility
    }
    
    generateOrder() {
        this.orderCount++;
        
        // Random walk price movement
        const change = (Math.random() - 0.5) * this.volatility;
        this.currentPrice = Math.max(50, this.currentPrice * (1 + change));
        
        // Random order type with bias based on price direction
        const isBuy = change > 0 ? Math.random() > 0.3 : Math.random() > 0.7;
        
        const order = {
            type: isBuy ? 'BUY' : 'SELL',
            price: Math.round(this.currentPrice * 100) / 100,
            quantity: Math.floor(Math.random() * 10) + 1,
            strategy: this.name,
            volatility: this.volatility,
            timestamp: Date.now()
        };
        
        return order;
    }
}

module.exports = RandomWalkStrategy;