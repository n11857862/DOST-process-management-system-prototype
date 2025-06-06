
const express = require('express');
const path = require('path');
const taskController = require('./task.controller.js');

const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');
const { mongoIdParamValidation, validate } = require('../workflows/workflow.validation.js');
const validateRequest = require('../../core/middlewares/validateRequest.js');
const { reassignTaskValidationRules } = require('../auth/auth.validation.js');
const { USER_ROLES } = require('../users/user.model');
const router = express.Router();
const { body } = require('express-validator');

router.get(
    '/',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    taskController.getTasks
);

router.get(
    '/:taskId',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    mongoIdParamValidation('taskId'),
    validate,
    taskController.getTaskDetails
);

router.post(
    '/:taskId/complete',
    authenticate,
    taskController.completeTaskAction
);

router.post(
    '/:taskId/reject',
    authenticate,
    taskController.rejectTaskAction
);

router.post(
    '/:taskId/approve',
    authenticate,
    taskController.approveTaskControllerAction
);

router.post(
    '/:taskId/deny',
    authenticate,
    taskController.denyTaskControllerAction
);

router.post(
    '/:taskId/claim',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    mongoIdParamValidation('taskId'),
    validateRequest,
    taskController.claimTaskAction
);

router.post(
    '/:taskId/unclaim',
    authenticate,
    authorize(['staff', 'manager', 'admin']),
    mongoIdParamValidation('taskId'),
    validateRequest,
    taskController.unclaimTaskAction
);

router.put(
    '/:taskId/reassign',
    authenticate,
    authorize(['manager', 'admin']),
    mongoIdParamValidation('taskId'),
    reassignTaskValidationRules(),
    validateRequest,
    taskController.reassignTaskAction
);

router.delete(
    '/admin/tasks/:taskId',
    authenticate,
    authorize([USER_ROLES.find(role => role === 'admin') || 'admin']),
    mongoIdParamValidation('taskId'),
    validateRequest,
    taskController.adminDeleteTaskAction
);

router.post(
    '/:taskId/generate-document',
    authenticate,
    authorize([
        USER_ROLES.find(r => r === 'staff') || 'staff', 
        USER_ROLES.find(r => r === 'manager') || 'manager', 
        USER_ROLES.find(r => r === 'admin') || 'admin'
    ]),
    mongoIdParamValidation('taskId'),
    [
        body('templateString')
            .trim()
            .notEmpty().withMessage('templateString is required in the request body.')
            .isString().withMessage('templateString must be a string.')
    ],
    validateRequest,
    taskController.generateTaskDocumentController
);




module.exports = router;
