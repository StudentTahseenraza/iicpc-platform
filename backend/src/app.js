// At the VERY TOP of app.js
process.setMaxListeners(1000);
require('events').EventEmitter.defaultMaxListeners = 1000;

// Fix for WebSocket module
const WebSocket = require('ws');
if (WebSocket && WebSocket.prototype) {
    WebSocket.prototype.setMaxListeners = function(n) {
        this._maxListeners = n;
        return this;
    };
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { initDatabase } = require('./models/db');

// Add at the top with other imports
const OrderMatchingValidator = require('./validation/orderMatching.validator');
const PerformanceHistory = require('./models/PerformanceHistory');
const CleanupService = require('./services/cleanup.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Middleware
// Increase body size limits
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use(cors());

// Import routes
const AuthController = require('./auth/auth.controller');
const authenticateToken = require('./auth/jwt.middleware');
const SubmissionController = require('./submission/upload.controller');
const LeaderboardController = require('./leaderboard/leaderboard.controller');
const MetricsService = require('./metrics/metrics.service');
const BotEngine = require('./bot/bot.engine');
const Submission = require('./models/Submission');

const { MetricsExporter } = require('./metrics/metrics.exporter');

const AdminController = require('./admin/admin.controller');



// ============ PHASE 2 IMPORTS ============
const EventBus = require('./events/event-bus');
const AdvancedBotEngine = require('./bot/advanced.bot.engine');
// ==========================================

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add after database initialization
const cleanupService = new CleanupService();
cleanupService.start();


// Auth routes
app.post('/api/auth/register', AuthController.register);
app.post('/api/auth/login', AuthController.login);

// Submission routes
app.post('/api/submissions/upload', authenticateToken, SubmissionController.upload);
app.get('/api/submissions/:id/status', authenticateToken, SubmissionController.getStatus);
app.get('/api/submissions/user', authenticateToken, SubmissionController.getUserSubmissions);

// Leaderboard routes
app.get('/api/leaderboard', LeaderboardController.getLeaderboard);
app.get('/api/metrics/:id', authenticateToken, LeaderboardController.getSubmissionMetrics);

// Test endpoint (trigger bot test)
app.post('/api/test/:submissionId', authenticateToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.submissionId);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }
        
        // Update status to testing
        await Submission.updateStatus(submission.id, 'testing');
        
        // Extract IP and port from container_ip (format: "localhost:32769")
        let targetUrl;
        if (submission.container_ip && submission.container_ip.includes(':')) {
            const [ip, port] = submission.container_ip.split(':');
            targetUrl = `ws://${ip}:${port}`;
        } else {
            targetUrl = `ws://${submission.container_ip || 'localhost'}:8080`;
        }
        
        console.log(`🎯 Targeting bot fleet at: ${targetUrl}`);
        
        const botCount = parseInt(req.body.botCount) || 100;
        const duration = parseInt(req.body.duration) || 30;
        
        const botEngine = new BotEngine();
        const results = await botEngine.launchBots(targetUrl, botCount, duration);
        
        // Save metrics
        await MetricsService.saveMetrics(submission.id, results);
        
        // Update submission status
        await Submission.updateStatus(submission.id, 'completed');
        
        // Broadcast to all connected clients
        io.emit('test-completed', {
            submissionId: submission.id,
            metrics: results
        });
        
        res.json({
            success: true,
            metrics: results,
            targetUrl: targetUrl
        });
    } catch (error) {
        console.error('Test error:', error);
        await Submission.updateStatus(req.params.submissionId, 'failed');
        res.status(500).json({ error: error.message });
    }
});

// Admin routes (protected - add admin check middleware)
app.get('/api/admin/status', AdminController.getStatus);
app.get('/api/admin/active-tests', AdminController.getActiveTests);
app.post('/api/admin/kill/:submissionId', AdminController.killContainer);
app.get('/api/admin/health', AdminController.getHealth);
app.get('/api/admin/metrics', AdminController.getMetrics);

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', prometheus.register.contentType);
    res.end(await MetricsExporter.getMetrics());
});

MetricsExporter.collectMetrics();

// ============ PHASE 2 - Advanced Test Endpoint ============
app.post('/api/test/advanced/:submissionId', authenticateToken, async (req, res) => {
    try {
        const submission = await Submission.findById(req.params.submissionId);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Update status to testing
        await Submission.updateStatus(submission.id, 'testing');

        const targetUrl = `ws://${submission.container_ip}:${submission.port || 8080}`;
        const botCount = parseInt(req.body.botCount) || 1000;
        const duration = parseInt(req.body.duration) || 60;
        const strategyDistribution = req.body.strategyDistribution || {
            market_maker: 0.5,
            arbitrage: 0.3,
            random_walk: 0.2
        };

        // Use Advanced Bot Engine with multiple strategies
        const advancedBotEngine = new AdvancedBotEngine();
        const results = await advancedBotEngine.launchBots(targetUrl, botCount, duration, strategyDistribution);

        // Calculate score with correctness
        const score = advancedBotEngine.calculateCorrectnessScore(results);
        results.score = score;

        // Save metrics
        await MetricsService.saveMetrics(submission.id, results);

        // Update submission status
        await Submission.updateStatus(submission.id, 'completed');

        // Broadcast to all connected clients
        io.emit('test-completed', {
            submissionId: submission.id,
            metrics: results,
            isAdvanced: true
        });

        // Publish to event bus
        if (global.eventBus) {
            await global.eventBus.publish(EventBus.TOPICS.TEST_COMPLETED, {
                submissionId: submission.id,
                metrics: results,
                containerIP: submission.container_ip,
                port: submission.port || 8080
            });
        }

        res.json({
            success: true,
            metrics: results,
            message: `Advanced test completed with ${botCount} bots using multiple strategies`
        });
    } catch (error) {
        console.error('Advanced test error:', error);
        await Submission.updateStatus(req.params.submissionId, 'failed');
        res.status(500).json({ error: error.message });
    }
});


// Add new endpoint for performance trends
app.get('/api/performance/trends/:submissionId', authenticateToken, async (req, res) => {
    try {
        const trends = await PerformanceHistory.getTrends(req.params.submissionId);
        res.json(trends);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/performance/leaderboard/history', authenticateToken, async (req, res) => {
    try {
        const leaderboard = await PerformanceHistory.getLeaderboardWithHistory();
        res.json(leaderboard);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/performance/global-best', authenticateToken, async (req, res) => {
    try {
        const best = await PerformanceHistory.getGlobalBest();
        res.json(best);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ PHASE 2 - Event Bus Setup ============
let eventBus = null;
let advancedBotEngine = null;

async function setupEventBus() {
    try {
        eventBus = new EventBus();
        global.eventBus = eventBus;

        // Start event bus listener
        await eventBus.startListening();
        console.log('✅ Event Bus listening for messages');

        // Initialize advanced bot engine
        advancedBotEngine = new AdvancedBotEngine();

        // Subscribe to container ready events (auto-test)
        eventBus.subscribe(EventBus.TOPICS.CONTAINER_READY, async (event) => {
            console.log(`📦 Container ready event received for submission: ${event.submissionId}`);
            console.log(`📍 Container at: ${event.containerIP}:${event.port}`);

            try {
                // Auto-start test when container is ready
                const targetUrl = `ws://${event.containerIP}:${event.port}`;
                const botCount = event.botCount || 500;
                const duration = event.duration || 30;

                console.log(`🚀 Auto-starting test with ${botCount} bots for ${duration}s`);

                const results = await advancedBotEngine.launchBots(targetUrl, botCount, duration);

                // Save metrics
                await MetricsService.saveMetrics(event.submissionId, results);

                // Update submission status
                await Submission.updateStatus(event.submissionId, 'completed');

                // Broadcast to WebSocket clients
                io.emit('test-completed', {
                    submissionId: event.submissionId,
                    metrics: results,
                    autoStarted: true
                });

                // Publish test completed event
                await eventBus.publish(EventBus.TOPICS.TEST_COMPLETED, {
                    submissionId: event.submissionId,
                    metrics: results
                });

                console.log(`✅ Auto-test completed for submission ${event.submissionId}`);
            } catch (error) {
                console.error(`Auto-test failed for submission ${event.submissionId}:`, error);
                await Submission.updateStatus(event.submissionId, 'failed');
                await eventBus.publish(EventBus.TOPICS.TEST_FAILED, {
                    submissionId: event.submissionId,
                    error: error.message
                });
            }
        });

        // Subscribe to test completed events for leaderboard updates
        eventBus.subscribe(EventBus.TOPICS.TEST_COMPLETED, async (event) => {
            console.log(`✅ Test completed event for submission ${event.submissionId}`);

            // Update leaderboard via WebSocket
            const leaderboard = await MetricsService.getLeaderboard();
            io.emit('leaderboard-update', leaderboard);
        });

        // Subscribe to submission uploaded events
        eventBus.subscribe(EventBus.TOPICS.SUBMISSION_UPLOADED, async (event) => {
            console.log(`📝 Submission uploaded event: ${event.submissionId}`);

            // You can add additional processing here
            // For example: validate code, scan for malware, etc.
        });

        // Subscribe to container failed events
        eventBus.subscribe(EventBus.TOPICS.CONTAINER_FAILED, async (event) => {
            console.error(`❌ Container failed for submission ${event.submissionId}: ${event.error}`);
            await Submission.updateStatus(event.submissionId, 'failed');
            io.emit('container-failed', {
                submissionId: event.submissionId,
                error: event.error
            });
        });

        console.log('✅ Event Bus subscriptions configured');

    } catch (error) {
        console.error('Failed to setup Event Bus:', error);
    }
}

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('subscribe-leaderboard', async () => {
        // Send initial leaderboard
        const leaderboard = await MetricsService.getLeaderboard();
        socket.emit('leaderboard-update', leaderboard);
    });

    socket.on('subscribe-events', () => {
        console.log('Client subscribed to events:', socket.id);
        socket.emit('subscribed', { status: 'ok', message: 'Subscribed to events' });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Update leaderboard every 5 seconds
setInterval(async () => {
    const leaderboard = await MetricsService.getLeaderboard();
    io.emit('leaderboard-update', leaderboard);
}, 5000);

// ============ PHASE 2 - Health Check with Instance Info ============
app.get('/api/health/instance', (req, res) => {
    res.json({
        status: 'ok',
        instanceId: process.env.INSTANCE_ID || 'single',
        phase: '2',
        features: {
            eventBus: !!eventBus,
            advancedBotEngine: !!advancedBotEngine,
            redisPubSub: !!(eventBus && eventBus.publisher)
        },
        timestamp: new Date().toISOString()
    });
});

// Get event bus status
app.get('/api/status/events', authenticateToken, async (req, res) => {
    res.json({
        eventBusActive: !!eventBus,
        subscriptions: eventBus ? Array.from(eventBus.handlers.keys()) : [],
        instanceId: process.env.INSTANCE_ID || 'single'
    });
});

// ============ Initialize and Start Server ============
async function start() {
    // Initialize database
    await initDatabase();

    // Setup Event Bus (Phase 2)
    await setupEventBus();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`✅ Backend server running on port ${PORT}`);
        console.log(`📊 WebSocket server ready for connections`);
        console.log(`🔧 Instance ID: ${process.env.INSTANCE_ID || 'single'}`);
        console.log(`🚀 Phase 2 features: ${eventBus ? 'ENABLED' : 'DISABLED'}`);

        if (eventBus) {
            console.log(`📡 Redis Pub/Sub: ACTIVE`);
            console.log(`🎯 Advanced Bot Engine: READY`);
            console.log(`🔄 Multi-strategy testing: AVAILABLE`);
        }
    });
}

start();

module.exports = { app, server, io, eventBus };