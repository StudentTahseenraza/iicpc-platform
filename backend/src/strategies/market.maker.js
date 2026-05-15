const BaseStrategy = require('./base.strategy');

class MarketMakerStrategy extends BaseStrategy {
    constructor(config = {}) {
        super({ name: 'market_maker', ...config });
        this.spread = config.spread || 0.01; // 1% spread
        this.position = config.position || 0;
        this.maxPosition = config.maxPosition || 100;
    }
    
    generateOrder() {
        this.orderCount++;
        
        // Alternate between buy and sell to maintain liquidity
        const isBuy = this.position < this.maxPosition / 2;
        const basePrice = 100; // Base price
        const price = isBuy ? basePrice * (1 - this.spread) : basePrice * (1 + this.spread);
        
        const order = {
            type: isBuy ? 'BUY' : 'SELL',
            price: Math.round(price * 100) / 100,
            quantity: Math.floor(Math.random() * 5) + 1,
            strategy: this.name,
            timestamp: Date.now()
        };
        
        // Update virtual position
        if (isBuy) {
            this.position += order.quantity;
        } else {
            this.position -= order.quantity;
        }
        
        return order;
    }
    
    onOrderFilled(order) {
        console.log(`📈 Market maker filled: ${order.type} ${order.quantity} @ ${order.price}`);
    }
}

module.exports = MarketMakerStrategy;