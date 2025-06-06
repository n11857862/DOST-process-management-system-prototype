const express = require('express');
const { 
    startWorkflow, 
    submitFileForNodeAction,
    adminGetAllInstances,
    adminGetSingleInstanceDetails,
    adminTerminateSingleInstance,
    adminRetryFailedInstance,
    getAllInstances,
} = require('./workflowInstance.controller.js');
const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');
const { query, body, param } = require('express-validator');
const { mongoIdParamValidation } = require('../workflows/workflow.validation.js');
const validateRequest = require('../../core/middlewares/validateRequest.js');
const { INSTANCE_STATUS } = require('./workflowInstance.model');



const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    [
        query('status').optional().isString().custom(value => {
            const statuses = value.split(',').map(s => s.trim());
            for (const s of statuses) {
                if (!INSTANCE_STATUS.includes(s)) {
                    throw new Error(`Invalid status value: ${s}. Allowed: ${INSTANCE_STATUS.join(', ')}`);
                }
            }
            return true;
        }),
        query('workflowDefinitionId').optional().isMongoId().withMessage('Invalid workflowDefinitionId format.'),
        query('startedBy').optional().isMongoId().withMessage('Invalid startedBy user ID format.'),
        query('dateFrom').optional().isISO8601().toDate().withMessage('Invalid dateFrom format (YYYY-MM-DD).'),
        query('dateTo').optional().isISO8601().toDate().withMessage('Invalid dateTo format (YYYY-MM-DD).'),
        query('page').optional().isInt({ min: 1 }).toInt().withMessage('Page must be a positive integer.'),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100.'),
        query('sortBy').optional().isString().trim().isIn(['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'status'])
            .withMessage('Invalid sortBy field.'),
        query('sortOrder').optional().isString().trim().isIn(['asc', 'desc']).withMessage('sortOrder must be "asc" or "desc".'),
        query('staffTaskView').optional().isBoolean().withMessage('staffTaskView must be a boolean value.')
    ],
    validateRequest,
    getAllInstances 
);

router.post(
    '/start',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    startWorkflow
);

router.post(
    '/:instanceId/nodes/:nodeId/submit-file',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    submitFileForNodeAction
);

router.get(
    '/admin/all',
    authenticate,
    authorize(['admin']),
    adminGetAllInstances
);

router.get(
    '/admin/:instanceId/details',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('instanceId'),
    validateRequest,
    adminGetSingleInstanceDetails
);

router.post(
    '/admin/:instanceId/terminate',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('instanceId'),
    validateRequest,
    adminTerminateSingleInstance
);

router.post(
    '/admin/:instanceId/retry',
    authenticate,
    authorize(['admin']),
    mongoIdParamValidation('instanceId'),
    validateRequest,
    adminRetryFailedInstance
);



module.exports = router;