const Metrics = require('../models/Metrics');

class MetricsService {
    static async saveMetrics(submissionId, testResults) {
        const metrics = await Metrics.create({
            submissionId,
            p50Latency: testResults.p50,
            p90Latency: testResults.p90,
            p99Latency: testResults.p99,
            tps: testResults.tps,
            errorRate: testResults.errorRate,
            totalOrders: testResults.totalOrders,
            score: testResults.score
        });
        
        return metrics;
    }
    
    static async getLeaderboard() {
        const submissions = await Metrics.getLatestForLeaderboard();
        
        // Filter out submissions with no metrics
        const ranked = submissions
            .filter(s => s.score !== null)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map((submission, index) => ({
                rank: index + 1,
                userId: submission.user_email,
                tps: submission.tps || 0,
                p50Latency: submission.p50_latency || 0,
                p90Latency: submission.p90_latency || 0,
                p99Latency: submission.p99_latency || 0,
                errorRate: submission.error_rate || 0,
                score: submission.score || 0,
                testedAt: submission.created_at
            }));
        
        return ranked;
    }
    
    static async getSubmissionMetrics(submissionId) {
        return await Metrics.findBySubmission(submissionId);
    }
}

module.exports = MetricsService;