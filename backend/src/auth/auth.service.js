const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'iicpc_super_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

class AuthService {
    static generateToken(userId, email) {
        return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }

    static verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }

    static async register(email, password) {
        // Check if user exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            throw new Error('User already exists');
        }

        // Create user
        const user = await User.create({ email, password });
        const token = this.generateToken(user.id, user.email);
        
        return { user: { id: user.id, email: user.email }, token };
    }

    static async login(email, password) {
        const user = await User.findByEmail(email);
        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await User.validatePassword(user, password);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        const token = this.generateToken(user.id, user.email);
        
        return { user: { id: user.id, email: user.email }, token };
    }
}

module.exports = AuthService;