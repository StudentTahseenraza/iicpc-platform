const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Simple order book (in-memory)
let orderBook = {
    bids: [], // buy orders
    asks: []  // sell orders
};

// Process incoming orders
function processOrder(order) {
    const { type, price, quantity, timestamp } = order;
    
    // Simulate processing delay (real trading engine would be faster)
    const startProcess = Date.now();
    
    let result = {
        orderId: Math.random().toString(36).substring(7),
        status: 'accepted',
        processedAt: Date.now(),
        latency: Date.now() - startProcess
    };
    
    // Simple order book logic
    if (type === 'BUY') {
        orderBook.bids.push({ price, quantity, timestamp });
        orderBook.bids.sort((a, b) => b.price - a.price); // Sort by price desc
    } else if (type === 'SELL') {
        orderBook.asks.push({ price, quantity, timestamp });
        orderBook.asks.sort((a, b) => a.price - b.price); // Sort by price asc
    }
    
    // Keep only top 100 orders
    orderBook.bids = orderBook.bids.slice(0, 100);
    orderBook.asks = orderBook.asks.slice(0, 100);
    
    return result;
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('Bot connected');
    
    ws.on('message', (data) => {
        try {
            const order = JSON.parse(data);
            const result = processOrder(order);
            ws.send(JSON.stringify(result));
        } catch (error) {
            ws.send(JSON.stringify({ status: 'error', message: 'Invalid order' }));
        }
    });
    
    ws.on('close', () => {
        console.log('Bot disconnected');
    });
});

// REST endpoint for orders
app.post('/order', express.json(), (req, res) => {
    const result = processOrder(req.body);
    res.json(result);
});

// Get order book snapshot
app.get('/orderbook', (req, res) => {
    res.json(orderBook);
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`✅ Trading engine running on port ${PORT}`);
    console.log(`📊 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});