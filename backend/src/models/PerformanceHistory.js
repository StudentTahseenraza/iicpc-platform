const { pool } = require('./db');

class PerformanceHistory {
    // Save test result to history
    static async save(submissionId, metrics, botCount, duration) {
        const result = await pool.query(
            `INSERT INTO performance_history 
             (submission_id, bot_count, duration, tps, p50_latency, p90_latency, p99_latency, error_rate, correctness_score, total_score, timestamp)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
             RETURNING *`,
            [
                submissionId, 
                botCount, 
                duration, 
                metrics.tps, 
                metrics.p50, 
                metrics.p90, 
                metrics.p99, 
                metrics.errorRate,
                metrics.correctnessScore || 0,
                metrics.score
            ]
        );
        return result.rows[0];
    }

    // Get performance trends for a submission
    static async getTrends(submissionId, hours = 24) {
        const result = await pool.query(
            `SELECT 
                DATE_TRUNC('hour', timestamp) as hour,
                AVG(tps) as avg_tps,
                AVG(p99_latency) as avg_p99,
                AVG(total_score) as avg_score,
                COUNT(*) as test_count,
                MAX(tps) as max_tps,
                MIN(p99_latency) as min_p99
             FROM performance_history
             WHERE submission_id = $1 
               AND timestamp > NOW() - INTERVAL '${hours} hours'
             GROUP BY DATE_TRUNC('hour', timestamp)
             ORDER BY hour DESC`,
            [submissionId]
        );
        return result.rows;
    }

    // Get leaderboard with historical best
    static async getLeaderboardWithHistory() {
        const result = await pool.query(
            `SELECT DISTINCT ON (s.id)
                s.id as submission_id,
                u.email as user_email,
                ph.tps,
                ph.p99_latency,
                ph.error_rate,
                ph.total_score,
                ph.timestamp,
                (
                    SELECT MAX(total_score) 
                    FROM performance_history 
                    WHERE submission_id = s.id
                ) as best_score,
                (
                    SELECT COUNT(*) 
                    FROM performance_history 
                    WHERE submission_id = s.id
                ) as test_count
             FROM submissions s
             JOIN users u ON s.user_id = u.id
             JOIN performance_history ph ON s.id = ph.submission_id
             ORDER BY s.id, ph.total_score DESC`
        );
        return result.rows;
    }

    // Get performance comparison between two submissions
    static async compare(submissionId1, submissionId2) {
        const result = await pool.query(
            `SELECT 
                'submission_1' as label,
                AVG(tps) as avg_tps,
                AVG(p99_latency) as avg_p99,
                AVG(total_score) as avg_score
             FROM performance_history
             WHERE submission_id = $1
             UNION ALL
             SELECT 
                'submission_2' as label,
                AVG(tps) as avg_tps,
                AVG(p99_latency) as avg_p99,
                AVG(total_score) as avg_score
             FROM performance_history
             WHERE submission_id = $2`,
            [submissionId1, submissionId2]
        );
        return result.rows;
    }

    // Get best performance ever
    static async getGlobalBest() {
        const result = await pool.query(
            `SELECT 
                ph.*,
                u.email as user_email,
                s.id as submission_id
             FROM performance_history ph
             JOIN submissions s ON ph.submission_id = s.id
             JOIN users u ON s.user_id = u.id
             ORDER BY ph.total_score DESC
             LIMIT 10`
        );
        return result.rows;
    }
}

module.exports = PerformanceHistory;