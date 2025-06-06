const express = require('express');
const dashboardController = require('./dashboard.controller');
const authenticate = require('../../core/middlewares/authenticate');

const router = express.Router();

router.get(
    '/stats',
    authenticate,
    dashboardController.fetchOverviewStats
);

router.get(
    '/activities',
    authenticate,
    dashboardController.fetchRecentActivities
);

module.exports = router;