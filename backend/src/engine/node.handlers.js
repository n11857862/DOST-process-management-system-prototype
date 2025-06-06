const mongoose = require('mongoose');
const { WorkflowInstance }  = require('../api/v1/instances/workflowInstance.model.js');
const Task = require('../api/v1/tasks/task.model.js');
const { User, USER_ROLES } = require('../api/v1/users/user.model.js');
const { Parser } = require('expr-eval');
const axios = require('axios');
const { sendEmail } = require('../api/core/utils/emailService');
const { ApiConnectionConfig } = require('../api/v1/api-configs/apiConnectionConfig.model.js');
const notificationService = require('../api/core/utils/notificationService');


const handleStartNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    console.log(`[NODE_HANDLER_START] Processing Start Node ${nodeDefinition.id} for instance ${instance._id}`);
    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel: nodeDefinition.data?.label || 'Start',
        nodeType: nodeDefinition.data?.type || 'Start',
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `Start node execution initiated.`
    });

    const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
    if (outgoingEdges.length === 0) {
        console.warn(`[NODE_HANDLER_START] Start Node ${nodeDefinition.id} has no outgoing edges. Workflow cannot proceed.`);
        instance.status = 'Failed';
        instance.errorInfo = { message: 'Start node has no outgoing connections.', nodeId: nodeDefinition.id, timestamp: new Date() };
        instance.completedAt = new Date();
    } else {
        instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
        console.log(`[NODE_HANDLER_START] Transitioning from Start Node ${nodeDefinition.id} to active nodes: ${instance.currentState.activeNodeIds.join(', ')}`);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel: nodeDefinition.data?.label || 'Start',
            nodeType: nodeDefinition.data?.type || 'Start',
            eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status,
            message: `Start node execution completed. Transitioning to: ${instance.currentState.activeNodeIds.join(', ')}`,
            details: { nextNodeIds: instance.currentState.activeNodeIds }
        });
    }
};

const handleEndNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    console.log(`[NODE_HANDLER_END] Processing End Node ${nodeDefinition.id} for instance ${instance._id}`);
    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel: nodeDefinition.data?.label || 'End',
        nodeType: nodeDefinition.data?.type || 'End',
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `End node execution initiated.`
    });

    instance.status = 'Completed';
    instance.completedAt = new Date();
    instance.currentState.activeNodeIds = [];

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel: nodeDefinition.data?.label || 'End',
        nodeType: nodeDefinition.data?.type || 'End',
        eventType: 'NodeExecutionEnd',
        statusAtEvent: 'Completed',
        message: 'Workflow completed successfully at this End node.',
        details: { finalStatus: instance.status }
    });

    console.log(`[NODE_HANDLER_END] Instance ${instance._id} completed at End Node ${nodeDefinition.id}.`);
};

const handleTaskNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const taskConfig = nodeDefinition.data.config || {};
    const nodeLabel = nodeDefinition.data.label || 'Untitled Task';
    const nodeType = nodeDefinition.data.type;

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `Task node execution initiated: ${nodeLabel}`,
        details: { config: taskConfig }
    });

    console.log(`[NODE_HANDLER_TASK] Processing Task Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}`);
    console.log(`[NODE_HANDLER_TASK] ### Instance startedBy: ${instance.startedBy}`);
    console.log(`[NODE_HANDLER_TASK] ### Instance context available:`, JSON.stringify(instance.context || {}));
    
    console.log(`[NODE_HANDLER_TASK] ### Received taskConfig: ${JSON.stringify(taskConfig, null, 2)}`);
    
    const renderedTitle = simpleTemplateRender(nodeDefinition.data.label || 'Untitled Task', instance.context);
    const renderedDescription = simpleTemplateRender(nodeDefinition.data.description || '', instance.context);

    let newTaskPayload = {
        workflowInstanceId: instance._id,
        workflowDefinitionId: workflowDefinition._id,
        nodeId: nodeDefinition.id,
        nodeType: nodeDefinition.data.type,
        taskType: nodeDefinition.data.taskType || 'GenericTask',
        title: renderedTitle,
        description: renderedDescription,
        status: 'Pending',
        priority: taskConfig.priority || 'Medium',
        assignedToType: null,
        assignedUserId: undefined,
        assignedRoleName: undefined,
        taskData: {}
    };

    if (taskConfig.formFields && Array.isArray(taskConfig.formFields)) {
        newTaskPayload.taskData.formFields = taskConfig.formFields;
        console.log(`[NODE_HANDLER_TASK] ### Copied formFields definition to taskData for node ${nodeDefinition.id}`);
    } else {
        newTaskPayload.taskData.formFields = [];
    }

    if (taskConfig.hasOwnProperty('allowFileSubmission')) {
        newTaskPayload.taskData.allowFileSubmission = !!taskConfig.allowFileSubmission;
        console.log(`[NODE_HANDLER_TASK] ### allowFileSubmission set in taskData: ${newTaskPayload.taskData.allowFileSubmission}`);
    } else {
        newTaskPayload.taskData.allowFileSubmission = false;
        console.log(`[NODE_HANDLER_TASK] ### allowFileSubmission not in config, defaulting to false in taskData.`);
    }

    if (taskConfig.dueDate && typeof taskConfig.dueDate === 'string' && taskConfig.dueDate.trim() !== '') {
        console.log(`[NODE_HANDLER_TASK] For node ${nodeDefinition.id}, taskConfig.dueDate is:`, taskConfig.dueDate, "Type:", typeof taskConfig.dueDate);
        const parsedDate = new Date(taskConfig.dueDate);
        if (!isNaN(parsedDate.valueOf())) {
            newTaskPayload.dueDate = parsedDate;
        } else {
            console.warn(`[NODE_HANDLER_TASK] Invalid date string provided for dueDate in node ${nodeDefinition.id}: '${taskConfig.dueDate}'. Due date will not be set.`);
        }
    } else if (taskConfig.dueDate) {
        console.warn(`[NODE_HANDLER_TASK] Invalid or empty dueDate value in node ${nodeDefinition.id}. Due date will not be set.`);
    }

    console.log(`[NODE_HANDLER_TASK] ### Determining assignment. taskConfig.assignTo = '${taskConfig.assignTo}'`);

    if (taskConfig.assignTo) {
        const assignmentRule = taskConfig.assignTo;
        console.log(`[NODE_HANDLER_TASK] ### Using 'assignTo' rule system. Rule: '${assignmentRule}'`);
        switch (assignmentRule) {
            case 'initiator':
                if (instance.startedBy) {
                    const initiatorUser = await User.findById(instance.startedBy).lean();
                    if (!initiatorUser || !initiatorUser.isActive) {
                         throw new Error(`Initiator user ${instance.startedBy} for Task node ${nodeDefinition.id} not found or inactive.`);
                    }
                    newTaskPayload.assignedToType = 'User';
                    newTaskPayload.assignedUserId = instance.startedBy;
                    console.log(`[NODE_HANDLER_TASK] ### Set by initiator rule: UserID = ${newTaskPayload.assignedUserId}`);
                } else {
                    throw new Error(`Task node ${nodeDefinition.id} assigned to initiator, but initiator ID is not available in instance context.`);
                }
                break;

            case 'specificUser':
                console.log('[NODE_HANDLER_TASK] ### Matched case: specificUser');
                console.log(`[NODE_HANDLER_TASK] ### taskConfig.specificUserId = '${taskConfig.specificUserId}'`);
                if (taskConfig.specificUserId) {
                    if (!mongoose.Types.ObjectId.isValid(taskConfig.specificUserId)) {
                        throw new Error(`Invalid specificUserId format '${taskConfig.specificUserId}' in Task node ${nodeDefinition.id} config.`);
                    }
                    const specificUser = await User.findById(taskConfig.specificUserId).lean();
                    if (!specificUser || !specificUser.isActive) {
                        throw new Error(`Assigned specific user ${taskConfig.specificUserId} for Task node ${nodeDefinition.id} not found or inactive.`);
                    }
                    newTaskPayload.assignedToType = 'User';
                    newTaskPayload.assignedUserId = taskConfig.specificUserId;
                    console.log(`[NODE_HANDLER_TASK] ### Set by specificUser rule: UserID = ${newTaskPayload.assignedUserId}`);
                } else {
                    throw new Error(`Task node ${nodeDefinition.id} assigned to 'specificUser', but 'specificUserId' is missing in config.`);
                }
                break;

            case 'role':
                console.log('[NODE_HANDLER_TASK] ### Matched case: role');
                console.log(`[NODE_HANDLER_TASK] ### taskConfig.specificRole = '${taskConfig.specificRole}'`);
                console.log(`[NODE_HANDLER_TASK] ### Available USER_ROLES: ${JSON.stringify(USER_ROLES)}`);
                if (taskConfig.specificRole) {
                    if (typeof USER_ROLES !== 'undefined' && !USER_ROLES.includes(taskConfig.specificRole)) {
                        throw new Error(`Invalid specificRole '${taskConfig.specificRole}' in Task node ${nodeDefinition.id} config. Must be one of: ${USER_ROLES.join(', ')}`);
                    }
                    newTaskPayload.assignedToType = 'Role';
                    newTaskPayload.assignedRoleName = taskConfig.specificRole;
                    console.log(`[NODE_HANDLER_TASK] ### Set by role rule: RoleName = ${newTaskPayload.assignedRoleName}`);
                } else {
                    throw new Error(`Task node ${nodeDefinition.id} assigned to 'role', but 'specificRole' is missing in config.`);
                }
                break;
            
            case 'manager':
                 console.warn(`[NODE_HANDLER_TASK] Manager assignment for node ${nodeDefinition.id} is not fully implemented. Defaulting to initiator for now.`);
                 const initiatorUserForManager = await User.findById(instance.startedBy).lean();
                 if (!initiatorUserForManager || !initiatorUserForManager.isActive) {
                    throw new Error(`Initiator user ${instance.startedBy} for manager rule on Task node ${nodeDefinition.id} not found or inactive.`);
                 }
                 newTaskPayload.assignedToType = 'User';
                 newTaskPayload.assignedUserId = instance.startedBy;
                 console.log(`[NODE_HANDLER_TASK] ### Set by manager rule (fallback): UserID = ${newTaskPayload.assignedUserId}`);
                 break;
            default:
                console.error(`[NODE_HANDLER_TASK] ### Unhandled 'assignTo' rule: '${assignmentRule}'. Defaulting to admin role if possible.`);
                newTaskPayload.assignedToType = 'Role';
                newTaskPayload.assignedRoleName = 'admin';
                if (instance.startedBy) {
                    newTaskPayload.assignedToType = 'User';
                    newTaskPayload.assignedUserId = instance.startedBy;
                    console.log(`[NODE_HANDLER_TASK] ### Defaulted to initiator (unknown rule): UserID = ${newTaskPayload.assignedUserId}`);
                } else {
                    throw new Error(`Task node ${nodeDefinition.id} has an invalid assignment rule ('${assignmentRule}') and initiator is unavailable.`);
                }
        }
    } else {
        console.warn(`[NODE_HANDLER_TASK] ### 'assignTo' rule missing in config. Attempting legacy direct assignment.`);
        newTaskPayload.assignedToType = 'Role';
        newTaskPayload.assignedRoleName = 'admin';
        if (taskConfig.assignedUserId) {
            if (!mongoose.Types.ObjectId.isValid(taskConfig.assignedUserId)) {
                throw new Error(`Invalid assignedUserId format '${taskConfig.assignedUserId}' in Task node ${nodeDefinition.id} config.`);
            }
            const userExists = await User.findById(taskConfig.assignedUserId).lean();
            if (!userExists || !userExists.isActive) {
                throw new Error(`Assigned user ${taskConfig.assignedUserId} for Task node ${nodeDefinition.id} not found or inactive.`);
            }
            newTaskPayload.assignedToType = 'User';
            newTaskPayload.assignedUserId = taskConfig.assignedUserId;
            console.log(`[NODE_HANDLER_TASK] ### Set by legacy assignedUserId: UserID = ${newTaskPayload.assignedUserId}`);
        } else if (taskConfig.assignedRoleName) {
            if (!USER_ROLES.includes(taskConfig.assignedRoleName)) {
                throw new Error(`Invalid assignedRoleName '${taskConfig.assignedRoleName}' in Task node ${nodeDefinition.id} config. Must be one of: ${USER_ROLES.join(', ')}`);
            }
            newTaskPayload.assignedToType = 'Role';
            newTaskPayload.assignedRoleName = taskConfig.assignedRoleName;
            console.log(`[NODE_HANDLER_TASK] ### Set by legacy assignedRoleName: RoleName = ${newTaskPayload.assignedRoleName}`);
        } else {
            console.warn(`[NODE_HANDLER_TASK] ### No direct assignment fields found. Defaulting to initiator if possible.`);
            if (instance.startedBy) {
                newTaskPayload.assignedToType = 'User';
                newTaskPayload.assignedUserId = instance.startedBy;
                console.log(`[NODE_HANDLER_TASK] ### Defaulted to initiator: UserID = ${newTaskPayload.assignedUserId}`);
            } else {
                throw new Error(`Task node ${nodeDefinition.id} has no assignment configuration and initiator is unavailable.`);
            }
        }
    }

    if (!newTaskPayload.assignedToType || (!newTaskPayload.assignedUserId && !newTaskPayload.assignedRoleName)) {
        throw new Error(`Task node ${nodeDefinition.id} failed to resolve any valid assignment after all rules (THIS IS A BUG IN HANDLER). Config was: ${JSON.stringify(taskConfig)}`);
    }
    
    console.log(`[NODE_HANDLER_TASK] ### Final newTaskPayload before DB create: ${JSON.stringify(newTaskPayload, null, 2)}`);

    try {
        const existingTask = await Task.findOne({
            workflowInstanceId: instance._id,
            nodeId: nodeDefinition.id,
            status: { $in: ['Pending', 'In Progress', 'Needs Rework', 'Escalated'] }
        });

        if (existingTask) {
            console.log(`[NODE_HANDLER_TASK] Task for node ${nodeDefinition.id} on instance ${instance._id} already exists and is active (Status: ${existingTask.status}).`);
            instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== nodeDefinition.id);
        } else {
            console.log(`[NODE_HANDLER_TASK] Creating task with payload:`, newTaskPayload);
            const newTask = await Task.create(newTaskPayload);
            console.log(`[NODE_HANDLER_TASK] Created new Task ${newTask._id} for node ${nodeDefinition.id} (Priority: ${newTask.priority}, Due: ${newTask.dueDate || 'N/A'}) (Instance: ${instance._id}), assignedToType: ${newTaskPayload.assignedToType}, assignedUserId: ${newTaskPayload.assignedUserId || 'N/A'}, assignedRoleName: ${newTaskPayload.assignedRoleName || 'N/A'}`);
            
            instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== nodeDefinition.id); 
        }
    } catch (dbError) {
        console.error(`[NODE_HANDLER_TASK] Database error creating or checking Task for node ${nodeDefinition.id}:`, dbError);
        let errorMessage = `Failed to create or process task for node ${nodeDefinition.id}.`;
        if (dbError.name === 'ValidationError') {
            const validationErrors = Object.values(dbError.errors).map(e => e.message + (e.path ? ` (Path: ${e.path})` : '')).join('; ');
            errorMessage += ` Validation Error(s): ${validationErrors}`;
        } else {
            errorMessage += ` DB Error: ${dbError.message}`;
        }
        throw new Error(errorMessage);
    }
};

const handleDecisionNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Decision';
    const nodeType = nodeDefinition.data.type;
    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status, message: `Decision node execution initiated: ${nodeLabel}`,
        details: { config: nodeDefinition.data.config }
    });

    console.log(`[NODE_HANDLER_DECISION] Processing Decision Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}. Context:`, instance.context);

    const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
    if (outgoingEdges.length === 0) {
        throw new Error(`Decision node ${nodeDefinition.id} has no outgoing edges. Workflow is stuck.`);
    }

    let chosenTargetNodeId = null;
    let defaultPathEdge = null;

    const conditionalEdges = [];
    outgoingEdges.forEach(edge => {
        if (edge.data?.conditionType === 'default' || edge.data?.isDefaultPath === true) {
            if (defaultPathEdge) {
                console.warn(`[NODE_HANDLER_DECISION] Multiple default paths found for decision node ${nodeDefinition.id}. Using the first one found.`);
            } else {
                defaultPathEdge = edge;
            }
        } else {
            conditionalEdges.push(edge);
        }
    });
    
    for (const edge of conditionalEdges) {
        const expression = edge.data?.conditionExpression;
        if (expression && typeof expression === 'string' && expression.trim() !== '') {
            try {
                const parser = new Parser();
                const expr = parser.parse(expression);
                const contextForEval = instance.context || {}; 
                if (expr.evaluate(contextForEval)) {
                    chosenTargetNodeId = edge.target;
                    console.log(`[NODE_HANDLER_DECISION] Condition "${expression}" on edge ${edge.id} evaluated to true. Taking path to ${chosenTargetNodeId}.`);
                    break;
                }
            } catch (evalError) {
                console.error(`[NODE_HANDLER_DECISION] Error evaluating condition "${expression}" for edge ${edge.id} on node ${nodeDefinition.id}:`, evalError.message);
            }
        } else {
            console.warn(`[NODE_HANDLER_DECISION] Edge ${edge.id} from decision node ${nodeDefinition.id} is missing a valid 'conditionExpression' in its data.`);
        }
    }

    if (!chosenTargetNodeId && defaultPathEdge) {
        chosenTargetNodeId = defaultPathEdge.target;
        console.log(`[NODE_HANDLER_DECISION] No conditional path taken. Using default path to ${chosenTargetNodeId}.`);
    }

    if (!chosenTargetNodeId) {
        throw new Error(`Decision node ${nodeDefinition.id} could not determine a path. No conditions met and no default path found, or default path has no target.`);
    }

    instance.currentState.activeNodeIds = [chosenTargetNodeId];
    console.log(`[NODE_HANDLER_DECISION] Transitioning from Decision Node ${nodeDefinition.id} to active node: ${chosenTargetNodeId}`);

    if (instance.currentState.activeNodeIds.length === 0 && !pathTaken) {
        console.log(`[NODE_HANDLER_DECISION] Node ${nodeDefinition.id} did not result in any active paths and no explicit termination of path logged prior.`);
         await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status, message: `Decision node ${nodeLabel} completed. Path terminated as no conditions met and no default.`,
            details: { outcome: 'Path terminated' }
        });
    }
};


const handleAutomatedTaskNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Automated Task';
    const nodeType = nodeDefinition.data.type;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `Automated Task node execution initiated: ${nodeLabel}`,
        details: { config }
    });

    console.log(`[NODE_HANDLER_AUTOMATED_TASK] ### START Processing Automated Task Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}`);
    let taskOutput = null;

    try {
    const {
        apiUrl,
            apiMethod = 'GET',
            apiBodyTemplate,
            apiHeaders: apiHeadersTemplate,
            saveResponseTo,
        logMessage = 'Automated task executed.',
            apiConfigId 
    } = config;

        let inferredTaskType = config.taskType;
        if (!inferredTaskType) {
            if (config.contextUpdates) inferredTaskType = 'setContext';
            else if (config.apiUrl || config.apiConfigId) inferredTaskType = 'apiCall';
            else if (config.logMessage) inferredTaskType = 'log';
            else inferredTaskType = 'log';
            console.log(`[NODE_HANDLER_AUTOMATED_TASK] taskType not explicitly set, inferred as: ${inferredTaskType} for node ${nodeDefinition.id}`);
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'Debug',
                message: `taskType inferred as: ${inferredTaskType}`,
                details: { originalConfigTaskType: config.taskType }
            });
        }
        console.log(`[NODE_HANDLER_AUTOMATED_TASK] Effective task type: ${inferredTaskType}`);


        if (inferredTaskType === 'setContext') {
            const contextUpdates = config.contextUpdates || {};
            if (typeof contextUpdates !== 'object' || contextUpdates === null) {
                const errorMessage = 'setContext task type: contextUpdates in config is missing, empty, or not an object.';
                console.error(`[NODE_HANDLER_AUTOMATED_TASK] ${errorMessage} for node ${nodeDefinition.id}`);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError',
                    statusAtEvent: instance.status, message: `setContext error: ${errorMessage}`,
                    details: { contextUpdatesConfig: config.contextUpdates }
                });
                throw new Error(errorMessage);
            }

            const changes = {};
            const parserForExpressions = new Parser({ operators: { conditional: true } });

            for (const key in contextUpdates) {
                if (Object.prototype.hasOwnProperty.call(contextUpdates, key)) {
                    const valueOrExpression = contextUpdates[key];
                    let finalValue;

                    if (typeof valueOrExpression === 'string') {
                        if (valueOrExpression.startsWith("EXPRESSION:")) {
                            const expressionToEvaluate = valueOrExpression.substring("EXPRESSION:".length).trim();
                            try {
                                const evaluationContext = {
                                    ...(instance.context || {}),
                                    CURRENT_YEAR: new Date().getFullYear(),
                                    JSON: JSON,
                                };
                                finalValue = parserForExpressions.evaluate(expressionToEvaluate, evaluationContext);
                                console.log(`[NODE_HANDLER_AUTOMATED_TASK] setContext: Evaluated EXPRESSION "${expressionToEvaluate}" for key "${key}" to: ${finalValue}`);
                            } catch (e) {
                                console.warn(`[NODE_HANDLER_AUTOMATED_TASK] setContext: Error evaluating EXPRESSION "${expressionToEvaluate}" for key "${key}": ${e.message}. Storing as literal string "${valueOrExpression}".`);
                                finalValue = valueOrExpression;
                            }
                        } else {
                            finalValue = simpleTemplateRender(valueOrExpression, instance.context, true);
                            if (finalValue === valueOrExpression && valueOrExpression.includes("{{") && valueOrExpression.includes("}}")) {
                                console.warn(`[NODE_HANDLER_AUTOMATED_TASK] Template string "${valueOrExpression}" for key "${key}" did not resolve as expected. Storing as literal string.`);
                            }
                        }
                    } else {
                        finalValue = valueOrExpression;
                    }
                    setNestedValue(instance.context, key, finalValue);
                    changes[key] = finalValue;
                }
            }
            instance.markModified('context');
            taskOutput = { updatedContextKeys: Object.keys(changes), newValues: changes };
            console.log(`[NODE_HANDLER_AUTOMATED_TASK] setContext: Updated instance context for node ${nodeDefinition.id}. Changes:`, JSON.stringify(changes));
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ContextUpdate',
                statusAtEvent: instance.status, message: `Context updated by setContext task.`,
                details: taskOutput
            });

        } else if (inferredTaskType === 'apiCall') {
            let actualApiUrl = apiUrl;
            let actualApiMethod = apiMethod;
            let actualApiHeaders = apiHeadersTemplate ? JSON.parse(simpleTemplateRender(JSON.stringify(apiHeadersTemplate), instance.context)) : {};
            let actualApiBody = null;

            if (apiConfigId) {
                try {
                    const apiConfig = await ApiConnectionConfig.findById(apiConfigId);
                    if (apiConfig && apiConfig.status === 'Approved') {
                        actualApiUrl = apiConfig.apiUrl;
                        actualApiMethod = apiConfig.apiMethod;
                        actualApiHeaders = { ...apiConfig.headersTemplate, ...actualApiHeaders };
                        
                        apiConfig.addWorkflowUsage(workflowDefinition._id, nodeDefinition.id);
                        await apiConfig.save();
                        
                        console.log(`[NODE_HANDLER_AUTOMATED_TASK] Using approved API config ${apiConfigId} for ${actualApiMethod} ${actualApiUrl}`);
                        await addExecutionHistoryEntry(instance, {
                            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ApiConfigUsed',
                            statusAtEvent: instance.status, message: `Using API configuration: ${apiConfig.name} (${apiConfigId})`,
                            details: { apiConfigId, apiConfigName: apiConfig.name, apiConfigStatus: apiConfig.status }
                        });
                    } else {
                        console.warn(`[NODE_HANDLER_AUTOMATED_TASK] API config ${apiConfigId} not found or not approved. Using node-specific configuration.`);
                        await addExecutionHistoryEntry(instance, {
                            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ApiConfigWarning',
                            statusAtEvent: instance.status, message: `API config ${apiConfigId} not found or not approved. Using fallback configuration.`,
                            details: { apiConfigId, fallbackUrl: actualApiUrl, fallbackMethod: actualApiMethod }
                        });
                    }
                } catch (error) {
                    console.error(`[NODE_HANDLER_AUTOMATED_TASK] Error fetching API config ${apiConfigId}:`, error);
                    await addExecutionHistoryEntry(instance, {
                        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ApiConfigError',
                        statusAtEvent: instance.status, message: `Error fetching API config ${apiConfigId}: ${error.message}. Using fallback configuration.`,
                        details: { apiConfigId, error: error.message, fallbackUrl: actualApiUrl, fallbackMethod: actualApiMethod }
                    });
                }
            }

            const renderedUrl = simpleTemplateRender(actualApiUrl, instance.context);
            
            if (['POST', 'PUT', 'PATCH'].includes(actualApiMethod.toUpperCase()) && apiBodyTemplate) {
                if (typeof apiBodyTemplate === 'string') {
                    actualApiBody = simpleTemplateRender(apiBodyTemplate, instance.context);
                    try {
                        actualApiBody = JSON.parse(actualApiBody);
                    } catch (e) { }
                } else if (typeof apiBodyTemplate === 'object') {
                    const recursivelyRenderedBody = {};
                    for (const key in apiBodyTemplate) {
                        recursivelyRenderedBody[key] = simpleTemplateRender(JSON.stringify(apiBodyTemplate[key]), instance.context);
                         try {
                            recursivelyRenderedBody[key] = JSON.parse(recursivelyRenderedBody[key]);
                        } catch (e) {}
                    }
                    actualApiBody = recursivelyRenderedBody;
                }
            }
            
            const requestDetails = {
                url: renderedUrl,
                method: actualApiMethod,
                headers: actualApiHeaders,
                body: actualApiBody
            };

            console.log(`[NODE_HANDLER_AUTOMATED_TASK] API Call: ${actualApiMethod} ${renderedUrl}`);
            try {
                const response = await axios({
                    method: actualApiMethod,
                    url: renderedUrl,
                    data: actualApiBody,
                    headers: actualApiHeaders,
                    timeout: config.apiTimeout || 10000,
                });
                taskOutput = {
                    status: response.status,
                    headers: response.headers,
                    data: response.data
                };
                console.log(`[NODE_HANDLER_AUTOMATED_TASK] API Call success for node ${nodeDefinition.id}: Status ${response.status}`);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ApiCallSuccess',
                    statusAtEvent: instance.status, message: `API call to ${renderedUrl} successful (Status: ${response.status}).`,
                    details: { request: requestDetails, response: taskOutput }
                });

                if (saveResponseTo) {
                    setNestedValue(instance.context, saveResponseTo, response.data);
            instance.markModified('context');
                    console.log(`[NODE_HANDLER_AUTOMATED_TASK] Saved API response to context.${saveResponseTo} for node ${nodeDefinition.id}`);
                    await addExecutionHistoryEntry(instance, {
                        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ContextUpdate',
                        statusAtEvent: instance.status, message: `API response saved to context key: ${saveResponseTo}.`,
                        details: { key: saveResponseTo, value: response.data }
                    });
                }
    } catch (error) {
                const errorResponse = error.response ? {
                    status: error.response.status,
                    data: error.response.data,
                    headers: error.response.headers
                } : null;
                const errorMessage = `API Call failed for node ${nodeDefinition.id}: ${error.message}`;
                console.error(`[NODE_HANDLER_AUTOMATED_TASK] ${errorMessage}`, errorResponse || error);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'ApiCallError',
                    statusAtEvent: instance.status, message: errorMessage,
                    details: { request: requestDetails, error: { message: error.message, response: errorResponse, stack: error.stack } }
                });
                throw error;
            }

        } else if (inferredTaskType === 'log') {
            const evaluationContextForLog = { };
            const renderedLogMessage = simpleTemplateRender(logMessage, { ...instance.context, ...evaluationContextForLog });
            console.log(`[NODE_HANDLER_AUTOMATED_TASK_LOG] ${renderedLogMessage}`);
            taskOutput = { message: renderedLogMessage, executedAt: new Date() };
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'LogMessageRendered',
                statusAtEvent: instance.status, message: `Log message: ${renderedLogMessage}`,
                details: { rawMessage: logMessage, renderedMessage: renderedLogMessage, contextUsed: evaluationContextForLog }
            });

        } else {
            const unsupportedMessage = `Unsupported automated taskType: ${inferredTaskType} or missing required config.`;
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError',
                statusAtEvent: instance.status, message: unsupportedMessage,
                details: { configuredTaskType: inferredTaskType, config }
            });
            throw new Error(unsupportedMessage);
        }

        const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
        instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
        
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel,
            nodeType,
            eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status,
            message: `Automated Task node ${nodeLabel} (type: ${inferredTaskType}) executed. Output: ${taskOutput ? JSON.stringify(taskOutput) : 'N/A'}. Transitioning to: ${instance.currentState.activeNodeIds.join(', ')}`,
            details: { taskOutput, nextNodeIds: instance.currentState.activeNodeIds, inferredTaskType }
        });
        console.log(`[NODE_HANDLER_AUTOMATED_TASK] ### END Processing Automated Task Node ${nodeDefinition.id}. Transitioning to: ${instance.currentState.activeNodeIds.join(', ')}`);

    } catch (error) {
        console.error(`[NODE_HANDLER_AUTOMATED_TASK] Error in Automated Task Node ${nodeDefinition.id} (${nodeLabel}):`, error.message, error.stack);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel,
            nodeType,
            eventType: 'NodeExecutionError',
            statusAtEvent: instance.status,
            message: `Error executing automated task ${nodeLabel}: ${error.message}`,
            details: { error: { message: error.message, stack: error.stack }, config }
        });
        throw error;
    }
};

const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = current[keys[i]] || {};
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
};

const handleFileUploadNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'File Upload';
    const nodeType = nodeDefinition.data.type;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `File Upload node execution initiated: ${nodeLabel}`,
        details: { config }
    });

    console.log(`[NODE_HANDLER_FILE_UPLOAD] Processing FileUpload Node ${nodeDefinition.id} for instance ${instance._id}`);

    if (config.designerAttachedFileId) {
        console.log(`[NODE_HANDLER_FILE_UPLOAD] Designer-attached file found: ${config.designerAttachedFileId}. Creating review task.`);
        
        if (config.contextKeyForFileId) {
            const setNestedValue = (obj, path, value) => {
                const keys = path.split('.');
                let current = obj;
                for (let i = 0; i < keys.length - 1; i++) {
                    current[keys[i]] = current[keys[i]] || {};
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
            };
            setNestedValue(instance.context, config.contextKeyForFileId, config.designerAttachedFileId);
            instance.markModified('context');
            console.log(`[NODE_HANDLER_FILE_UPLOAD] Stored attached file ID ${config.designerAttachedFileId} in context at ${config.contextKeyForFileId}`);
        }

        const taskTitle = simpleTemplateRender(nodeDefinition.data.label || 'Review Attached Document', instance.context);
        const taskDescription = simpleTemplateRender(config.instructions || 'Please review the attached document and complete this task.', instance.context);

        let newTaskPayload = {
            workflowInstanceId: instance._id,
            workflowDefinitionId: workflowDefinition._id,
            nodeId: nodeDefinition.id,
            nodeType: nodeDefinition.data.type,
            taskType: 'FileReviewTask',
            title: taskTitle,
            description: taskDescription,
            status: 'Pending',
            priority: config.priority || 'Medium',
            assignedToType: null,
            assignedUserId: undefined,
            assignedRoleName: undefined,
            taskData: {
                attachedFileId: config.designerAttachedFileId,
                attachedFileName: config.designerAttachedFileName || 'Attached Document',
                allowFileSubmission: false,
                formFields: []
            }
        };

        const assignTo = config.assignTo || 'initiator';
        switch (assignTo) {
            case 'initiator':
                newTaskPayload.assignedToType = 'User';
                newTaskPayload.assignedUserId = instance.startedBy;
                break;
            case 'specificUser':
                if (config.specificUserId && mongoose.Types.ObjectId.isValid(config.specificUserId)) {
                    const userExists = await User.findOne({ _id: config.specificUserId, isActive: true }).lean();
                    if (!userExists) {
                        throw new Error(`Assigned user ${config.specificUserId} for FileUpload node ${nodeDefinition.id} not found or inactive.`);
                    }
                    newTaskPayload.assignedToType = 'User';
                    newTaskPayload.assignedUserId = config.specificUserId;
                } else {
                    throw new Error(`Invalid or missing specificUserId for FileUpload node ${nodeDefinition.id}.`);
                }
                break;
            case 'specificRole':
                if (config.specificRole) {
                    newTaskPayload.assignedToType = 'Role';
                    newTaskPayload.assignedRoleName = config.specificRole;
                } else {
                    throw new Error(`Missing specificRole for FileUpload node ${nodeDefinition.id}.`);
                }
                break;
            case 'manager':
                console.warn(`[NODE_HANDLER_FILE_UPLOAD] 'Manager' assignment for FileUpload Node ${nodeDefinition.id}: User model has no manager field. Falling back to 'admin' role.`);
                newTaskPayload.assignedToType = 'Role';
                newTaskPayload.assignedRoleName = 'admin';
                break;
            default:
                console.warn(`[NODE_HANDLER_FILE_UPLOAD] Invalid assignTo value '${assignTo}' for FileUpload node ${nodeDefinition.id}. Defaulting to initiator.`);
                newTaskPayload.assignedToType = 'User';
                newTaskPayload.assignedUserId = instance.startedBy;
        }

        try {
            const existingTask = await Task.findOne({
                workflowInstanceId: instance._id,
                nodeId: nodeDefinition.id,
                status: { $in: ['Pending', 'In Progress', 'Needs Rework', 'Escalated'] }
            });

            if (existingTask) {
                console.log(`[NODE_HANDLER_FILE_UPLOAD] File review task for node ${nodeDefinition.id} on instance ${instance._id} already exists and is active (Status: ${existingTask.status}).`);
            } else {
                const newTask = await Task.create(newTaskPayload);
                console.log(`[NODE_HANDLER_FILE_UPLOAD] Created new file review task ${newTask._id} for node ${nodeDefinition.id}, assignedToType: ${newTaskPayload.assignedToType}, assignedId: ${newTaskPayload.assignedUserId || newTaskPayload.assignedRoleName}`);
            }
            
            instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== nodeDefinition.id);
            
        } catch (dbError) {
            console.error(`[NODE_HANDLER_FILE_UPLOAD] Database error for file review task node ${nodeDefinition.id}:`, dbError);
            let errorMessage = `Failed to create file review task for node ${nodeDefinition.id}.`;
            if (dbError.name === 'ValidationError') {
                errorMessage += ` Validation Error(s): ${Object.values(dbError.errors).map(e => e.message).join('; ')}`;
            } else {
                errorMessage += ` DB Error: ${dbError.message}`;
            }
            throw new Error(errorMessage);
        }

    } else {
        console.log(`[NODE_HANDLER_FILE_UPLOAD] No designer-attached file. Setting instance to AwaitingFileUpload.`);
        
        const promptMessage = simpleTemplateRender(config.promptMessage || 'Please upload the required file.', instance.context);
        const contextPathForFileId = config.contextKeyForFileId || `uploadedFileId_${nodeDefinition.id}`;
        
        instance.pendingActionDetails = {
            nodeId: nodeDefinition.id,
            nodeType: 'FileUpload',
            message: promptMessage,
            configSnapshot: {
                contextPathForFileId,
                allowedTypes: config.allowedTypes,
                maxSizeMB: config.maxSizeMB,
                isRequired: config.isRequired !== undefined ? config.isRequired : true,
            }
        };
        instance.status = 'AwaitingFileUpload';
        instance.currentState.activeNodeIds = [];
    }

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionEnd',
        statusAtEvent: config.designerAttachedFileId ? instance.status : 'AwaitingFileUpload',
        message: config.designerAttachedFileId 
            ? `File Upload node ${nodeLabel} processed. Created review task for attached file.`
            : `File Upload node ${nodeLabel} processed. Instance now AwaitingFileUpload.`,
        details: { 
            hasDesignerAttachedFile: !!config.designerAttachedFileId,
            designerAttachedFileId: config.designerAttachedFileId,
            pendingActionDetailsConfig: config.designerAttachedFileId ? null : instance.pendingActionDetails.configSnapshot 
        }
    });

    console.log(`[NODE_HANDLER_FILE_UPLOAD] Instance ${instance._id} processed for node ${nodeDefinition.id}. ${config.designerAttachedFileId ? 'Created review task.' : 'Set to AwaitingFileUpload.'}`);
};

const handleApprovalNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Approval Required';
    const nodeType = nodeDefinition.data.type;
    const approvalConfig = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `Approval node execution initiated: ${nodeLabel}`,
        details: { config: approvalConfig }
    });

    console.log(`[NODE_HANDLER_APPROVAL] Processing Approval Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}. Config:`, JSON.stringify(approvalConfig));

    const taskTitle = simpleTemplateRender(nodeDefinition.data.label || 'Approval Required', instance.context);
    const taskDescription = simpleTemplateRender(approvalConfig.instructions || nodeDefinition.data.description || 'Please review and approve or reject.', instance.context);

    let newTaskPayload = {
        workflowInstanceId: instance._id,
        workflowDefinitionId: workflowDefinition._id,
        nodeId: nodeDefinition.id,
        nodeType: nodeDefinition.data.type,
        taskType: 'ApprovalTask',
        title: taskTitle,
        description: taskDescription,
        status: 'Pending',
        priority: approvalConfig.priority || 'Medium',
        dueDate: approvalConfig.dueDate && !isNaN(new Date(approvalConfig.dueDate)) ? new Date(approvalConfig.dueDate) : undefined,
        nodeSpecificData: { 
            rejectionBehavior: approvalConfig.rejectionBehavior,
            approverRule: approvalConfig.approverRule,
            formFields: approvalConfig.formFields && Array.isArray(approvalConfig.formFields) ? approvalConfig.formFields : [],
            allowFileSubmission: !!approvalConfig.allowFileSubmission
        },
        assignedToType: null, 
        assignedUserId: undefined,
        assignedRoleName: undefined,
    };

    const approverRule = approvalConfig.approverRule;
    switch (approverRule) {
        case 'SpecificUser':
            if (approvalConfig.approverUserId && mongoose.Types.ObjectId.isValid(approvalConfig.approverUserId)) {
                const userExists = await User.findOne({ _id: approvalConfig.approverUserId, isActive: true }).lean();
                if (!userExists) {
                    await addExecutionHistoryEntry(instance, {nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError', statusAtEvent: instance.status, message: `Approver user ${approvalConfig.approverUserId} not found/inactive.`});
                    throw new Error(`Assigned user ${approvalConfig.approverUserId} for Approval node ${nodeDefinition.id} not found or inactive.`);
                }
                newTaskPayload.assignedToType = 'User';
                newTaskPayload.assignedUserId = approvalConfig.approverUserId;
            } else {
                await addExecutionHistoryEntry(instance, {nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError', statusAtEvent: instance.status, message: `Invalid/missing approverUserId for SpecificUser rule.`});
                throw new Error(`Invalid or missing approverUserId for 'SpecificUser' rule in Approval node ${nodeDefinition.id}.`);
            }
            break;
        case 'SpecificRole':
            if (approvalConfig.approverRole && USER_ROLES.includes(approvalConfig.approverRole)) {
                newTaskPayload.assignedToType = 'Role';
                newTaskPayload.assignedRoleName = approvalConfig.approverRole;
            } else {
                await addExecutionHistoryEntry(instance, {nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError', statusAtEvent: instance.status, message: `Invalid/missing approverRole: ${approvalConfig.approverRole}.`});
                throw new Error(`Invalid or missing approverRole for 'SpecificRole' rule in Approval node ${nodeDefinition.id}. Must be one of: ${USER_ROLES.join(', ')}.`);
            }
            break;
        case 'Manager':
            const initiator = await User.findById(instance.startedBy).lean();
            if (!initiator) {
                throw new Error(`Initiator user (ID: ${instance.startedBy}) not found for 'Manager' approval rule in node ${nodeDefinition.id}.`);
            }
            console.warn(`[NODE_HANDLER_APPROVAL] 'Initiator's Manager' rule for Approval Node ${nodeDefinition.id}: User model has no manager field. ` +
                         `Falling back to assigning to 'admin' role. Please update User model and this logic if direct manager assignment is needed.`);
            newTaskPayload.assignedToType = 'Role';
            newTaskPayload.assignedRoleName = 'admin';
            break;
        default:
            console.warn(`[NODE_HANDLER_APPROVAL] Approval node ${nodeDefinition.id} has an invalid or missing approverRule ('${approvalConfig.approverRule}'). Defaulting to 'admin' role.`);
            newTaskPayload.assignedToType = 'Role';
            newTaskPayload.assignedRoleName = 'admin';
    }
    
    if (!newTaskPayload.assignedToType || (!newTaskPayload.assignedUserId && !newTaskPayload.assignedRoleName)) {
        throw new Error(`Approval node ${nodeDefinition.id} failed to resolve a valid assignment. Approver rule: ${approvalConfig.approverRule}, Config: ${JSON.stringify(approvalConfig)}`);
    }

    try {
        const existingTask = await Task.findOne({
            workflowInstanceId: instance._id,
            nodeId: nodeDefinition.id,
            status: { $in: ['Pending', 'In Progress', 'Needs Rework', 'Escalated'] }
        });

        if (existingTask) {
            console.log(`[NODE_HANDLER_APPROVAL] Approval Task for node ${nodeDefinition.id} on instance ${instance._id} already exists and is active (Status: ${existingTask.status}).`);
        } else {
            const newApprovalTask = await Task.create(newTaskPayload);
            console.log(`[NODE_HANDLER_APPROVAL] Created new Approval Task ${newApprovalTask._id} (Type: ${newApprovalTask.taskType}) for node ${nodeDefinition.id}, assignedToType: ${newTaskPayload.assignedToType}, assignedId: ${newTaskPayload.assignedUserId || newTaskPayload.assignedRoleName}`);
        }
        instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== nodeDefinition.id);
    } catch (dbError) {
        console.error(`[NODE_HANDLER_APPROVAL] Database error for Approval Task node ${nodeDefinition.id}:`, dbError);
        let errorMessage = `Failed to create or process approval task for node ${nodeDefinition.id}.`;
        if (dbError.name === 'ValidationError') {
            errorMessage += ` Validation Error(s): ${Object.values(dbError.errors).map(e => e.message).join('; ')}`;
        } else {
            errorMessage += ` DB Error: ${dbError.message}`;
        }
        throw new Error(errorMessage);
    }
};

const handleSubWorkflowNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {    
    const nodeLabel = nodeDefinition.data.label || 'Sub-Workflow';
    const nodeType = nodeDefinition.data.type;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status, message: `Sub-Workflow node execution initiated: ${nodeLabel}`,
        details: { config }
    });

    console.log(`[NODE_HANDLER_SUB_WORKFLOW] Processing SubWorkflow Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}`);

    const subWorkflowDefinitionId = config.subWorkflowId;
    const waitForCompletion = config.waitForCompletion !== undefined ? config.waitForCompletion : true;

    if (!subWorkflowDefinitionId || !mongoose.Types.ObjectId.isValid(subWorkflowDefinitionId)) {
        throw new Error(`SubWorkflowNode ${nodeDefinition.id} is missing a valid 'subWorkflowId' in its config. Value received: '${subWorkflowDefinitionId}'`);
    }

    let initialSubContext = {};
    let inputMappingConfig = config.inputMapping;

    if (typeof inputMappingConfig === 'string') {
        try {
            inputMappingConfig = JSON.parse(inputMappingConfig || '{}');
        } catch (e) {
            console.warn(`[NODE_HANDLER_SUB_WORKFLOW] config.inputMapping for node ${nodeDefinition.id} is a string but not valid JSON: "${config.inputMapping}". Treating as no mapping.`);
            inputMappingConfig = {};
        }
    }

    if (inputMappingConfig && typeof inputMappingConfig === 'object' && Object.keys(inputMappingConfig).length > 0) {
        console.log(`[NODE_HANDLER_SUB_WORKFLOW] Applying input mapping for node ${nodeDefinition.id}:`, inputMappingConfig);
        for (const subKey in inputMappingConfig) {
            if (Object.prototype.hasOwnProperty.call(inputMappingConfig, subKey)) {
                const valueSource = inputMappingConfig[subKey];
                if (typeof valueSource === 'string' && valueSource.startsWith('{{') && valueSource.endsWith('}}')) {
                    const path = valueSource.substring(2, valueSource.length - 2).trim();
                    initialSubContext[subKey] = simpleTemplateRender(`{{${path}}}`, instance.context);
                    console.log(`[NODE_HANDLER_SUB_WORKFLOW] Mapped input '${subKey}': from parent context path '${path}' -> value '${initialSubContext[subKey]}'`);
                } else {
                    initialSubContext[subKey] = valueSource;
                    console.log(`[NODE_HANDLER_SUB_WORKFLOW] Mapped input '${subKey}': static value -> '${initialSubContext[subKey]}'`);
                }
            }
        }
    } else if (Object.keys(instance.context || {}).length > 0 && (!inputMappingConfig || Object.keys(inputMappingConfig).length === 0) ) {
        console.log(`[NODE_HANDLER_SUB_WORKFLOW] No input mapping defined or mapping is empty for node ${nodeDefinition.id}. Current parent context keys: ${Object.keys(instance.context || {}).join(', ')}. Passing entire parent context if available.`);
        if (Object.keys(instance.context || {}).length > 0) {
            initialSubContext = { ...instance.context };
        } else {
            console.log(`[NODE_HANDLER_SUB_WORKFLOW] Parent context is also empty. Sub-workflow will start with empty context.`);
        }
    } else {
         console.log(`[NODE_HANDLER_SUB_WORKFLOW] No input mapping and parent context is empty for node ${nodeDefinition.id}. Sub-workflow will start with empty context.`);
    }

    try {
        console.log(`[NODE_HANDLER_SUB_WORKFLOW] Starting sub-workflow with initial context:`, JSON.stringify(initialSubContext, null, 2));
        const subInstance = await engineAPI.services.workflowInstance.createAndStartInstance(
            subWorkflowDefinitionId,
            instance.startedBy,
            initialSubContext,
            instance._id,
            nodeDefinition.id
        );
        console.log(`[NODE_HANDLER_SUB_WORKFLOW] Started sub-workflow instance ${subInstance._id} for node ${nodeDefinition.id}.`);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'SubWorkflowStarted',
            statusAtEvent: instance.status,
            message: `Sub-workflow instance ${subInstance._id} (Def: ${subWorkflowDefinitionId}) started.`,
            details: { subInstanceId: subInstance._id.toString(), subWorkflowDefinitionId, initialSubContext, waitForCompletion }
        });

        if (waitForCompletion) {
            instance.pendingSubWorkflows.push({ nodeId: nodeDefinition.id, subInstanceId: subInstance._id });
            instance.markModified('pendingSubWorkflows');
            instance.status = 'WaitingForSubWorkflow';
            instance.currentState.activeNodeIds = [];
            console.log(`[NODE_HANDLER_SUB_WORKFLOW] Instance ${instance._id} is now WaitingForSubWorkflow ${subInstance._id}.`);
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
                statusAtEvent: 'WaitingForSubWorkflow',
                message: `Instance now waiting for sub-workflow ${subInstance._id} to complete.`,
                details: { subInstanceId: subInstance._id.toString() }
            });
            } else {
            const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id && edge.data?.conditionType !== 'error');
            instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
            console.log(`[NODE_HANDLER_SUB_WORKFLOW] Sub-workflow ${subInstance._id} started (fire and forget). Parent instance ${instance._id} continues to nodes: ${instance.currentState.activeNodeIds.join(', ')}`);
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
                statusAtEvent: instance.status,
                message: `Sub-workflow ${subInstance._id} started (fire-and-forget). Parent continues.`,
                details: { subInstanceId: subInstance._id.toString(), nextNodeIds: instance.currentState.activeNodeIds }
            });
        }
    } catch (error) {
        console.error(`[NODE_HANDLER_SUB_WORKFLOW] Error starting sub-workflow for node ${nodeDefinition.id}:`, error);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError',
            statusAtEvent: instance.status, message: `Error starting sub-workflow: ${error.message}`,
            details: { error: { message: error.message, stack: error.stack }, config }
        });
        throw error;
    }
};

const simpleTemplateRender = (templateString, contextScope) => {
    if (typeof templateString !== 'string') {
        return templateString;
    }

    const parser = new Parser({
        operators: {
            conditional: true
        }
    });

    return templateString.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expression) => {
        const evaluationContext = {
            ...(contextScope || {}),
            CURRENT_YEAR: new Date().getFullYear(),
        };
        
        if (/^[\w.-]+$/.test(expression)) {
            let keys = expression.split('.');
            let value = evaluationContext;
            let pathFound = true;

            if (keys[0] === 'context' && !(evaluationContext && typeof evaluationContext === 'object' && 'context' in evaluationContext && typeof evaluationContext.context === 'object')) {
                keys.shift();
            }
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    pathFound = false;
                    break;
                }
            }
            if (pathFound) {
                if (value === null) return 'null';
                if (value === undefined) return 'undefined';
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
            }
        }

        try {
            const value = parser.evaluate(expression, evaluationContext);
            if (value === null) return 'null';
            if (value === undefined) return 'undefined';
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        } catch (e) {
            console.warn(`[TEMPLATE_RENDER] Error evaluating expression "${expression}" (from template "${match}"): ${e.message}. Returning original match.`);
            return match;
        }
    });
};

const handleNotificationNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Notification';
    const nodeType = nodeDefinition.data.type;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status, message: `Notification node execution initiated: ${nodeLabel}`,
        details: { config: { ...config } }
    });

    console.log(`[NODE_HANDLER_NOTIFICATION] Processing Notification Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}.`);

    const notificationType = config.notificationType || 'log';
    const recipientType = config.recipientType;
    const recipientValueTemplate = config.recipientValue;
    const subjectTemplate = config.subjectTemplate || `Notification: ${workflowDefinition.name}`;
    const bodyTemplate = config.bodyTemplate || `A workflow event has occurred regarding instance {{instanceId}} from workflow {{workflowName}}.`;
    const messageContent = config.message; 

        const templateContext = {
            ...(instance.context || {}),
            instanceId: instance._id.toString(),
        nodeId: nodeDefinition.id,
            workflowName: workflowDefinition.name,
        message: simpleTemplateRender(messageContent || '', instance.context || {}) 
        };

    let finalRecipientsString = 'N/A';
    let finalSubject = 'N/A';
    let finalBody = 'N/A';

    try {
        if (notificationType === 'email') {
            const recipients = [];
            const renderedRecipientValue = simpleTemplateRender(recipientValueTemplate || '', templateContext);

            if (recipientType && renderedRecipientValue) {
                switch (recipientType.toLowerCase()) {
                    case 'initiator':
                        if (instance.startedBy) {
                            const initiatorUser = await User.findById(instance.startedBy).lean();
                            if (initiatorUser && initiatorUser.email && initiatorUser.isActive) {
                                recipients.push(initiatorUser.email);
                            } else {
                                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Initiator user ${instance.startedBy} not found, inactive, or has no email.`);
                            }
                        } else {
                             console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Recipient type 'initiator', but instance.startedBy is undefined.`);
                        }
                        break;
                    case 'specificemail':
                        if (renderedRecipientValue.includes('@')) {
                            recipients.push(renderedRecipientValue);
                        } else {
                            console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: 'specificEmail' type selected, but value '${renderedRecipientValue}' is not a valid email.`);
                        }
                        break;
                    case 'userbyid':
                        if (mongoose.Types.ObjectId.isValid(renderedRecipientValue)) {
                            const specificUser = await User.findById(renderedRecipientValue).lean();
                            if (specificUser && specificUser.email && specificUser.isActive) {
                                recipients.push(specificUser.email);
                            } else {
                                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: User for ID '${renderedRecipientValue}' not found, inactive, or has no email.`);
                            }
                        } else {
                            console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Invalid ObjectId for 'userById': '${renderedRecipientValue}'`);
                        }
                        break;
                    case 'role':
                        if (renderedRecipientValue && typeof renderedRecipientValue === 'string') {
                            const usersInRole = await User.find({ role: renderedRecipientValue, isActive: true }).lean();
                            usersInRole.forEach(user => { if (user.email) recipients.push(user.email); });
                            if (usersInRole.length === 0) {
                                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: No active users found for role: '${renderedRecipientValue}'`);
                            }
                        } else {
                             console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Invalid or missing role name for 'role' type: '${renderedRecipientValue}'`);
                        }
                        break;
                    case 'fromcontext':
                        if (renderedRecipientValue && typeof renderedRecipientValue === 'string') {
                            if (renderedRecipientValue.includes('@')) {
                                recipients.push(renderedRecipientValue);
                            } else if (mongoose.Types.ObjectId.isValid(renderedRecipientValue)) {
                                const userFromContext = await User.findById(renderedRecipientValue).lean();
                                    if (userFromContext && userFromContext.email && userFromContext.isActive) {
                                        recipients.push(userFromContext.email);
                                    } else {
                                     console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: User ID '${renderedRecipientValue}' (from context) not found, inactive, or has no email.`);
                                    }
                                } else {
                                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Value '${renderedRecipientValue}' (from context) is not a valid email or User ID.`);
                                }
                            } else {
                            console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Context path for recipient (originally '${config.recipientValue}') yielded no valid value or an unexpected type: '${renderedRecipientValue}'.`);
                        }
                        break;
                    default:
                        console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Unsupported recipientType: '${recipientType}'`);
                }
            } else {
                 console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Email notification selected, but recipientType ('${recipientType}') or recipientValueTemplate ('${recipientValueTemplate}' -> '${renderedRecipientValue}') is missing or invalid.`);
            }

            if (recipients.length > 0) {
                const uniqueRecipients = [...new Set(recipients)];
                finalSubject = simpleTemplateRender(subjectTemplate, templateContext);
                finalBody = simpleTemplateRender(bodyTemplate, templateContext); 
                finalRecipientsString = uniqueRecipients.join(', ');
                
                for (const recipient of uniqueRecipients) {
                    console.log(`[NOTIFICATION] Node ${nodeDefinition.id}: Sending email to ${recipient} with subject "${finalSubject}"`);
                    await sendEmail({ to: recipient, subject: finalSubject, text: finalBody });
                }
                console.log(`[NOTIFICATION] Node ${nodeDefinition.id}: Email(s) dispatched to: ${finalRecipientsString}`);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationSent',
                    statusAtEvent: instance.status, message: `Email notification sent to ${finalRecipientsString}.`,
                    details: { type: 'email', recipient: finalRecipientsString, subject: finalSubject, body: finalBody }
                });
            } else {
                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Email notification selected, but no valid recipients were determined.`);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationAttemptFailed',
                    statusAtEvent: instance.status, message: 'Email notification attempted but no valid recipients found.',
                    details: { type: 'email', reason: 'No recipients resolved', config }
                });
            }

        } else if (notificationType === 'log') {
            const messageToLogTemplate = config.logMessageTemplate || templateContext.message || `Notification logged for instance {{instanceId}}, node {{nodeId}}.`;
            finalBody = simpleTemplateRender(messageToLogTemplate, templateContext);
            finalRecipientsString = 'System Log';
            console.log(`[NODE_HANDLER_NOTIFICATION_LOG] ${finalBody}`);
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationLogged',
                statusAtEvent: instance.status, message: `Log notification: ${finalBody}`,
                details: { type: 'log', message: finalBody }
            });
        } else if (notificationType === 'inApp') {
            const userIdTemplate = config.userIdTemplate;
            const messageForInAppTemplate = config.messageTemplate || bodyTemplate;

            const renderedUserId = simpleTemplateRender(userIdTemplate || '', templateContext);
            finalBody = simpleTemplateRender(messageForInAppTemplate, templateContext);

            if (renderedUserId && mongoose.Types.ObjectId.isValid(renderedUserId)) {
                finalRecipientsString = `User ID: ${renderedUserId}`;
                await notificationService.sendNotification({
                    userId: renderedUserId,
                    title: simpleTemplateRender(subjectTemplate, templateContext),
                    message: finalBody,
                    type: 'WORKFLOW_ACTIVITY',
                    payload: {
                        workflowInstanceId: instance._id.toString(),
                        nodeId: nodeDefinition.id,
                    }
                });
                console.log(`[NOTIFICATION] Node ${nodeDefinition.id}: In-app notification sent to user ${renderedUserId}.`);
                await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationSent',
                    statusAtEvent: instance.status, message: `In-app notification sent to user ${renderedUserId}.`,
                    details: { type: 'inApp', recipient: renderedUserId, title: simpleTemplateRender(subjectTemplate, templateContext), message: finalBody }
                });
            } else {
                console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: In-app notification selected, but target user ID ('${renderedUserId}') is missing or invalid.`);
                 await addExecutionHistoryEntry(instance, {
                    nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationAttemptFailed',
                    statusAtEvent: instance.status, message: 'In-app notification attempted but target user ID was invalid or missing.',
                    details: { type: 'inApp', reason: 'Invalid User ID', userIdTemplate, config }
                });
            }
        } else {
            console.warn(`[NOTIFICATION] Node ${nodeDefinition.id}: Unsupported or unconfigured notificationType: '${notificationType}'.`);
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NotificationSkipped',
                statusAtEvent: instance.status, message: `Notification skipped: Unsupported type '${notificationType}'.`,
                details: { type: notificationType, config }
            });
        }

    } catch (error) {
        console.error(`[NODE_HANDLER_NOTIFICATION] Error processing notification for node ${nodeDefinition.id}:`, error);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionError',
            statusAtEvent: instance.status, message: `Error during notification processing: ${error.message}`,
            details: { error: { message: error.message, stack: error.stack }, notificationType, config }
        });
        if (config.failOnError) {
            instance.status = 'Failed';
        instance.errorInfo = {
                message: `Notification node ${nodeLabel} failed: ${error.message}`,
                nodeId: nodeDefinition.id,
                timestamp: new Date()
            };
            throw error;
        }
    }

    const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
    instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
    console.log(`[NODE_HANDLER_NOTIFICATION] Transitioning from Notification Node ${nodeDefinition.id} to: ${instance.currentState.activeNodeIds.join(', ')}`);

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
        statusAtEvent: instance.status,
        message: `Notification node '${nodeLabel}' processing completed. Transitioning.`,
        details: { 
            nextNodeIds: instance.currentState.activeNodeIds,
            notificationType,
            finalRecipients: finalRecipientsString,
        }
    });
};

const handleParallelSplitNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Parallel Split';
    const nodeType = nodeDefinition.data.type;
    const splitNodeId = nodeDefinition.id;

    await addExecutionHistoryEntry(instance, {
        nodeId: splitNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status, message: `Parallel Split node execution initiated: ${nodeLabel}`
    });

    console.log(`[NODE_HANDLER_PARALLEL_SPLIT] Processing ParallelSplit Node ${splitNodeId} for instance ${instance._id}`);

    const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === splitNodeId);
    let nextNodeIds = [];

    if (outgoingEdges.length === 0) {
        console.warn(`[NODE_HANDLER_PARALLEL_SPLIT] ParallelSplit Node ${splitNodeId} has no outgoing edges. Path terminates for this split.`);
    } else {
        for (const edge of outgoingEdges) {
            const targetNodeId = edge.target;
            const targetNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === targetNodeId);
            
            if (targetNodeDefinition && (targetNodeDefinition.data.type === 'ParallelJoin' || targetNodeDefinition.data.type === 'Join')) {
                const joinNodeId = targetNodeDefinition.id;
                
                if (!instance.joinStates) {
                    instance.joinStates = new Map();
                }
                
                const joinState = instance.joinStates.get(joinNodeId) || { arrivedEdgeIds: [] };
                
                if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                    joinState.arrivedEdgeIds.push(edge.id);
                    console.log(`[NODE_HANDLER_PARALLEL_SPLIT] Edge ${edge.id} from split node ${splitNodeId} recorded arrival at Join node ${joinNodeId}.`);
                }
                
                instance.joinStates.set(joinNodeId, joinState);
                instance.markModified('joinStates');
            }
            
            if (!instance.currentState.activeNodeIds.includes(targetNodeId)) {
                nextNodeIds.push(targetNodeId);
            }
        }
        
        instance.currentState.activeNodeIds.push(...nextNodeIds.filter(id => !instance.currentState.activeNodeIds.includes(id)));
        console.log(`[NODE_HANDLER_PARALLEL_SPLIT] Transitioning from ParallelSplit Node ${splitNodeId} to activate multiple nodes: ${nextNodeIds.join(', ')}`);
    }

    await addExecutionHistoryEntry(instance, {
        nodeId: splitNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
        statusAtEvent: instance.status, message: `Parallel Split node ${nodeLabel} processed. Transitioning to ${nextNodeIds.length} branches.`,
        details: { activatedNodeIds: nextNodeIds }
    });
};

const addExecutionHistoryEntry = async (instance, eventData) => {
    if (!instance || !instance._id) {
        console.error('[NODE_HANDLER_HISTORY] Attempted to add history with invalid instance object.', eventData);
        return;
    }


    if (!instance.executionHistory) {
        instance.executionHistory = [];
    }

    const historyEntry = {
        nodeId: eventData.nodeId,
        nodeLabel: eventData.nodeLabel,
        nodeType: eventData.nodeType,
        eventType: eventData.eventType,
        timestamp: eventData.timestamp || new Date(),
        statusAtEvent: eventData.statusAtEvent || instance.status,
        message: eventData.message,
        details: eventData.details || {}
    };

    instance.executionHistory.push(historyEntry);

    try {
        await instance.save();
    } catch (error) {
        if (error.name === 'VersionError') {
            console.warn(`[NODE_HANDLER_HISTORY] VersionError adding history to instance ${instance._id}. Event for node ${eventData.nodeId} may be lost:`, eventData, error.message);
        } else {
            console.error(`[NODE_HANDLER_HISTORY] Error saving instance ${instance._id} after adding history for node ${eventData.nodeId}:`, error, eventData);
        }
    }
};

const handleParallelJoinNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Parallel Join';
    const nodeType = nodeDefinition.data.type;
    const joinNodeId = nodeDefinition.id;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status, message: `Parallel Join node evaluation initiated: ${nodeLabel}`,
        details: { joinNodeId, config }
    });

    console.log(`[NODE_HANDLER_PARALLEL_JOIN] Evaluating ParallelJoin Node ${joinNodeId} for instance ${instance._id}`);

    instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== joinNodeId);

    const allIncomingEdgesToThisJoin = workflowDefinition.flow.edges.filter(
        edge => edge.target === joinNodeId
    );
    const expectedIncomingEdgeIds = new Set(allIncomingEdgesToThisJoin.map(edge => edge.id));
    
    let expectedCount = expectedIncomingEdgeIds.size;
    let joinMode = 'all';
    
    if (config.expectedPaths) {
        if (config.expectedPaths === '1') {
            expectedCount = 1;
            joinMode = 'any';
            console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join ${joinNodeId} configured to proceed after any 1 path arrives (XOR-Join mode)`);
        } else if (config.expectedPaths === 'custom' && config.customExpectedPaths) {
            const customCount = parseInt(config.customExpectedPaths, 10);
            if (!isNaN(customCount) && customCount > 0) {
                expectedCount = Math.min(customCount, expectedIncomingEdgeIds.size);
                joinMode = 'custom';
                console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join ${joinNodeId} configured to wait for ${expectedCount} paths (custom count)`);
            }
        } else if (!isNaN(parseInt(config.expectedPaths, 10))) {
            const directCount = parseInt(config.expectedPaths, 10);
            if (directCount > 0) {
                expectedCount = Math.min(directCount, expectedIncomingEdgeIds.size);
                joinMode = 'custom';
                console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join ${joinNodeId} configured to wait for ${expectedCount} paths (direct count)`);
            }
        }
    } else {
        expectedCount = 1;
        joinMode = 'any';
        console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join ${joinNodeId} has no explicit config, defaulting to 'any' mode (wait for 1 path)`);
    }

    if (allIncomingEdgesToThisJoin.length === 0) {
        console.warn(`[NODE_HANDLER_PARALLEL_JOIN] Join Node ${joinNodeId} has no defined incoming edges in the workflow definition. Proceeding immediately as a pass-through.`);
        const outgoingEdgesFromJoin = workflowDefinition.flow.edges.filter(edge => edge.source === joinNodeId);
        if (outgoingEdgesFromJoin.length > 0) {
            outgoingEdgesFromJoin.forEach(outEdge => {
                if (!instance.currentState.activeNodeIds.includes(outEdge.target)) {
                    instance.currentState.activeNodeIds.push(outEdge.target);
                }
            });
            console.log(`[NODE_HANDLER_PARALLEL_JOIN] Transitioning from Join Node ${joinNodeId} (no expected inputs) to: ${outgoingEdgesFromJoin.map(e => e.target).join(', ')}`);
        } else {
            console.warn(`[NODE_HANDLER_PARALLEL_JOIN] Join Node ${joinNodeId} (no expected inputs) also has no outgoing edges. Path terminates.`);
        }
        await addExecutionHistoryEntry(instance, {
            nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status, message: `Join node ${nodeLabel} processed (no expected inputs). Path ${outgoingEdgesFromJoin.length > 0 ? 'continues' : 'terminates'}.`,
            details: { activatedNodeIds: outgoingEdgesFromJoin.map(e => e.target), reason: 'No expected inputs' }
        });
        return; 
    }

    if (!instance.joinStates) {
        instance.joinStates = new Map();
    }
    
    let joinState = instance.joinStates.get(joinNodeId);
    if (!joinState) {
        joinState = { 
            arrivedEdgeIds: [],
            mode: joinMode,
            expectedCount: expectedCount
        };
    }
    
    let newArrivingEdges = false;
    
    if (instance.lastProcessedNodeId) {
        const incomingEdgesFromLastNode = workflowDefinition.flow.edges.filter(
            edge => edge.source === instance.lastProcessedNodeId && edge.target === joinNodeId
        );
        
        if (incomingEdgesFromLastNode.length > 0) {
            for (const edge of incomingEdgesFromLastNode) {
                if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                    joinState.arrivedEdgeIds.push(edge.id);
                    console.log(`[NODE_HANDLER_PARALLEL_JOIN] Edge ${edge.id} from node ${instance.lastProcessedNodeId} recorded arrival at Join node ${joinNodeId}.`);
                    newArrivingEdges = true;
                }
            }
        }
    }
    
    const allEdges = workflowDefinition.flow.edges;
    for (const edge of allEdges) {
        if (edge.target === joinNodeId) {
            const sourceNode = workflowDefinition.flow.nodes.find(n => n.id === edge.source);
            if (sourceNode && sourceNode.data.type === 'ParallelSplit' && 
                sourceNode.data.config?.autoActivatePaths !== false) {
                
                if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                    joinState.arrivedEdgeIds.push(edge.id);
                    console.log(`[NODE_HANDLER_PARALLEL_JOIN] Edge ${edge.id} from ParallelSplit ${sourceNode.id} auto-registered at join node ${joinNodeId}.`);
                    newArrivingEdges = true;
                }
            }
        }
    }
    
    instance.joinStates.set(joinNodeId, joinState);
    instance.markModified('joinStates');
    
    const arrivedEdgeIds = joinState.arrivedEdgeIds;
    const arrivedEdgeIdsSet = new Set(arrivedEdgeIds);
    const arrivedCount = arrivedEdgeIdsSet.size;
    
    console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join Node ${joinNodeId}: Mode: ${joinMode}, Expected: ${expectedCount}, Current arrived count: ${arrivedCount}. Edge IDs arrived: [${arrivedEdgeIds.join(', ')}]`);

    let hasEnoughPaths = false;
    
    if (joinMode === 'any') {
        hasEnoughPaths = arrivedCount >= 1;
    } else if (joinMode === 'all') {
        hasEnoughPaths = arrivedCount >= expectedIncomingEdgeIds.size;
    } else {
        hasEnoughPaths = arrivedCount >= expectedCount;
    }

    if (hasEnoughPaths) {
        console.log(`[NODE_HANDLER_PARALLEL_JOIN] Sufficient paths (${arrivedCount}/${expectedCount}) have arrived at join ${joinNodeId}. Proceeding.`);
        await addExecutionHistoryEntry(instance, {
            nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'JoinSynchronized',
            statusAtEvent: instance.status, message: `Required branches arrived (${arrivedCount}/${expectedCount}). Join synchronized.`,
            details: { expectedCount, arrivedCount, mode: joinMode, arrivedEdgeIds: Array.from(arrivedEdgeIdsSet) }
        });
        
        instance.joinStates.delete(joinNodeId);
        instance.markModified('joinStates');

        const outgoingEdgesFromJoin = workflowDefinition.flow.edges.filter(edge => edge.source === joinNodeId);
        if (outgoingEdgesFromJoin.length > 0) {
            outgoingEdgesFromJoin.forEach(outEdge => {
                if (!instance.currentState.activeNodeIds.includes(outEdge.target)) {
                    instance.currentState.activeNodeIds.push(outEdge.target);
                }
            });
            console.log(`[NODE_HANDLER_PARALLEL_JOIN] Transitioning from Join Node ${joinNodeId} to: ${outgoingEdgesFromJoin.map(e => e.target).join(', ')}`);
        } else {
            console.warn(`[NODE_HANDLER_PARALLEL_JOIN] Join Node ${joinNodeId} has synchronized but has no outgoing edges. Path terminates here for the instance if no other active paths.`);
        }
        await addExecutionHistoryEntry(instance, {
            nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status, message: `Join node ${nodeLabel} synchronized and processed. Path ${outgoingEdgesFromJoin.length > 0 ? 'continues' : 'terminates'}.`,
            details: { activatedNodeIds: outgoingEdgesFromJoin.map(e => e.target), reason: 'Required branches arrived' }
        });
    } else {
        console.log(`[NODE_HANDLER_PARALLEL_JOIN] Join Node ${joinNodeId} still waiting for other paths. (Arrived: ${arrivedCount}/${expectedCount})`);
        await addExecutionHistoryEntry(instance, {
            nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'JoinWaiting',
            statusAtEvent: instance.status,
            message: `Join node ${nodeLabel} still waiting for ${expectedCount - arrivedCount} more branch(es).`,
            details: { arrivedCount, expectedCount, mode: joinMode, arrivedEdgeIds: Array.from(arrivedEdgeIdsSet) }
        });
        await addExecutionHistoryEntry(instance, {
            nodeId: joinNodeId, nodeLabel, nodeType, eventType: 'NodeExecutionEnd',
            statusAtEvent: instance.status, message: `Join node ${nodeLabel} current evaluation ends (waiting for more branches).`,
            details: { waiting: true }
        });
    }
};

const handleTimerNode = async (instance, nodeDefinition, workflowDefinition, engineAPI) => {
    const nodeLabel = nodeDefinition.data.label || 'Timer';
    const nodeType = nodeDefinition.data.type;
    const config = nodeDefinition.data.config || {};

    await addExecutionHistoryEntry(instance, {
        nodeId: nodeDefinition.id,
        nodeLabel,
        nodeType,
        eventType: 'NodeExecutionStart',
        statusAtEvent: instance.status,
        message: `Timer node execution initiated: ${nodeLabel}`,
        details: { config }
    });

    console.log(`[NODE_HANDLER_TIMER] Processing Timer Node ${nodeDefinition.id} (${nodeLabel}) for instance ${instance._id}`);

    const timerType = config.timerType || 'duration';
    const delayValue = config.delayValue;
    const delayUnit = config.delayUnit;
    const specificResumeAt = config.specificResumeAt;
    const resumeAtContextVar = config.resumeAtContextVar;

    try {
        let waitUntil = null;
        let timerDescription = '';

        switch (timerType) {
            case 'duration':
                if (delayValue && delayUnit) {
                    let delayMs = 0;
                    const numericDelayValue = parseInt(delayValue, 10);
                    
                    if (isNaN(numericDelayValue) || numericDelayValue <= 0) {
                        throw new Error(`Invalid delay value: ${delayValue}`);
                    }
                    
                    switch (delayUnit) {
                        case 'seconds':
                            delayMs = numericDelayValue * 1000;
                            break;
                        case 'minutes':
                            delayMs = numericDelayValue * 60 * 1000;
                            break;
                        case 'hours':
                            delayMs = numericDelayValue * 60 * 60 * 1000;
                            break;
                        case 'days':
                            delayMs = numericDelayValue * 24 * 60 * 60 * 1000;
                            break;
                        default:
                            throw new Error(`Unsupported delay unit: ${delayUnit}`);
                    }
                    
                    waitUntil = new Date(Date.now() + delayMs);
                    timerDescription = `Wait for ${delayValue} ${delayUnit}`;
                } else {
                    throw new Error('Delay value and unit are required for duration timer');
                }
                break;

            case 'specificDateTime':
                if (specificResumeAt) {
                    const scheduledDate = new Date(specificResumeAt);
                    if (!isNaN(scheduledDate.getTime())) {
                        waitUntil = scheduledDate;
                        timerDescription = `Wait until ${scheduledDate.toISOString()}`;
                    } else {
                        throw new Error(`Invalid specific resume date/time: ${specificResumeAt}`);
                    }
                } else {
                    throw new Error('Specific resume date/time not specified for timer node');
                }
                break;

            case 'fromContextVariable':
                if (resumeAtContextVar) {
                    const renderedValue = simpleTemplateRender(resumeAtContextVar, instance.context);
                    
                    if (renderedValue && renderedValue !== resumeAtContextVar) {
                        const contextDate = new Date(renderedValue);
                        if (!isNaN(contextDate.getTime())) {
                            waitUntil = contextDate;
                            timerDescription = `Wait until ${contextDate.toISOString()} (from context: ${resumeAtContextVar})`;
                        } else {
                            const timestamp = parseInt(renderedValue, 10);
                            if (!isNaN(timestamp)) {
                                waitUntil = new Date(timestamp);
                                timerDescription = `Wait until ${waitUntil.toISOString()} (from context timestamp: ${resumeAtContextVar})`;
                            } else {
                                throw new Error(`Context variable ${resumeAtContextVar} contains invalid date/time value: ${renderedValue}`);
                            }
                        }
                    } else {
                        throw new Error(`Context variable ${resumeAtContextVar} not found or could not be resolved`);
                    }
                } else {
                    throw new Error('Context variable path not specified for fromContextVariable timer');
                }
                break;

            default:
                throw new Error(`Unsupported timer type: ${timerType}`);
        }

        if (waitUntil <= new Date()) {
            console.warn(`[NODE_HANDLER_TIMER] Timer ${nodeDefinition.id} wait time ${waitUntil.toISOString()} is in the past. Proceeding immediately.`);
            const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
            instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
            
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id,
                nodeLabel,
                nodeType,
                eventType: 'TimerSkipped',
                statusAtEvent: instance.status,
                message: `Timer skipped: wait time ${waitUntil.toISOString()} is in the past. Proceeding immediately.`,
                details: { 
                    timerType, 
                    waitUntil: waitUntil.toISOString(), 
                    description: timerDescription,
                    nextNodeIds: instance.currentState.activeNodeIds
                }
            });
            
            await addExecutionHistoryEntry(instance, {
                nodeId: nodeDefinition.id,
                nodeLabel,
                nodeType,
                eventType: 'NodeExecutionEnd',
                statusAtEvent: instance.status,
                message: `Timer node ${nodeLabel} processed (skipped - past time). Transitioning to: ${instance.currentState.activeNodeIds.join(', ')}`,
                details: { 
                    waitUntil: waitUntil.toISOString(),
                    timerType,
                    description: timerDescription,
                    nextNodeIds: instance.currentState.activeNodeIds
                }
            });
            return;
        }

        const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === nodeDefinition.id);
        const edgeToFollow = outgoingEdges.length > 0 ? outgoingEdges[0].id : null;
        
        instance.timerResumeDetails = {
            timerNodeId: nodeDefinition.id,
            resumeAt: waitUntil,
            edgeToFollowId: edgeToFollow
        };
        instance.markModified('timerResumeDetails');

        instance.status = 'WaitingForTimer';
        instance.currentState.activeNodeIds = [];

        console.log(`[NODE_HANDLER_TIMER] Instance ${instance._id} set to WaitingForTimer until ${waitUntil.toISOString()}`);

        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel,
            nodeType,
            eventType: 'TimerStarted',
            statusAtEvent: 'WaitingForTimer',
            message: `Timer started: ${timerDescription}`,
            details: { 
                timerType, 
                waitUntil: waitUntil.toISOString(), 
                description: timerDescription,
                edgeToFollow: edgeToFollow
            }
        });

        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel,
            nodeType,
            eventType: 'NodeExecutionEnd',
            statusAtEvent: 'WaitingForTimer',
            message: `Timer node ${nodeLabel} processed. Instance now waiting for timer.`,
            details: { 
                waitUntil: waitUntil.toISOString(),
                timerType,
                description: timerDescription
            }
        });

    } catch (error) {
        console.error(`[NODE_HANDLER_TIMER] Error in Timer Node ${nodeDefinition.id} (${nodeLabel}):`, error.message);
        await addExecutionHistoryEntry(instance, {
            nodeId: nodeDefinition.id,
            nodeLabel,
            nodeType,
            eventType: 'NodeExecutionError',
            statusAtEvent: instance.status,
            message: `Error in timer node ${nodeLabel}: ${error.message}`,
            details: { error: { message: error.message, stack: error.stack }, config }
        });
        throw error;
    }
};

module.exports = {
    Start: handleStartNode,
    End: handleEndNode,
    Task: handleTaskNode,
    Approval: handleApprovalNode,
    Decision: handleDecisionNode,
    AutomatedTask: handleAutomatedTaskNode,
    FileUpload: handleFileUploadNode,
    SubWorkflow: handleSubWorkflowNode,
    Notification: handleNotificationNode,
    ParallelSplit: handleParallelSplitNode,
    ParallelJoin: handleParallelJoinNode,
    Timer: handleTimerNode,
};