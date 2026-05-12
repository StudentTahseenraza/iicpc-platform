const { pool } = require('./db');
const bcrypt = require('bcryptjs');

class User {
    static async create({ email, password }) {
        const password_hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
            [email, password_hash]
        );
        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    static async findById(id) {
        const result = await pool.query(
            'SELECT id, email, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    static async validatePassword(user, password) {
        return bcrypt.compare(password, user.password_hash);
    }
}

module.exports = User;