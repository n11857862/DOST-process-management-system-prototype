const express = require('express');
const {
    adminListApiConfigs,
    userListApiConfigs,
    adminGetApiConfigDetails,
    adminUpdateApiConfigStatus,
    findOrCreateConfigController,
    adminEditApiConfig,
    searchSimilarConfigs,
    shareConfigWithUsers
} = require('./apiConnectionConfig.controller.js');
const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');
const { mongoIdParamValidation } = require('../workflows/workflow.validation.js');
const validateRequest = require('../../core/middlewares/validateRequest.js');

const router = express.Router();

router.get(
    '/admin',
    authenticate,
    authorize(['admin']),
    adminListApiConfigs
);

router.get(
    '/admin/:configId',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('configId'),
    validateRequest,
    adminGetApiConfigDetails
);

router.put(
    '/admin/:configId/status',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('configId'),
    validateRequest,
    adminUpdateApiConfigStatus
);

router.put(
    '/admin/:configId',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('configId'),
    validateRequest,
    adminEditApiConfig
);

router.post(
    '/admin/:configId/share',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('configId'),
    validateRequest,
    shareConfigWithUsers
);

router.get(
    '/',
    authenticate,
    authorize(['manager', 'admin']),
    userListApiConfigs
);

router.get(
    '/search',
    authenticate,
    authorize(['manager', 'admin']),
    searchSimilarConfigs
);

router.post(
    '/find-or-create',
    authenticate,
    authorize(['manager', 'admin']),
    validateRequest,
    findOrCreateConfigController
);

module.exports = router;