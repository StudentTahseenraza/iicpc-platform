const BaseStrategy = require('./base.strategy');

class IcebergStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'iceberg', ...config });
        this.totalQuantity = config.totalQuantity || 100;
        this.sliceSize = config.sliceSize || 10;
        this.sliceInterval = config.sliceInterval || 1000;
        this.currentSlice = 0;
        this.activeOrders = [];
    }

    generateOrder() {
        if (this.currentSlice >= this.totalQuantity) {
            return null; // No more orders
        }

        const remaining = this.totalQuantity - this.currentSlice;
        const quantity = Math.min(this.sliceSize, remaining);
        
        const order = {
            type: Math.random() > 0.5 ? 'BUY' : 'SELL',
            price: this.calculateIcebergPrice(),
            quantity: quantity,
            strategy: this.name,
            iceberg: true,
            sliceNumber: Math.floor(this.currentSlice / this.sliceSize) + 1,
            totalSlices: Math.ceil(this.totalQuantity / this.sliceSize),
            timestamp: Date.now()
        };

        this.currentSlice += quantity;
        this.activeOrders.push(order);

        return order;
    }

    calculateIcebergPrice() {
        // Price moves with each slice
        const basePrice = 100;
        const sliceProgress = this.currentSlice / this.totalQuantity;
        const drift = (Math.random() - 0.5) * 0.02;
        return basePrice * (1 + sliceProgress * drift);
    }

    onOrderFilled(order) {
        const index = this.activeOrders.findIndex(o => o === order);
        if (index !== -1) {
            this.activeOrders.splice(index, 1);
        }
    }

    getMetrics() {
        return {
            ...super.getMetrics(),
            totalQuantity: this.totalQuantity,
            slicesCompleted: Math.floor(this.currentSlice / this.sliceSize),
            slicesRemaining: Math.ceil((this.totalQuantity - this.currentSlice) / this.sliceSize),
            activeIcebergs: this.activeOrders.length
        };
    }
}

module.exports = IcebergStrategy;