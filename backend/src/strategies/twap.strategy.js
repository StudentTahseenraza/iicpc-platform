const BaseStrategy = require('./base.strategy');

class TWAPStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'twap', ...config });
        this.totalQuantity = config.totalQuantity || 100;
        this.duration = config.duration || 60000; // 60 seconds
        this.startTime = null;
        this.interval = null;
        this.priceHistory = [];
    }

    start() {
        this.startTime = Date.now();
        this.scheduleOrders();
    }

    scheduleOrders() {
        const intervals = Math.min(20, this.totalQuantity);
        const quantityPerInterval = this.totalQuantity / intervals;
        const intervalTime = this.duration / intervals;

        for (let i = 0; i < intervals; i++) {
            setTimeout(() => {
                if (this.orderCount < this.totalQuantity) {
                    const order = this.generateTWAPOrder(quantityPerInterval);
                    this.emit('order', order);
                }
            }, i * intervalTime);
        }
    }

    generateTWAPOrder(quantity) {
        const currentPrice = this.getCurrentMarketPrice();
        const order = {
            type: Math.random() > 0.5 ? 'BUY' : 'SELL',
            price: currentPrice,
            quantity: quantity,
            strategy: this.name,
            twap: true,
            interval: Math.floor((Date.now() - this.startTime) / 1000),
            timestamp: Date.now()
        };
        this.orderCount += quantity;
        return order;
    }

    getCurrentMarketPrice() {
        if (this.priceHistory.length === 0) return 100;
        const avg = this.priceHistory.reduce((a, b) => a + b, 0) / this.priceHistory.length;
        return avg;
    }

    updatePrice(price) {
        this.priceHistory.push(price);
        if (this.priceHistory.length > 100) {
            this.priceHistory.shift();
        }
    }
}

module.exports = TWAPStrategy;