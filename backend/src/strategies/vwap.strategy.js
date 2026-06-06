const BaseStrategy = require('./base.strategy');

class VWAPStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'vwap', ...config });
        this.targetVWAP = config.targetVWAP || 100;
        this.tolerance = config.tolerance || 0.01;
        this.orderBook = [];
        this.volumeWeightedPrice = 0;
        this.totalVolume = 0;
    }

    generateOrder() {
        this.calculateVWAP();
        
        const deviation = (this.volumeWeightedPrice - this.targetVWAP) / this.targetVWAP;
        let direction = deviation > 0 ? 'SELL' : 'BUY';
        let intensity = Math.min(1, Math.abs(deviation) / this.tolerance);
        
        const order = {
            type: direction,
            price: this.targetVWAP * (1 + (Math.random() - 0.5) * 0.01),
            quantity: Math.floor(intensity * 10) + 1,
            strategy: this.name,
            vwap: true,
            deviation: deviation,
            currentVWAP: this.volumeWeightedPrice,
            timestamp: Date.now()
        };
        
        this.orderCount++;
        return order;
    }

    calculateVWAP() {
        if (this.orderBook.length === 0) return;
        
        let totalValue = 0;
        let totalVol = 0;
        
        for (const order of this.orderBook) {
            totalValue += order.price * order.quantity;
            totalVol += order.quantity;
        }
        
        this.volumeWeightedPrice = totalValue / totalVol;
        this.totalVolume = totalVol;
    }

    updateMarketData(price, volume) {
        this.orderBook.push({ price, volume, timestamp: Date.now() });
        
        // Keep only last 100 trades
        if (this.orderBook.length > 100) {
            this.orderBook.shift();
        }
        
        this.calculateVWAP();
    }

    getMetrics() {
        return {
            ...super.getMetrics(),
            currentVWAP: this.volumeWeightedPrice,
            totalVolume: this.totalVolume,
            deviation: ((this.volumeWeightedPrice - this.targetVWAP) / this.targetVWAP) * 100 + '%'
        };
    }
}

module.exports = VWAPStrategy;