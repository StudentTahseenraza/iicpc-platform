const { pool } = require('../models/db');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class AdminService {
    static async getSystemStatus() {
        const status = {
            timestamp: new Date().toISOString(),
            services: {},
            metrics: {},
            containers: [],
            submissions: {}
        };

        // Check Database
        try {
            const dbResult = await pool.query('SELECT 1 as connected');
            status.services.database = { status: 'healthy', latency: 0 };
        } catch (error) {
            status.services.database = { status: 'unhealthy', error: error.message };
        }

        // Check Redis
        try {
            const Redis = require('ioredis');
            const redis = new Redis({ host: 'localhost', port: 6379 });
            const ping = await redis.ping();
            status.services.redis = { status: ping === 'PONG' ? 'healthy' : 'unhealthy' };
            await redis.quit();
        } catch (error) {
            status.services.redis = { status: 'unhealthy', error: error.message };
        }

        // Get Docker containers - FIXED parsing
        try {
            const { stdout } = await execPromise('docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"');
            const lines = stdout.split('\n');

            // Skip header line (first line)
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const parts = line.split('\t');
                    if (parts.length >= 4) {
                        status.containers.push({
                            name: parts[0] || 'unknown',
                            status: parts[1] || 'unknown',
                            image: parts[2] || 'unknown',
                            ports: parts[3] || 'none'
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Failed to get containers:', error.message);
            status.containers = []; // Ensure containers is always an array
        }

        // Get submission stats
        try {
            const submissionStats = await pool.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
                COUNT(CASE WHEN status = 'testing' THEN 1 END) as testing,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
            FROM submissions
        `);
            status.submissions.stats = submissionStats.rows[0] || { total: 0, running: 0, testing: 0, completed: 0, failed: 0 };
        } catch (error) {
            status.submissions.stats = { total: 0, running: 0, testing: 0, completed: 0, failed: 0 };
        }

        // Get recent submissions
        try {
            const recentSubmissions = await pool.query(`
            SELECT s.id, s.status, s.created_at, u.email, m.score, m.tps
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN metrics m ON s.id = m.submission_id
            ORDER BY s.created_at DESC
            LIMIT 10
        `);
            status.submissions.recent = recentSubmissions.rows || [];
        } catch (error) {
            status.submissions.recent = [];
        }

        // Get system metrics
        try {
            const metrics = await pool.query(`
            SELECT 
                AVG(tps) as avg_tps,
                AVG(score) as avg_score,
                AVG(p99_latency) as avg_p99,
                COUNT(*) as total_tests
            FROM metrics
            WHERE created_at > NOW() - INTERVAL '1 hour'
        `);
            status.metrics = metrics.rows[0] || { avg_tps: 0, avg_score: 0, avg_p99: 0, total_tests: 0 };
        } catch (error) {
            status.metrics = { avg_tps: 0, avg_score: 0, avg_p99: 0, total_tests: 0 };
        }

        return status;
    }

    static async getActiveTests() {
        const result = await pool.query(`
            SELECT s.id, s.status, s.created_at, u.email,
                   EXTRACT(EPOCH FROM (NOW() - s.updated_at)) as running_seconds
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.status IN ('testing', 'running')
            ORDER BY s.created_at DESC
        `);
        return result.rows;
    }

    static async killContainer(submissionId) {
        try {
            const submission = await pool.query(
                'SELECT container_id, container_name FROM submissions WHERE id = $1',
                [submissionId]
            );

            if (submission.rows[0]) {
                const containerName = submission.rows[0].container_name || `submission-${submissionId}`;
                await execPromise(`docker stop ${containerName}`);
                await execPromise(`docker rm ${containerName}`);
                await pool.query(
                    'UPDATE submissions SET status = $1 WHERE id = $2',
                    ['killed', submissionId]
                );
                return { success: true, message: `Container ${containerName} killed` };
            }
            return { success: false, message: 'Submission not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    static async getSystemHealth() {
        const checks = {
            database: false,
            redis: false,
            docker: false,
            websocket: false
        };

        // Check database
        try {
            await pool.query('SELECT 1');
            checks.database = true;
        } catch (err) { }

        // Check Redis
        try {
            const Redis = require('ioredis');
            const redis = new Redis({ host: 'localhost', port: 6379 });
            await redis.ping();
            checks.redis = true;
            await redis.quit();
        } catch (err) { }

        // Check Docker
        try {
            const { stdout } = await execPromise('docker ps');
            checks.docker = stdout.includes('CONTAINER ID');
        } catch (err) { }

        const allHealthy = Object.values(checks).every(v => v === true);

        return {
            status: allHealthy ? 'healthy' : 'degraded',
            checks,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = AdminService;