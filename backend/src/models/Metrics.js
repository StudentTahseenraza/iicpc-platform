const { pool } = require('./db');

class Metrics {
    static async create({ submissionId, p50Latency, p90Latency, p99Latency, tps, errorRate, totalOrders, score }) {
        const result = await pool.query(
            `INSERT INTO metrics (submission_id, p50_latency, p90_latency, p99_latency, tps, error_rate, total_orders, score) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [submissionId, p50Latency, p90Latency, p99Latency, tps, errorRate, totalOrders, score]
        );
        return result.rows[0];
    }

    static async findBySubmission(submissionId) {
        const result = await pool.query(
            'SELECT * FROM metrics WHERE submission_id = $1 ORDER BY created_at DESC',
            [submissionId]
        );
        return result.rows;
    }

    static async getLatestForLeaderboard() {
        const result = await pool.query(
            `SELECT DISTINCT ON (s.id) 
                s.id as submission_id,
                u.email as user_email,
                m.tps,
                m.p50_latency,
                m.p90_latency,
                m.p99_latency,
                m.error_rate,
                m.score,
                m.created_at
             FROM submissions s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN metrics m ON s.id = m.submission_id
             ORDER BY s.id, m.created_at DESC`
        );
        return result.rows;
    }
}

module.exports = Metrics;