const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'IICPC Trading Engine Running',
        version: '2.0.0',
        endpoints: ['/health', '/order', '/orderbook', 'ws://'],
        status: 'operational'
    });
});

// Order book
let orderBook = {
    bids: [],
    asks: []
};
let orderId = 1;
let totalProcessed = 0;

// REST endpoint for orders
app.post('/order', (req, res) => {
    const { type, price, quantity, requestId } = req.body;
    const startTime = Date.now();
    
    const order = {
        id: orderId++,
        type,
        price: parseFloat(price),
        quantity: parseFloat(quantity),
        timestamp: startTime,
        status: 'accepted',
        requestId: requestId || `rest-${orderId}`
    };
    
    if (type === 'BUY') {
        orderBook.bids.push(order);
        orderBook.bids.sort((a, b) => b.price - a.price);
    } else if (type === 'SELL') {
        orderBook.asks.push(order);
        orderBook.asks.sort((a, b) => a.price - b.price);
    }
    
    // Keep only top 100
    orderBook.bids = orderBook.bids.slice(0, 100);
    orderBook.asks = orderBook.asks.slice(0, 100);
    totalProcessed++;
    
    res.json({
        orderId: order.id,
        status: 'accepted',
        price: order.price,
        quantity: order.quantity,
        latency: Date.now() - startTime,
        requestId: order.requestId
    });
});

app.get('/orderbook', (req, res) => {
    res.json({
        bids: orderBook.bids.slice(0, 10),
        asks: orderBook.asks.slice(0, 10),
        bidCount: orderBook.bids.length,
        askCount: orderBook.asks.length,
        totalProcessed
    });
});

// WebSocket connection handling - COMPLETELY REWRITTEN
wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    console.log(`🔌 [${clientId}] Bot connected`);
    
    // Send immediate confirmation
    ws.send(JSON.stringify({
        type: 'connection_ack',
        clientId: clientId,
        status: 'connected',
        timestamp: Date.now()
    }));
    
    ws.on('message', (data) => {
        try {
            const startTime = Date.now();
            const message = JSON.parse(data.toString());
            
            // Validate order
            if (!message.type || !message.price || !message.quantity) {
                ws.send(JSON.stringify({
                    status: 'error',
                    error: 'Missing required fields: type, price, quantity',
                    received: message,
                    requestId: message.requestId
                }));
                return;
            }
            
            // Create order response
            const orderResponse = {
                orderId: orderId++,
                status: 'filled',
                originalType: message.type,
                price: message.price,
                quantity: message.quantity,
                processedAt: Date.now(),
                latency: Date.now() - startTime,
                requestId: message.requestId,
                timestamp: Date.now()
            };
            
            // Update order book
            if (message.type === 'BUY') {
                orderBook.bids.push({
                    id: orderResponse.orderId,
                    price: message.price,
                    quantity: message.quantity,
                    timestamp: startTime
                });
                orderBook.bids.sort((a, b) => b.price - a.price);
                orderBook.bids = orderBook.bids.slice(0, 100);
            } else if (message.type === 'SELL') {
                orderBook.asks.push({
                    id: orderResponse.orderId,
                    price: message.price,
                    quantity: message.quantity,
                    timestamp: startTime
                });
                orderBook.asks.sort((a, b) => a.price - b.price);
                orderBook.asks = orderBook.asks.slice(0, 100);
            }
            
            totalProcessed++;
            
            // Send response back (CRITICAL: must include requestId)
            ws.send(JSON.stringify(orderResponse));
            
            // Log occasionally
            if (totalProcessed % 100 === 0) {
                console.log(`📊 Processed ${totalProcessed} orders`);
            }
            
        } catch (error) {
            console.error(`[${clientId}] Parse error:`, error.message);
            ws.send(JSON.stringify({
                status: 'error',
                error: 'Invalid JSON',
                requestId: null
            }));
        }
    });
    
    ws.on('close', () => {
        console.log(`🔌 [${clientId}] Bot disconnected`);
    });
    
    ws.on('error', (err) => {
        console.error(`[${clientId}] WebSocket error:`, err.message);
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.json({
        totalOrdersProcessed: totalProcessed,
        activeBids: orderBook.bids.length,
        activeAsks: orderBook.asks.length,
        bestBid: orderBook.bids[0]?.price || 0,
        bestAsk: orderBook.asks[0]?.price || 0,
        uptime: process.uptime()
    });
});

// Start server
const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Trading engine running on port ${PORT}`);
    console.log(`📡 HTTP: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
});