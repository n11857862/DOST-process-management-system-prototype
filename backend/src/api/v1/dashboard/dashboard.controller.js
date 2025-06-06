const dashboardService = require('./dashboard.service');

const fetchOverviewStats = async (req, res, next) => {
    try {
        const userId = req.user.id;
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID not found in request.' });
        }
        const stats = await dashboardService.getOverviewStats(userId);
        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('[DASHBOARD_CONTROLLER] Error fetching overview stats:', error.message);
        next(error); 
    }
};

const fetchRecentActivities = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID not found in request.' });
        }
        if (isNaN(limit) || limit <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid limit parameter for recent activities.' });
        }

        const activities = await dashboardService.getRecentActivities(userId, limit);
        res.status(200).json({
            success: true,
            data: activities
        });
    } catch (error) {
        console.error('[DASHBOARD_CONTROLLER] Error fetching recent activities:', error.message);
        next(error);
    }
};

module.exports = {
    fetchOverviewStats,
    fetchRecentActivities
};