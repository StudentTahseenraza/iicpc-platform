class TradingValidator {
    constructor() {
        this.orderBooks = new Map(); // submissionId -> orderBook
        this.trades = new Map();     // submissionId -> trades[]
        this.balances = new Map();   // submissionId -> balances
    }

    initialize(submissionId) {
        this.orderBooks.set(submissionId, {
            bids: [], // price descending
            asks: []  // price ascending
        });
        this.trades.set(submissionId, []);
        this.balances.set(submissionId, {});
    }

    validateOrder(submissionId, order) {
        const violations = [];
        
        // Validate order structure
        if (!order.type || !['BUY', 'SELL'].includes(order.type)) {
            violations.push({ type: 'INVALID_ORDER_TYPE', message: `Invalid type: ${order.type}` });
        }
        
        if (!order.price || order.price <= 0) {
            violations.push({ type: 'INVALID_PRICE', message: `Invalid price: ${order.price}` });
        }
        
        if (!order.quantity || order.quantity <= 0) {
            violations.push({ type: 'INVALID_QUANTITY', message: `Invalid quantity: ${order.quantity}` });
        }
        
        return violations;
    }

    processOrder(submissionId, order, orderId) {
        const orderBook = this.orderBooks.get(submissionId);
        const trades = this.trades.get(submissionId);
        
        if (!orderBook) {
            this.initialize(submissionId);
            return this.processOrder(submissionId, order, orderId);
        }
        
        const matchedTrades = [];
        
        if (order.type === 'BUY') {
            // Match against asks (lowest price first)
            while (order.quantity > 0 && orderBook.asks.length > 0) {
                const bestAsk = orderBook.asks[0];
                
                if (order.price >= bestAsk.price) {
                    const tradeQuantity = Math.min(order.quantity, bestAsk.quantity);
                    const trade = {
                        orderId: orderId,
                        matchedWith: bestAsk.id,
                        type: 'BUY',
                        price: bestAsk.price,
                        quantity: tradeQuantity,
                        timestamp: Date.now()
                    };
                    
                    matchedTrades.push(trade);
                    trades.push(trade);
                    
                    order.quantity -= tradeQuantity;
                    bestAsk.quantity -= tradeQuantity;
                    
                    if (bestAsk.quantity === 0) {
                        orderBook.asks.shift();
                    }
                } else {
                    break;
                }
            }
            
            // Add remaining quantity to bids
            if (order.quantity > 0) {
                orderBook.bids.push({
                    id: orderId,
                    price: order.price,
                    quantity: order.quantity,
                    type: 'BUY',
                    timestamp: Date.now()
                });
                orderBook.bids.sort((a, b) => b.price - a.price);
            }
        } 
        else if (order.type === 'SELL') {
            // Match against bids (highest price first)
            while (order.quantity > 0 && orderBook.bids.length > 0) {
                const bestBid = orderBook.bids[0];
                
                if (order.price <= bestBid.price) {
                    const tradeQuantity = Math.min(order.quantity, bestBid.quantity);
                    const trade = {
                        orderId: orderId,
                        matchedWith: bestBid.id,
                        type: 'SELL',
                        price: bestBid.price,
                        quantity: tradeQuantity,
                        timestamp: Date.now()
                    };
                    
                    matchedTrades.push(trade);
                    trades.push(trade);
                    
                    order.quantity -= tradeQuantity;
                    bestBid.quantity -= tradeQuantity;
                    
                    if (bestBid.quantity === 0) {
                        orderBook.bids.shift();
                    }
                } else {
                    break;
                }
            }
            
            // Add remaining quantity to asks
            if (order.quantity > 0) {
                orderBook.asks.push({
                    id: orderId,
                    price: order.price,
                    quantity: order.quantity,
                    type: 'SELL',
                    timestamp: Date.now()
                });
                orderBook.asks.sort((a, b) => a.price - b.price);
            }
        }
        
        return {
            matchedTrades,
            remainingQuantity: order.quantity,
            orderBook: {
                bids: orderBook.bids.slice(0, 10),
                asks: orderBook.asks.slice(0, 10)
            }
        };
    }

    validatePriceTimePriority(submissionId) {
        const orderBook = this.orderBooks.get(submissionId);
        if (!orderBook) return [];
        
        const violations = [];
        
        // Check bid ordering (highest price first)
        for (let i = 0; i < orderBook.bids.length - 1; i++) {
            if (orderBook.bids[i].price < orderBook.bids[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    severity: 'HIGH',
                    message: `Bid ${i} price ${orderBook.bids[i].price} < bid ${i+1} price ${orderBook.bids[i+1].price}`
                });
            }
        }
        
        // Check ask ordering (lowest price first)
        for (let i = 0; i < orderBook.asks.length - 1; i++) {
            if (orderBook.asks[i].price > orderBook.asks[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    severity: 'HIGH',
                    message: `Ask ${i} price ${orderBook.asks[i].price} > ask ${i+1} price ${orderBook.asks[i+1].price}`
                });
            }
        }
        
        return violations;
    }

    calculateCorrectnessScore(submissionId) {
        const trades = this.trades.get(submissionId) || [];
        const violations = this.validatePriceTimePriority(submissionId);
        
        let score = 100;
        
        // Deduct for violations
        score -= violations.length * 5;
        
        // Bonus for matching engine efficiency
        if (trades.length > 0) {
            const avgTradeSize = trades.reduce((sum, t) => sum + t.quantity, 0) / trades.length;
            if (avgTradeSize > 5) score += 5;
        }
        
        return Math.max(0, Math.min(100, score));
    }

    getMetrics(submissionId) {
        const orderBook = this.orderBooks.get(submissionId);
        const trades = this.trades.get(submissionId) || [];
        
        return {
            totalTrades: trades.length,
            totalVolume: trades.reduce((sum, t) => sum + t.quantity, 0),
            bidDepth: orderBook?.bids.length || 0,
            askDepth: orderBook?.asks.length || 0,
            bestBid: orderBook?.bids[0]?.price || 0,
            bestAsk: orderBook?.asks[0]?.price || 0,
            spread: (orderBook?.asks[0]?.price || 0) - (orderBook?.bids[0]?.price || 0),
            correctnessScore: this.calculateCorrectnessScore(submissionId)
        };
    }
}

module.exports = TradingValidator;