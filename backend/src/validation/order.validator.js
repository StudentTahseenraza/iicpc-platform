class OrderValidator {
    static validatePriceTimePriority(orders, matches) {
        const violations = [];
        
        // Sort orders by price (highest first for buys, lowest first for sells)
        const buyOrders = orders.filter(o => o.type === 'BUY').sort((a, b) => b.price - a.price);
        const sellOrders = orders.filter(o => o.type === 'SELL').sort((a, b) => a.price - b.price);
        
        // Check price priority
        for (let i = 0; i < buyOrders.length - 1; i++) {
            if (buyOrders[i].price < buyOrders[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    message: `Buy order ${buyOrders[i+1].id} has higher price but lower priority`,
                    severity: 'HIGH'
                });
            }
        }
        
        for (let i = 0; i < sellOrders.length - 1; i++) {
            if (sellOrders[i].price > sellOrders[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    message: `Sell order ${sellOrders[i+1].id} has lower price but lower priority`,
                    severity: 'HIGH'
                });
            }
        }
        
        return violations;
    }
    
    static validateFillAccuracy(order, fill) {
        const violations = [];
        
        if (order.type === 'BUY') {
            if (fill.price > order.price) {
                violations.push({
                    type: 'FILL_PRICE_VIOLATION',
                    message: `Buy order filled at ${fill.price} > limit ${order.price}`,
                    severity: 'CRITICAL'
                });
            }
        } else if (order.type === 'SELL') {
            if (fill.price < order.price) {
                violations.push({
                    type: 'FILL_PRICE_VIOLATION',
                    message: `Sell order filled at ${fill.price} < limit ${order.price}`,
                    severity: 'CRITICAL'
                });
            }
        }
        
        if (fill.quantity > order.quantity) {
            violations.push({
                type: 'FILL_QUANTITY_VIOLATION',
                message: `Fill quantity ${fill.quantity} > order quantity ${order.quantity}`,
                severity: 'CRITICAL'
            });
        }
        
        return violations;
    }
    
    static validateOrderBookIntegrity(orderBook) {
        const violations = [];
        
        // Check best bid < best ask
        const bestBid = orderBook.bids[0]?.price || 0;
        const bestAsk = orderBook.asks[0]?.price || Infinity;
        
        if (bestBid > bestAsk) {
            violations.push({
                type: 'CROSSED_MARKET',
                message: `Best bid ${bestBid} > best ask ${bestAsk}`,
                severity: 'CRITICAL'
            });
        }
        
        // Check for negative quantities
        const negativeBids = orderBook.bids.filter(b => b.quantity < 0);
        const negativeAsks = orderBook.asks.filter(a => a.quantity < 0);
        
        if (negativeBids.length > 0 || negativeAsks.length > 0) {
            violations.push({
                type: 'NEGATIVE_QUANTITY',
                message: `Negative quantities found: ${negativeBids.length} bids, ${negativeAsks.length} asks`,
                severity: 'HIGH'
            });
        }
        
        return violations;
    }
    
    static calculateCorrectnessScore(violations) {
        const criticalCount = violations.filter(v => v.severity === 'CRITICAL').length;
        const highCount = violations.filter(v => v.severity === 'HIGH').length;
        const mediumCount = violations.filter(v => v.severity === 'MEDIUM').length;
        
        let score = 100;
        score -= criticalCount * 20;
        score -= highCount * 5;
        score -= mediumCount * 2;
        
        return Math.max(0, Math.min(100, score));
    }
}

module.exports = OrderValidator;