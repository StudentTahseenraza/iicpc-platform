const MetricsService = require('../metrics/metrics.service');

class LeaderboardController {
    static async getLeaderboard(req, res) {
        try {
            const leaderboard = await MetricsService.getLeaderboard();
            res.json(leaderboard);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    
    static async getSubmissionMetrics(req, res) {
        try {
            const metrics = await MetricsService.getSubmissionMetrics(req.params.id);
            res.json(metrics);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = LeaderboardController;