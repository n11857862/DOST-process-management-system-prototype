const express = require('express');
const { 
    reportTaskIssue,
    listIssues,
    getIssueDetails,
    addManagerComment,
    updateIssueStatusAction
} = require('./issue.controller.js');
const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');
const { mongoIdParamValidation } = require('../workflows/workflow.validation.js');
const { body } = require('express-validator');
const validateRequest = require('../../core/middlewares/validateRequest.js');
const { USER_ROLES } = require('../users/user.model.js');

const router = express.Router();

const reportIssueValidationRules = () => [
    body('taskId').isMongoId().withMessage('Valid Task ID is required.'),
    body('description').trim().notEmpty().withMessage('Issue description is required.')
];

router.post(
    '/', 
    authenticate,
    authorize([
        USER_ROLES.find(r => r === 'staff') || 'staff', 
        USER_ROLES.find(r => r === 'manager') || 'manager',
        USER_ROLES.find(r => r === 'admin') || 'admin'
    ]), 
    reportIssueValidationRules(),
    validateRequest,
    reportTaskIssue 
);

router.get(
    '/',
    authenticate,
    authorize([USER_ROLES.find(r => r === 'manager') || 'manager', USER_ROLES.find(r => r === 'admin') || 'admin']),
    listIssues
);

router.get(
    '/:issueId',
    authenticate,
    authorize([USER_ROLES.find(r => r === 'manager') || 'manager', USER_ROLES.find(r => r === 'admin') || 'admin']),
    mongoIdParamValidation('issueId'),
    validateRequest,
    getIssueDetails
);

router.post(
    '/:issueId/comments',
    authenticate,
    authorize([USER_ROLES.find(r => r === 'manager') || 'manager', USER_ROLES.find(r => r === 'admin') || 'admin']),
    mongoIdParamValidation('issueId'),
    [ body('comment').trim().notEmpty().withMessage('Comment text is required.') ],
    validateRequest,
    addManagerComment
);

router.put(
    '/:issueId/status',
    authenticate,
    authorize([USER_ROLES.find(r => r === 'manager') || 'manager', USER_ROLES.find(r => r === 'admin') || 'admin']),
    mongoIdParamValidation('issueId'),
    [ 
        body('status').trim().notEmpty().withMessage('New status is required.'),
        body('resolutionDetails').optional().trim()
    ],
    validateRequest,
    updateIssueStatusAction
);

module.exports = router;