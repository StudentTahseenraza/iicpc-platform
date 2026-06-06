const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { pool } = require('../models/db');

class CleanupService {
    constructor() {
        this.INTERVAL = 5 * 60 * 1000; // 5 minutes
        this.CONTAINER_MAX_AGE = 30 * 60 * 1000; // 30 minutes
        this.IMAGE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
    }

    async start() {
        console.log('🧹 Cleanup service started');
        setInterval(() => this.cleanup(), this.INTERVAL);
        // Run initial cleanup
        await this.cleanup();
    }

    async cleanup() {
        console.log('🧹 Running cleanup...');
        
        await this.cleanupContainers();
        await this.cleanupImages();
        await this.cleanupDatabase();
        await this.cleanupUploads();
        
        console.log('✅ Cleanup completed');
    }

    async cleanupContainers() {
        try {
            // Stop and remove containers older than 30 minutes
            const { stdout } = await execPromise(
                'docker ps -a --filter "status=exited" --filter "status=dead" -q'
            );
            const containers = stdout.trim().split('\n').filter(c => c);
            
            for (const containerId of containers) {
                await execPromise(`docker rm ${containerId}`);
                console.log(`🗑️ Removed container: ${containerId}`);
            }
        } catch (error) {
            console.error('Container cleanup error:', error);
        }
    }

    async cleanupImages() {
        try {
            // Remove dangling images
            const { stdout } = await execPromise('docker images -f "dangling=true" -q');
            const images = stdout.trim().split('\n').filter(i => i);
            
            for (const imageId of images) {
                await execPromise(`docker rmi ${imageId}`);
                console.log(`🗑️ Removed image: ${imageId}`);
            }
        } catch (error) {
            console.error('Image cleanup error:', error);
        }
    }

    async cleanupDatabase() {
        try {
            // Mark old submissions as archived
            await pool.query(`
                UPDATE submissions 
                SET status = 'archived' 
                WHERE status = 'completed' 
                  AND created_at < NOW() - INTERVAL '7 days'
            `);
            
            // Delete old metrics (keep last 30 days)
            await pool.query(`
                DELETE FROM metrics 
                WHERE created_at < NOW() - INTERVAL '30 days'
            `);
            
            console.log('🗑️ Database cleanup completed');
        } catch (error) {
            console.error('Database cleanup error:', error);
        }
    }

    async cleanupUploads() {
        const fs = require('fs');
        const path = require('path');
        const uploadsDir = path.join(__dirname, '../../../uploads');
        
        try {
            const files = fs.readdirSync(uploadsDir);
            const now = Date.now();
            
            for (const file of files) {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;
                
                // Delete uploads older than 1 hour
                if (age > 60 * 60 * 1000) {
                    fs.rmSync(filePath, { recursive: true, force: true });
                    console.log(`🗑️ Removed old upload: ${file}`);
                }
            }
        } catch (error) {
            console.error('Uploads cleanup error:', error);
        }
    }
}

module.exports = CleanupService;