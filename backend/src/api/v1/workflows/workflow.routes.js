const express = require('express');
const { createWorkflow, listWorkflows, getWorkflowById, updateWorkflow, deleteWorkflow } = require('./workflow.controller.js'); 
const { workflowValidationRules, updateWorkflowValidationRules, mongoIdParamValidation } = require('./workflow.validation.js'); 
const validateRequest = require('../../core/middlewares/validateRequest.js');
const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');

const router = express.Router();

router.post(
    '/',
    authenticate,
    authorize(['manager', 'admin']),
    workflowValidationRules(),
    validateRequest,
    createWorkflow
);

router.get(
    '/',
    authenticate,
    authorize(['manager', 'admin']),
    listWorkflows
);

router.get(
    '/:id',
    authenticate,
    authorize(['manager', 'admin']),
    getWorkflowById
);

router.put(
    '/:id',
    authenticate,
    authorize(['manager', 'admin']),
    updateWorkflowValidationRules(),
    validateRequest,
    updateWorkflow
);

router.delete(
    '/:id',
    authenticate,
    authorize(['manager', 'admin']),
    mongoIdParamValidation(),
    validateRequest,
    deleteWorkflow
);

module.exports = router;