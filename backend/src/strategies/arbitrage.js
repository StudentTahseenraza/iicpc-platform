const BaseStrategy = require('./base.strategy');

class ArbitrageStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'arbitrage', ...config });
        this.priceHistory = [];
        this.threshold = config.threshold || 0.02; // 2% threshold
    }
    
    updatePrice(price) {
        this.priceHistory.push(price);
        if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
        }
    }
    
    detectOpportunity() {
        if (this.priceHistory.length < 10) return null;
        
        const recentPrices = this.priceHistory.slice(-10);
        const avg = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
        const current = this.priceHistory[this.priceHistory.length - 1];
        const deviation = Math.abs(current - avg) / avg;
        
        if (deviation > this.threshold) {
            return current > avg ? 'SELL' : 'BUY';
        }
        return null;
    }
    
    generateOrder() {
        this.orderCount++;
        
        const opportunity = this.detectOpportunity();
        
        if (opportunity) {
            return {
                type: opportunity,
                price: Math.round((100 * (1 + (opportunity === 'BUY' ? -0.005 : 0.005))) * 100) / 100,
                quantity: Math.floor(Math.random() * 3) + 1,
                strategy: this.name,
                isArbitrage: true,
                timestamp: Date.now()
            };
        }
        
        // Default: small market order
        return {
            type: Math.random() > 0.5 ? 'BUY' : 'SELL',
            price: 100,
            quantity: 1,
            strategy: this.name,
            isArbitrage: false,
            timestamp: Date.now()
        };
    }
}

module.exports = ArbitrageStrategy;