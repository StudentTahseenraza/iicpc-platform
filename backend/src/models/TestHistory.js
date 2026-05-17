const { pool } = require('./db');

class TestHistory {
    static async create({ submissionId, botCount, duration, metrics, strategyDistribution }) {
        const result = await pool.query(
            `INSERT INTO test_history (submission_id, bot_count, duration, tps, p50, p90, p99, error_rate, score, strategy_distribution, timestamp) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING *`,
            [submissionId, botCount, duration, metrics.tps, metrics.p50, metrics.p90, metrics.p99, metrics.errorRate, metrics.score, JSON.stringify(strategyDistribution || {})]
        );
        return result.rows[0];
    }

    static async getHistory(submissionId, limit = 20) {
        const result = await pool.query(
            `SELECT * FROM test_history 
             WHERE submission_id = $1 
             ORDER BY timestamp DESC 
             LIMIT $2`,
            [submissionId, limit]
        );
        return result.rows;
    }

    static async getGlobalHistory(limit = 50) {
        const result = await pool.query(
            `SELECT th.*, u.email as user_email, s.status
             FROM test_history th
             JOIN submissions s ON th.submission_id = s.id
             JOIN users u ON s.user_id = u.id
             ORDER BY th.timestamp DESC
             LIMIT $1`,
            [limit]
        );
        return result.rows;
    }

    static async getPerformanceTrend(submissionId, hours = 24) {
        const result = await pool.query(
            `SELECT 
                DATE_TRUNC('hour', timestamp) as hour,
                AVG(tps) as avg_tps,
                AVG(score) as avg_score,
                AVG(p99) as avg_p99,
                COUNT(*) as test_count
             FROM test_history
             WHERE submission_id = $1 
               AND timestamp > NOW() - INTERVAL '${hours} hours'
             GROUP BY DATE_TRUNC('hour', timestamp)
             ORDER BY hour DESC`,
            [submissionId]
        );
        return result.rows;
    }
}

module.exports = TestHistory;