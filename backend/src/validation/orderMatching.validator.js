const { pool } = require('../models/db');

class OrderMatchingValidator {
    constructor() {
        this.orderBooks = new Map();
        this.tradeHistory = new Map();
    }

    // Initialize order book for a submission
    initOrderBook(submissionId) {
        this.orderBooks.set(submissionId, {
            bids: [], // Buy orders - highest price first
            asks: [], // Sell orders - lowest price first
            trades: [],
            sequence: 0
        });
    }

    // Validate price-time priority
    validatePriceTimePriority(submissionId) {
        const orderBook = this.orderBooks.get(submissionId);
        if (!orderBook) return { valid: true, violations: [] };

        const violations = [];

        // Check bids are sorted by price descending
        for (let i = 0; i < orderBook.bids.length - 1; i++) {
            if (orderBook.bids[i].price < orderBook.bids[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    severity: 'HIGH',
                    message: `Bid order ${orderBook.bids[i+1].id} has higher price (${orderBook.bids[i+1].price}) but lower priority than bid ${orderBook.bids[i].id} (${orderBook.bids[i].price})`
                });
            }
        }

        // Check asks are sorted by price ascending
        for (let i = 0; i < orderBook.asks.length - 1; i++) {
            if (orderBook.asks[i].price > orderBook.asks[i + 1].price) {
                violations.push({
                    type: 'PRICE_PRIORITY_VIOLATION',
                    severity: 'HIGH',
                    message: `Ask order ${orderBook.asks[i+1].id} has lower price (${orderBook.asks[i+1].price}) but lower priority than ask ${orderBook.asks[i].id} (${orderBook.asks[i].price})`
                });
            }
        }

        // Check for crossed market (bid >= ask)
        if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
            const bestBid = orderBook.bids[0].price;
            const bestAsk = orderBook.asks[0].price;
            if (bestBid >= bestAsk) {
                violations.push({
                    type: 'CROSSED_MARKET',
                    severity: 'CRITICAL',
                    message: `Market crossed: Best bid ${bestBid} >= Best ask ${bestAsk}`
                });
            }
        }

        return {
            valid: violations.length === 0,
            violations,
            score: Math.max(0, 100 - (violations.length * 10))
        };
    }

    // Process an order and validate matching
    processOrder(submissionId, order, orderId) {
        let orderBook = this.orderBooks.get(submissionId);
        if (!orderBook) {
            this.initOrderBook(submissionId);
            orderBook = this.orderBooks.get(submissionId);
        }

        const trades = [];
        let remainingQuantity = order.quantity;

        if (order.type === 'BUY') {
            // Match against asks (lowest price first)
            while (remainingQuantity > 0 && orderBook.asks.length > 0) {
                const bestAsk = orderBook.asks[0];
                
                if (order.price >= bestAsk.price) {
                    const tradeQuantity = Math.min(remainingQuantity, bestAsk.quantity);
                    const trade = {
                        tradeId: ++orderBook.sequence,
                        orderId: orderId,
                        matchedWith: bestAsk.id,
                        type: 'BUY',
                        price: bestAsk.price,
                        quantity: tradeQuantity,
                        timestamp: Date.now(),
                        isValid: true
                    };
                    
                    trades.push(trade);
                    remainingQuantity -= tradeQuantity;
                    bestAsk.quantity -= tradeQuantity;
                    
                    if (bestAsk.quantity === 0) {
                        orderBook.asks.shift();
                    }
                } else {
                    break;
                }
            }
            
            // Add remaining to bids
            if (remainingQuantity > 0) {
                orderBook.bids.push({
                    id: orderId,
                    price: order.price,
                    quantity: remainingQuantity,
                    type: 'BUY',
                    timestamp: Date.now()
                });
                orderBook.bids.sort((a, b) => b.price - a.price);
            }
        } 
        else if (order.type === 'SELL') {
            // Match against bids (highest price first)
            while (remainingQuantity > 0 && orderBook.bids.length > 0) {
                const bestBid = orderBook.bids[0];
                
                if (order.price <= bestBid.price) {
                    const tradeQuantity = Math.min(remainingQuantity, bestBid.quantity);
                    const trade = {
                        tradeId: ++orderBook.sequence,
                        orderId: orderId,
                        matchedWith: bestBid.id,
                        type: 'SELL',
                        price: bestBid.price,
                        quantity: tradeQuantity,
                        timestamp: Date.now(),
                        isValid: true
                    };
                    
                    trades.push(trade);
                    remainingQuantity -= tradeQuantity;
                    bestBid.quantity -= tradeQuantity;
                    
                    if (bestBid.quantity === 0) {
                        orderBook.bids.shift();
                    }
                } else {
                    break;
                }
            }
            
            // Add remaining to asks
            if (remainingQuantity > 0) {
                orderBook.asks.push({
                    id: orderId,
                    price: order.price,
                    quantity: remainingQuantity,
                    type: 'SELL',
                    timestamp: Date.now()
                });
                orderBook.asks.sort((a, b) => a.price - b.price);
            }
        }

        // Store trades
        if (!this.tradeHistory.has(submissionId)) {
            this.tradeHistory.set(submissionId, []);
        }
        this.tradeHistory.get(submissionId).push(...trades);

        return {
            trades,
            remainingQuantity,
            orderBookState: {
                bidCount: orderBook.bids.length,
                askCount: orderBook.asks.length,
                bestBid: orderBook.bids[0]?.price || 0,
                bestAsk: orderBook.asks[0]?.price || 0
            }
        };
    }

    // Calculate correctness score
    calculateCorrectnessScore(submissionId) {
        const orderBook = this.orderBooks.get(submissionId);
        const trades = this.tradeHistory.get(submissionId) || [];
        const priceTimeValidation = this.validatePriceTimePriority(submissionId);
        
        let score = 100;
        
        // Deduct for price-time violations
        score -= priceTimeValidation.violations.length * 10;
        
        // Bonus for executing trades
        if (trades.length > 0) {
            score += Math.min(10, trades.length / 100);
        }
        
        // Bonus for order book depth
        if (orderBook) {
            const depth = orderBook.bids.length + orderBook.asks.length;
            score += Math.min(5, depth / 20);
        }
        
        return Math.max(0, Math.min(100, score));
    }

    // Get validation metrics
    getValidationMetrics(submissionId) {
        const trades = this.tradeHistory.get(submissionId) || [];
        const priceTimeValidation = this.validatePriceTimePriority(submissionId);
        
        return {
            totalTrades: trades.length,
            totalVolume: trades.reduce((sum, t) => sum + t.quantity, 0),
            averageTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + t.quantity, 0) / trades.length : 0,
            violations: priceTimeValidation.violations,
            correctnessScore: this.calculateCorrectnessScore(submissionId),
            priceTimePriorityValid: priceTimeValidation.valid
        };
    }

    // Clean up
    cleanup(submissionId) {
        this.orderBooks.delete(submissionId);
        this.tradeHistory.delete(submissionId);
    }
}

module.exports = OrderMatchingValidator;