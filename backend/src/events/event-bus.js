const Redis = require('ioredis');

class EventBus {
    constructor() {
        this.publisher = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            retryStrategy: (times) => Math.min(times * 50, 2000)
        });
        
        this.subscriber = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            retryStrategy: (times) => Math.min(times * 50, 2000)
        });
        
        this.handlers = new Map();
        console.log('✅ Event Bus initialized (Redis Pub/Sub)');
    }
    
    // Topics
    static TOPICS = {
        // Submission flow
        SUBMISSION_UPLOADED: 'submission.uploaded',
        SUBMISSION_VALIDATED: 'submission.validated',
        
        // Container lifecycle
        CONTAINER_BUILDING: 'container.building',
        CONTAINER_READY: 'container.ready',
        CONTAINER_FAILED: 'container.failed',
        CONTAINER_DESTROYED: 'container.destroyed',
        
        // Testing flow
        TEST_STARTED: 'test.started',
        TEST_COMPLETED: 'test.completed',
        TEST_FAILED: 'test.failed',
        
        // Metrics flow
        METRICS_BATCH: 'metrics.batch',
        METRICS_AGGREGATED: 'metrics.aggregated',
        
        // Leaderboard
        LEADERBOARD_UPDATED: 'leaderboard.updated'
    };
    
    async publish(topic, event) {
        try {
            const message = JSON.stringify({
                ...event,
                timestamp: Date.now(),
                instanceId: process.env.INSTANCE_ID || 'single'
            });
            await this.publisher.publish(topic, message);
            console.log(`📡 Published to ${topic}:`, event.submissionId || event.id);
        } catch (error) {
            console.error(`Failed to publish to ${topic}:`, error);
        }
    }
    
    async subscribe(topic, handler) {
        if (!this.handlers.has(topic)) {
            this.handlers.set(topic, []);
            await this.subscriber.subscribe(topic);
            console.log(`🔔 Subscribed to: ${topic}`);
        }
        
        this.handlers.get(topic).push(handler);
    }
    
    async startListening() {
    this.subscriber.on('message', (channel, message) => {
        const handlers = this.handlers.get(channel);
        if (handlers && handlers.length > 0) {
            try {
                const event = JSON.parse(message);
                console.log(`📨 Received event on ${channel}:`, event.submissionId || event.id);
                handlers.forEach(handler => {
                    try {
                        handler(event);
                    } catch (err) {
                        console.error(`Error in handler for ${channel}:`, err);
                    }
                });
            } catch (error) {
                console.error(`Error parsing message on ${channel}:`, error);
            }
        }
    });
    console.log('✅ Event Bus listening started');
    }
}

module.exports = EventBus;