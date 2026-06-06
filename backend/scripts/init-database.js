const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'iicpc_platform',
});

async function initDatabase() {
    const client = await pool.connect();
    try {
        console.log('🚀 Starting database initialization...');

        // Create users table
        console.log('📊 Creating users table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');

        // Create submissions table
        console.log('📊 Creating submissions table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(50) DEFAULT 'pending',
                image_name VARCHAR(255),
                container_id VARCHAR(255),
                container_ip VARCHAR(50),
                container_port INTEGER,
                port INTEGER,
                score FLOAT,
                tps INTEGER,
                p99_latency FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Submissions table created');

        // Create metrics table
        console.log('📊 Creating metrics table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS metrics (
                id SERIAL PRIMARY KEY,
                submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
                p50_latency FLOAT,
                p90_latency FLOAT,
                p99_latency FLOAT,
                tps INTEGER,
                error_rate FLOAT,
                total_orders INTEGER,
                score FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Metrics table created');

        // Create performance_history table
        console.log('📊 Creating performance_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_history (
                id SERIAL PRIMARY KEY,
                submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
                bot_count INTEGER,
                duration INTEGER,
                tps INTEGER,
                p50_latency FLOAT,
                p90_latency FLOAT,
                p99_latency FLOAT,
                error_rate FLOAT,
                correctness_score FLOAT,
                total_score FLOAT,
                timestamp TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Performance_history table created');

        // Create test_history table
        console.log('📊 Creating test_history table...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS test_history (
                id SERIAL PRIMARY KEY,
                submission_id INTEGER REFERENCES submissions(id) ON DELETE CASCADE,
                bot_count INTEGER,
                duration INTEGER,
                tps INTEGER,
                p50 FLOAT,
                p90 FLOAT,
                p99 FLOAT,
                error_rate FLOAT,
                score FLOAT,
                timestamp TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✅ Test_history table created');

        // Create indexes
        console.log('📊 Creating indexes...');
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_metrics_submission ON metrics(submission_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_perf_submission ON performance_history(submission_id)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_perf_timestamp ON performance_history(timestamp)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_perf_score ON performance_history(total_score DESC)`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_test_history_submission ON test_history(submission_id)`);
        console.log('✅ All indexes created');

        console.log('🎉 Database initialization complete!');

        // Verify tables
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        console.log('\n📋 Tables created:');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

initDatabase();