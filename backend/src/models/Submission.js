const { pool } = require('./db');

class Submission {
    static async create({ userId, imageName, containerId, containerIp }) {
        const result = await pool.query(
            `INSERT INTO submissions (user_id, image_name, container_id, container_ip, status) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, imageName || null, containerId || null, containerIp || null, 'pending']
        );
        return result.rows[0];
    }

    static async updateStatus(id, status, imageName = null, containerIp = null) {
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (status) {
            updates.push(`status = $${paramIndex++}`);
            values.push(status);
        }
        if (imageName !== null && imageName !== undefined) {
            updates.push(`image_name = $${paramIndex++}`);
            values.push(imageName);
        }
        if (containerIp !== null && containerIp !== undefined) {
            updates.push(`container_ip = $${paramIndex++}`);
            values.push(containerIp);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        const query = `UPDATE submissions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        values.push(id);
        
        const result = await pool.query(query, values);
        return result.rows[0];
    }

    static async updateWithPort(id, status, containerIp, port) {
        // Store port as part of container_ip with format "localhost:32769"
        const ipWithPort = `${containerIp}:${port}`;
        return this.updateStatus(id, status, null, ipWithPort);
    }

    static async getContainerUrl(submission) {
        if (submission.container_ip && submission.container_ip.includes(':')) {
            return submission.container_ip;
        }
        return `${submission.container_ip}:8080`;
    }

    static async findByUser(userId) {
        const result = await pool.query(
            `SELECT s.*, 
                    m.tps, 
                    m.p99_latency,
                    m.score as metric_score
             FROM submissions s 
             LEFT JOIN metrics m ON s.id = m.submission_id 
             WHERE s.user_id = $1 
             ORDER BY s.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query(
            `SELECT s.*, 
                    m.tps, 
                    m.p99_latency,
                    m.score as metric_score
             FROM submissions s 
             LEFT JOIN metrics m ON s.id = m.submission_id 
             WHERE s.id = $1`,
            [id]
        );
        return result.rows[0];
    }

    static async getAll() {
        const result = await pool.query(
            `SELECT s.*, u.email as user_email 
             FROM submissions s 
             JOIN users u ON s.user_id = u.id 
             ORDER BY s.created_at DESC`
        );
        return result.rows;
    }
}

module.exports = Submission;