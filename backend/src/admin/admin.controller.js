const AdminService = require('./admin.service');

class AdminController {
    static async getStatus(req, res) {
        try {
            // Check if user is admin (you can add admin role check)
            const status = await AdminService.getSystemStatus();
            res.json(status);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getActiveTests(req, res) {
        try {
            const tests = await AdminService.getActiveTests();
            res.json(tests);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async killContainer(req, res) {
        try {
            const { submissionId } = req.params;
            const result = await AdminService.killContainer(submissionId);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getHealth(req, res) {
        try {
            const health = await AdminService.getSystemHealth();
            res.json(health);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getMetrics(req, res) {
        try {
            const { pool } = require('../models/db');
            
            // Get detailed metrics
            const metrics = await pool.query(`
                SELECT 
                    DATE_TRUNC('hour', created_at) as hour,
                    AVG(tps) as avg_tps,
                    AVG(p99_latency) as avg_p99,
                    AVG(score) as avg_score,
                    COUNT(*) as test_count
                FROM metrics
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY DATE_TRUNC('hour', created_at)
                ORDER BY hour DESC
            `);
            
            res.json(metrics.rows);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = AdminController;