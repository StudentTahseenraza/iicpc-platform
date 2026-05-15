const { pool } = require('./db');

class Submission {
    static async create({ userId, imageName, containerId, containerIp }) {
        const result = await pool.query(
            `INSERT INTO submissions (user_id, image_name, container_id, container_ip, status) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [userId, imageName, containerId, containerIp, 'running']
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
        if (containerIp) {
            updates.push(`container_ip = $${paramIndex++}`);
            values.push(containerIp);
        }
        updates.push(`updated_at = CURRENT_TIMESTAMP`);

        const query = `UPDATE submissions SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        values.push(id);

        const result = await pool.query(query, values);
        return result.rows[0];
    }
    static async findByUser(userId) {
        const result = await pool.query(
            'SELECT * FROM submissions WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    }

    static async findById(id) {
        const result = await pool.query(
            'SELECT * FROM submissions WHERE id = $1',
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