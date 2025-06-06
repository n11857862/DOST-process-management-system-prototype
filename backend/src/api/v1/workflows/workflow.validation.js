const { body, param, validationResult } = require('express-validator');

const NODE_TYPES = [
    'Task', 'Decision', 'Approval', 'AutomatedTask',
    'FileUpload', 'SubWorkflow', 'Start', 'End', 'Notification', 'ParallelSplit', 'ParallelJoin', 'Timer'
];

const workflowValidationRules = () => {
  return [
    body('name')
      .trim()
      .notEmpty().withMessage('Workflow name is required.')
      .isString().withMessage('Workflow name must be a string.'),

    body('description')
      .optional()
      .trim()
      .isString().withMessage('Description must be a string.'),

    body('flow')
      .notEmpty().withMessage('Flow data (nodes and edges) is required.')
      .isObject().withMessage('Flow data must be an object.'),

    body('flow.nodes')
      .isArray({ min: 1 }).withMessage('Workflow must have at least one node in flow.nodes.'),
    
    body('flow.nodes.*.id')
      .notEmpty().withMessage('Each node must have an ID.')
      .isString().withMessage('Node ID must be a string.'),
    body('flow.nodes.*.type')
      .notEmpty().withMessage('Each node must have a React Flow type.')
      .isString().withMessage('Node React Flow type must be a string.'),
    body('flow.nodes.*.position')
      .isObject().withMessage('Each node must have a position object.'),
    body('flow.nodes.*.position.x')
      .isNumeric().withMessage('Node position x must be a number.'),
    body('flow.nodes.*.position.y')
      .isNumeric().withMessage('Node position y must be a number.'),
    body('flow.nodes.*.data')
      .isObject().withMessage('Each node must have a data object.'),
    body('flow.nodes.*.data.label')
      .trim()
      .notEmpty().withMessage('Each node data must have a label.')
      .isString().withMessage('Node data label must be a string.'),
    body('flow.nodes.*.data.type')
      .trim()
      .notEmpty().withMessage('Each node data must have a backend type.')
      .isIn(NODE_TYPES)
      .withMessage(`Invalid node data type provided. Must be one of: ${NODE_TYPES.join(', ')}`),
    body('flow.nodes.*.data.config')
      .optional()
      .isObject().withMessage('Node data config must be an object if provided.'),

    body('flow.edges')
      .isArray().withMessage('Flow edges must be an array (can be empty if only one node).'),
    body('flow.edges.*.id')
      .if(body('flow.edges').notEmpty())
      .notEmpty().withMessage('Each edge must have an ID.')
      .isString().withMessage('Edge ID must be a string.'),
    body('flow.edges.*.source')
      .if(body('flow.edges').notEmpty())
      .notEmpty().withMessage('Each edge must have a source.')
      .isString().withMessage('Edge source must be a string.'),
    body('flow.edges.*.target')
      .if(body('flow.edges').notEmpty())
      .notEmpty().withMessage('Each edge must have a target.')
      .isString().withMessage('Edge target must be a string.'),
  ];
};

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }
  const extractedErrors = [];
  errors.array().map(err => {
    extractedErrors.push({ field: err.path, message: err.msg, location: err.location, value: err.value });
  });

  console.error("[VALIDATE_REQUEST] Validation errors:", extractedErrors);
  return res.status(400).json({
    errors: extractedErrors,
  });
};

const updateWorkflowValidationRules = () => {
  return [
    param('id')
      .isMongoId().withMessage('Invalid Workflow ID format.'),

    body('name')
      .optional()
      .trim()
      .notEmpty().withMessage('Workflow name cannot be empty if provided.')
      .isString().withMessage('Workflow name must be a string.'),

    body('description')
      .optional()
      .trim()
      .isString().withMessage('Description must be a string.'),

    body('flow')
      .optional()
      .isObject().withMessage('Flow data must be an object if provided.'),
    
    body('flow.nodes')
      .optional()
      .isArray().withMessage('Flow nodes must be an array if provided.')
      .custom((nodes) => {
        if (nodes && nodes.length === 0) {
          throw new Error('Workflow must have at least one node if nodes array is provided.');
        }
        return true;
      }),

    body('flow.edges')
      .optional()
      .isArray().withMessage('Flow edges must be an array if provided.'),

    body('flow.nodes.*.data.type')
      .optional()
      .if(body('flow.nodes.*.data.type').exists())
      .trim()
      .notEmpty().withMessage('Node data type cannot be empty if provided.')
      .isIn(NODE_TYPES)
      .withMessage(`Invalid node data type provided during update. Must be one of: ${NODE_TYPES.join(', ')}`),

    body('status')
      .optional()
      .isIn(['Draft', 'Active', 'Archived']).withMessage('Invalid status provided.'),
      
  ];
};

const mongoIdParamValidation = (paramName = 'id') => {
  return [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName} format. Must be a valid MongoDB ObjectId.`),
  ];
};

module.exports = {
  workflowValidationRules,
  updateWorkflowValidationRules,
  mongoIdParamValidation,
  validate,
};