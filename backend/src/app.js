require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const { initDatabase } = require('./models/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const AuthController = require('./auth/auth.controller');
const authenticateToken = require('./auth/jwt.middleware');
const SubmissionController = require('./submission/upload.controller');
const LeaderboardController = require('./leaderboard/leaderboard.controller');
const MetricsService = require('./metrics/metrics.service');
const BotEngine = require('./bot/bot.engine');
const Submission = require('./models/Submission');

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
        
        const targetUrl = `ws://${submission.container_ip}:8080`;
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
            metrics: results
        });
    } catch (error) {
        console.error('Test error:', error);
        await Submission.updateStatus(req.params.submissionId, 'failed');
        res.status(500).json({ error: error.message });
    }
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('subscribe-leaderboard', async () => {
        // Send initial leaderboard
        const leaderboard = await MetricsService.getLeaderboard();
        socket.emit('leaderboard-update', leaderboard);
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

// Initialize database and start server
async function start() {
    await initDatabase();
    
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`✅ Backend server running on port ${PORT}`);
        console.log(`📊 WebSocket server ready for connections`);
    });
}

start();