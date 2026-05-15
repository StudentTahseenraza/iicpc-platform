class BaseStrategy {
    constructor(config = {}) {
        this.name = config.name || 'base';
        this.orderCount = 0;
        this.activeOrders = [];
    }
    
    generateOrder() {
        throw new Error('generateOrder must be implemented');
    }
    
    onOrderFilled(order) {
        // Override in child classes
    }
    
    onOrderRejected(order) {
        // Override in child classes
    }
    
    getMetrics() {
        return {
            name: this.name,
            orderCount: this.orderCount,
            activeOrders: this.activeOrders.length
        };
    }
}

module.exports = BaseStrategy;