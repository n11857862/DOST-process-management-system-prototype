const mongoose = require('mongoose');
const { WorkflowInstance } = require('../api/v1/instances/workflowInstance.model.js');
const Workflow = require('../api/v1/workflows/workflow.model.js');
const nodeHandlers = require('./node.handlers.js');
const Task = require('../api/v1/tasks/task.model.js');

let _workflowInstanceService = null;
const getWorkflowInstanceService = () => {
    if (!_workflowInstanceService) _workflowInstanceService = require('../api/v1/instances/workflowInstance.service.js');
    return _workflowInstanceService;
};

let _taskService = null;
const getTaskService = () => {
    if (!_taskService) _taskService = require('../api/v1/tasks/task.service.js');
    return _taskService;
};

const addEngineEventToInstanceHistory = async (instance, eventData) => {
    if (!instance || !instance._id) {
        console.error('[ENGINE_HISTORY] Attempted to add history with invalid instance object.', eventData);
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
    instance.markModified('executionHistory');
    
    console.log(`[ENGINE_HISTORY] Added event ${eventData.eventType} to instance ${instance._id} history without immediate save.`);
};

const simpleTemplateRender = (templateString, context, returnUndefinedOnFail = false) => {
    if (typeof templateString !== 'string') {
        return templateString;
    }
    if (!(templateString.startsWith('{{') && templateString.endsWith('}}'))) {
        return templateString;
    }

    const path = templateString.substring(2, templateString.length - 2).trim();
    if (!path) {
        console.warn(`[TEMPLATE_RENDER] Empty path in template string: "${templateString}".`);
        return returnUndefinedOnFail ? undefined : templateString;
    }
    const keys = path.split('.');
    let value = context;
    try {
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                console.warn(`[TEMPLATE_RENDER] Path "${path}" (from template "${templateString}") not fully resolved in context:`, context);
                return returnUndefinedOnFail ? undefined : templateString;
            }
        }
        return value;
    } catch (e) {
        console.error(`[TEMPLATE_RENDER] Error resolving path "${path}" (from template "${templateString}"):`, e);
        return returnUndefinedOnFail ? undefined : templateString;
    }
};

let resumeParentWorkflowInternal;

const triggerExecution = async (instanceId) => {
    
    if (!mongoose.Types.ObjectId.isValid(instanceId)) {
        console.error(`[ENGINE] Invalid instanceId provided: ${instanceId}`);
        throw new Error('Invalid instance ID for triggerExecution.');
    }


    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance) {
        console.error(`[ENGINE] WorkflowInstance not found: ${instanceId}`);
        throw new Error('WorkflowInstance not found.');
    }


    const historyEventsToAdd = [];
    
    const queueHistoryEvent = (instance, eventData) => {
        if (!instance || !instance._id) {
            console.error('[ENGINE_HISTORY] Attempted to queue history with invalid instance object.', eventData);
            return;
        }
        historyEventsToAdd.push({
            instance,
            eventData
        });
        console.log(`[ENGINE_HISTORY] Queued event ${eventData.eventType} for instance ${instance._id} to be saved later.`);
    };

    if (['Completed', 'Failed', 'Terminated'].includes(instance.status)) {
        console.log(`[ENGINE] Instance ${instanceId} is already in a terminal state (${instance.status}). No further processing.`);
        queueHistoryEvent(instance, {
            eventType: 'ExecutionAttemptIgnored',
            message: `Execution trigger ignored: Instance already in terminal state ${instance.status}.`,
            details: { currentStatus: instance.status }
        });
        return instance;
    }
    
    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        console.error(`[ENGINE] Workflow Definition ${instance.workflowDefinitionId} not found for instance ${instanceId}`);
        const oldStatus = instance.status;
        instance.status = 'Failed';
        instance.errorInfo = { message: 'Associated workflow definition not found.', timestamp: new Date() };
        await instance.save();
        queueHistoryEvent(instance, {
            eventType: 'InstanceStatusChange',
            statusAtEvent: oldStatus,
            message: `Instance Failed: Associated workflow definition ${instance.workflowDefinitionId} not found.`,
            details: { newStatus: 'Failed', reason: 'DefinitionMissing' }
        });
        throw new Error('Associated workflow definition not found.');
    }

    console.log(`[ENGINE] Triggering execution for instance ${instance._id}, status: ${instance.status}, active nodes: [${instance.currentState.activeNodeIds.join(', ')}]`);
    queueHistoryEvent(instance, {
        eventType: 'ExecutionCycleStart',
        message: `Execution cycle starting. Current status: ${instance.status}. Active nodes: ${instance.currentState.activeNodeIds.join(', ') || 'None'}.`,
        details: { activeNodeIds: [...instance.currentState.activeNodeIds], currentStatus: instance.status }
    });

    const initialStatusBeforeLoop = instance.status;
    if (instance.status === 'Not Started' || 
        instance.status === 'Suspended' || 
        instance.status === 'WaitingForSubWorkflow' || 
        instance.status === 'AwaitingFileUpload') {
        if (instance.currentState.activeNodeIds && instance.currentState.activeNodeIds.length > 0) {
            instance.status = 'Running';
        } else if (instance.status === 'Not Started') {
            instance.status = 'Running'; 
        }
    }
    if (instance.status !== initialStatusBeforeLoop) {
        queueHistoryEvent(instance, {
            eventType: 'InstanceStatusChange',
            statusAtEvent: initialStatusBeforeLoop,
            message: `Instance status changed from ${initialStatusBeforeLoop} to ${instance.status} at start of execution cycle.`,
            details: { oldStatus: initialStatusBeforeLoop, newStatus: instance.status, reason: 'CycleStartTransition' }
        });
    }

    const engineAPIForHandlers = {
        triggerExecution,
        services: {
            get workflowInstance() { return getWorkflowInstanceService(); },
            get task() { return getTaskService(); }
        }
    };

    const registerPathsToJoinNodes = (sourceNodeId) => {
        const edgesFromSource = workflowDefinition.flow.edges.filter(edge => edge.source === sourceNodeId);
        
        for (const edge of edgesFromSource) {
            const targetNode = workflowDefinition.flow.nodes.find(n => n.id === edge.target);
            if (targetNode && ['ParallelJoin', 'Join'].includes(targetNode.data?.type)) {
                const joinNodeId = targetNode.id;
                
                if (!instance.joinStates) {
                    instance.joinStates = new Map();
                }
                
                const joinState = instance.joinStates.get(joinNodeId) || { arrivedEdgeIds: [] };
                
                if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                    joinState.arrivedEdgeIds.push(edge.id);
                    console.log(`[ENGINE] Edge ${edge.id} from node ${sourceNodeId} auto-registered at Join node ${joinNodeId}.`);
                }
                
                instance.joinStates.set(joinNodeId, joinState);
                instance.markModified('joinStates');
            }
        }
    };
    
    let iterationGuard = 0;
    const MAX_ITERATIONS = workflowDefinition.flow.nodes.length + 10;
    
    while (
        instance.status === 'Running' && 
        instance.currentState.activeNodeIds && 
        instance.currentState.activeNodeIds.length > 0 && 
        iterationGuard < MAX_ITERATIONS
    ) {
        iterationGuard++;
        const currentNodeId = instance.currentState.activeNodeIds.shift();
        
        instance.lastProcessedNodeId = currentNodeId;
        
        registerPathsToJoinNodes(currentNodeId);
        
        const nodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === currentNodeId);

        if (!nodeDefinition) {
            console.error(`[ENGINE] Node definition for ID ${currentNodeId} not found in workflow ${workflowDefinition.name}.`);
            const oldStatus = instance.status;
            instance.status = 'Failed';
            instance.errorInfo = { message: `Node definition ${currentNodeId} not found.`, nodeId: currentNodeId, timestamp: new Date() };
            queueHistoryEvent(instance, {
                eventType: 'InstanceStatusChange',
                statusAtEvent: oldStatus,
                message: `Instance Failed: Node definition ${currentNodeId} not found.`,
                details: { newStatus: 'Failed', reason: 'NodeDefinitionMissing', missingNodeId: currentNodeId }
            });
            break; 
        }

        const nodeType = nodeDefinition.data?.type;
        const handler = nodeHandlers[nodeType];

        if (handler && typeof handler === 'function') {
            console.log(`[ENGINE] Executing handler for node ${currentNodeId} (Type: ${nodeType})`);
            let handlerCompletedSuccessfully = true;
            try {
                await handler(instance, nodeDefinition, workflowDefinition, engineAPIForHandlers);
            } catch (handlerError) {
                handlerCompletedSuccessfully = false;
                console.error(`[ENGINE] Error caught from handler for node ${currentNodeId} (Type: ${nodeType}):`, handlerError.message, handlerError.stack);
                
                const errorEdges = workflowDefinition.flow.edges.filter(
                    edge => edge.source === currentNodeId && edge.data?.conditionType === 'error'
                );

                if (errorEdges.length > 0) {
                    const errorPathTargetNodeId = errorEdges[0].target;
                    instance.currentState.activeNodeIds.push(errorPathTargetNodeId);
                    instance.status = 'Running';
                    
                    instance.errorInfo = { 
                        message: handlerError.message || 'Error in node handler (routing to error path).', 
                        nodeId: currentNodeId, 
                        details: handlerError.toString(),
                        timestamp: new Date() 
                    };
                    
                    console.log(`[ENGINE] Transitioning to error path from ${currentNodeId} to ${errorPathTargetNodeId}.`);
                    queueHistoryEvent(instance, {
                        nodeId: currentNodeId, nodeType, nodeLabel: nodeDefinition.data?.label,
                        eventType: 'NodeExecutionErrorRouted',
                        message: `Error in node ${currentNodeId} (${nodeType}): ${handlerError.message}. Transitioning to error path node ${errorPathTargetNodeId}.`,
                        details: { error: { message: handlerError.message, stack: handlerError.stack }, erroredNodeId: currentNodeId, errorPathTargetNodeId }
                    });
                } else {
                    const oldStatus = instance.status;
                    instance.status = 'Failed';
                    instance.errorInfo = { 
                        message: handlerError.message || 'Error in node handler.', 
                        nodeId: currentNodeId, 
                        details: handlerError.toString(),
                        timestamp: new Date() 
                    };
                    instance.currentState.activeNodeIds = [];
                    console.log(`[ENGINE] Node ${currentNodeId} failed and no error path defined. Instance failed.`);
                    queueHistoryEvent(instance, {
                        nodeId: currentNodeId, nodeType, nodeLabel: nodeDefinition.data?.label,
                        eventType: 'InstanceStatusChange',
                        statusAtEvent: oldStatus,
                        message: `Instance Failed: Error in node ${currentNodeId} (${nodeType}): ${handlerError.message}. No error path defined.`,
                        details: { newStatus: 'Failed', reason: 'NodeHandlerError_NoRoute', erroredNodeId: currentNodeId, error: { message: handlerError.message, stack: handlerError.stack } }
                    });
                    break;
                }
            }
            
            if (instance.status !== 'Running') {
                console.log(`[ENGINE] Instance ${instanceId} status changed to ${instance.status} by handler or error path. Ending current processing burst.`);
                break;
            }
        } else {
            console.warn(`[ENGINE] No handler found for node type: ${nodeType} (Node ID: ${currentNodeId}). Path terminates here for this node.`);
            queueHistoryEvent(instance, {
                nodeId: currentNodeId, nodeType, nodeLabel: nodeDefinition.data?.label,
                eventType: 'NodeSkipped',
                message: `Node ${currentNodeId} (Type: ${nodeType}) skipped: No handler found.`,
                details: { reason: 'NoHandler' }
            });
        }
    }

    if (iterationGuard >= MAX_ITERATIONS) {
        console.warn(`[ENGINE] Max iterations reached for instance ${instanceId}. Possible infinite loop. Marking as failed.`);
        const oldStatus = instance.status;
        instance.status = 'Failed';
        instance.errorInfo = { message: 'Max processing iterations reached, potential loop.', timestamp: new Date() };
        instance.currentState.activeNodeIds = [];
        queueHistoryEvent(instance, {
            eventType: 'InstanceStatusChange',
            statusAtEvent: oldStatus,
            message: `Instance Failed: Maximum processing iterations (${MAX_ITERATIONS}) reached.`,
            details: { newStatus: 'Failed', reason: 'MaxIterationsExceeded', iterationCount: iterationGuard }
        });
    }
    
    const statusBeforePostLoop = instance.status;
    let suspendReason = null;

    if (statusBeforePostLoop === 'Running') {
        const openTasks = await Task.countDocuments({ 
            workflowInstanceId: instance._id, 
            status: { $in: ['Pending', 'In Progress', 'Needs Rework', 'Escalated'] } 
        });
        
        if (openTasks > 0) {
            suspendReason = 'Suspended';
            console.log(`[ENGINE] Instance ${instance._id} has ${openTasks} open tasks. Setting status to Suspended.`);
        }
        else if (instance.timerResumeDetails && instance.timerResumeDetails.resumeAt && instance.timerResumeDetails.resumeAt > new Date()) {
            suspendReason = 'WaitingForTimer';
            console.log(`[ENGINE] Instance ${instance._id} is waiting for timer ${instance.timerResumeDetails.timerNodeId} to resume at ${instance.timerResumeDetails.resumeAt}. Setting status to WaitingForTimer.`);
        }
        else if (instance.pendingSubWorkflows && instance.pendingSubWorkflows.length > 0) {
            suspendReason = 'WaitingForSubWorkflow';
            console.log(`[ENGINE] Instance ${instance._id} has pending sub-workflows. Setting status to WaitingForSubWorkflow.`);
        }
        else if (instance.pendingActionDetails && instance.pendingActionDetails.nodeId) {
            suspendReason = 'AwaitingFileUpload';
            console.log(`[ENGINE] Instance ${instance._id} is awaiting file upload. Setting status to AwaitingFileUpload.`);
        }
        
        if (suspendReason) {
            instance.status = suspendReason;
        } else if (instance.currentState.activeNodeIds.length === 0) {
            if (workflowDefinition.settings?.autoCompleteOnImplicitEnd === true) {
                instance.status = 'Completed';
                instance.completedAt = new Date();
                console.log(`[ENGINE] Auto-completing instance ${instance._id} due to implicit end (no more active nodes).`);
            } else {
                queueHistoryEvent(instance, {
                    eventType: 'ExecutionStalled',
                    message: `Instance is Running with no active nodes and no explicit suspend conditions. Workflow may be stalled or awaiting an EndNode.`,
                    details: { activeNodeIds: [], openTasks, timerDetails: instance.timerResumeDetails, pendingSubWorkflows: instance.pendingSubWorkflows?.length }
                });
            }
        }
    }
    if (instance.status !== statusBeforePostLoop) {
        queueHistoryEvent(instance, {
            eventType: 'InstanceStatusChange',
            statusAtEvent: statusBeforePostLoop,
            message: `Instance status changed from ${statusBeforePostLoop} to ${instance.status} after execution cycle processing.`,
            details: { oldStatus: statusBeforePostLoop, newStatus: instance.status, reason: `PostLoop_${suspendReason || (instance.status === 'Completed' ? 'ImplicitEnd' : 'StateReevaluation')}` }
        });
    }

    
    console.log(`[ENGINE] Finalizing instance ${instance._id} state. Status: ${instance.status}, Current in-memory version (__v): ${instance.__v}, Pending modified paths: ${instance.modifiedPaths().join(', ')}`);

    if (instance.executionHistory === undefined) {
        instance.executionHistory = [];
    }
    
    historyEventsToAdd.forEach(entry => {
        const historyEntry = {
            nodeId: entry.eventData.nodeId,
            nodeLabel: entry.eventData.nodeLabel,
            nodeType: entry.eventData.nodeType,
            eventType: entry.eventData.eventType,
            timestamp: entry.eventData.timestamp || new Date(),
            statusAtEvent: entry.eventData.statusAtEvent || entry.instance.status,
            message: entry.eventData.message,
            details: entry.eventData.details || {}
        };
        instance.executionHistory.push(historyEntry);
    });
    
    instance.markModified('executionHistory');
    
    try {
        await instance.save();
        console.log(`[ENGINE] Instance ${instance._id} successfully saved after main loop with ${historyEventsToAdd.length} history events. New version: ${instance.__v}`);
    } catch (error) {
        console.error(`[ENGINE] Error saving instance ${instance._id} after execution:`, error);
        if (error.name === 'VersionError' || error.name === 'ParallelSaveError') {
            console.warn(`[ENGINE] Attempting recovery from ${error.name} for instance ${instance._id}.`);
            try {
                const freshInstance = await WorkflowInstance.findById(instance._id);
                if (freshInstance) {
                    freshInstance.status = instance.status;
                    freshInstance.currentState = instance.currentState;
                    freshInstance.context = instance.context;
                    
                    freshInstance.executionHistory.push({
                        eventType: 'RecoveryExecution',
                        timestamp: new Date(),
                        statusAtEvent: freshInstance.status,
                        message: `Execution recovered after ${error.name}. Final status: ${freshInstance.status}`,
                        details: { 
                            activeNodeIds: freshInstance.currentState.activeNodeIds,
                            recoveryReason: error.message
                        }
                    });
                    
                    await freshInstance.save();
                    console.log(`[ENGINE] Recovered instance ${freshInstance._id} state after ${error.name}.`);
                    
                    instance = freshInstance;
                }
            } catch (recoveryError) {
                console.error(`[ENGINE] Recovery attempt failed for instance ${instance._id}:`, recoveryError);
                throw error;
            }
        } else {
            throw error;
        }
    }
    
    if (['Completed', 'Failed'].includes(instance.status) && instance.parentInstanceId && instance.parentNodeIdInParent) {
        console.log(`[ENGINE] Sub-workflow instance ${instance._id} has finished with status ${instance.status}. Attempting to resume parent ${instance.parentInstanceId}.`);
        try {
            await resumeParentWorkflowInternal(
                instance.parentInstanceId,
                instance.parentNodeIdInParent,
                instance.status,
                instance,
                engineAPIForHandlers.services
            );
        } catch (resumeError) {
            console.error(`[ENGINE] Error resuming parent workflow ${instance.parentInstanceId} from sub-workflow ${instance._id}:`, resumeError);
        }
    }
    return instance;
};

resumeParentWorkflowInternal = async (parentInstanceId, parentNodeIdInParent, subWorkflowStatus, subWorkflowDocument, services) => {
    let parentInstanceForHistory = await WorkflowInstance.findById(parentInstanceId);
    if (!parentInstanceForHistory) {
        console.error(`[ENGINE_HISTORY_PARENT_RESUME] Parent instance ${parentInstanceId} not found when trying to log ParentResumptionStart.`);
    } else {
        queueHistoryEvent(parentInstanceForHistory, {
            eventType: 'ParentResumptionStart',
            nodeId: parentNodeIdInParent,
            message: `Attempting to resume parent instance ${parentInstanceId} from sub-workflow node ${parentNodeIdInParent}. Sub-workflow ${subWorkflowDocument._id} finished with status: ${subWorkflowStatus}.`,
            details: { parentNodeIdInParent, subWorkflowInstanceId: subWorkflowDocument._id.toString(), subWorkflowStatus, subWorkflowContextSnapshot: subWorkflowDocument.context }
        });
    }

    let parentInstance = await WorkflowInstance.findById(parentInstanceId);
    if (!parentInstance) {
        console.error(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstanceId} not found when trying to resume (initial fetch).`);
        return;
    }

    const wasExpectingThisSubWorkflowPath = parentInstance.pendingSubWorkflows.some(
        sw => sw.nodeId === parentNodeIdInParent && sw.subInstanceId.toString() === subWorkflowDocument._id.toString()
    );

    if (!wasExpectingThisSubWorkflowPath && (parentInstance.status !== 'WaitingForSubWorkflow' && parentInstance.status !== 'Running')) {
         console.warn(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstanceId} (status: ${parentInstance.status}) might not be expecting flow continuation from sub-workflow node ${parentNodeIdInParent}. Attempting to clean up pending entry for sub-instance ${subWorkflowDocument._id}.`);
         parentInstance.pendingSubWorkflows = parentInstance.pendingSubWorkflows.filter(
             sw => !(sw.nodeId === parentNodeIdInParent && sw.subInstanceId.toString() === subWorkflowDocument._id.toString())
         );
         if (parentInstance.isModified('pendingSubWorkflows')) {
            try {
                await parentInstance.save();
            } catch (saveErr) {
                console.error(`[ENGINE_RESUME_PARENT] Error saving parent instance ${parentInstanceId} during early cleanup:`, saveErr);
                if (saveErr.name === 'VersionError') {
                     console.warn(`[ENGINE_RESUME_PARENT] VersionError during early cleanup for parent ${parentInstanceId}. Modifications might be lost.`);
                }
            }
         }
         return;
    }

    const parentWorkflowDefinition = await Workflow.findById(parentInstance.workflowDefinitionId).lean();
    if (!parentWorkflowDefinition) {
        console.error(`[ENGINE_RESUME_PARENT] Parent workflow definition ${parentInstance.workflowDefinitionId} not found for instance ${parentInstanceId}. Failing parent.`);
        const oldStatus = parentInstance.status;
        parentInstance.status = 'Failed';
        parentInstance.errorInfo = { message: `Parent workflow definition not found during sub-workflow resume.`, nodeId: parentNodeIdInParent, timestamp: new Date() };
        try { 
            await parentInstance.save(); 
            queueHistoryEvent(parentInstance, {
                eventType: 'InstanceStatusChange',
                statusAtEvent: oldStatus,
                message: `Parent Instance ${parentInstanceId} Failed: Definition ${parentInstance.workflowDefinitionId} not found during sub-workflow resume.`,
                details: { newStatus: 'Failed', reason: 'ParentDefinitionMissing_SubWorkflowResume', parentNodeIdInParent, subWorkflowInstanceId: subWorkflowDocument._id.toString() }
            });
        } catch(e) { console.error(`[ENGINE_RESUME_PARENT] Failed to save parent instance ${parentInstanceId} after definition not found:`, e)}
        return;
    }

    const subWorkflowNodeInParentDefinition = parentWorkflowDefinition.flow.nodes.find(n => n.id === parentNodeIdInParent);
    if (!subWorkflowNodeInParentDefinition) {
        console.error(`[ENGINE_RESUME_PARENT] Node ${parentNodeIdInParent} (SubWorkflowNode) not found in parent workflow definition ${parentWorkflowDefinition.name}. Failing parent.`);
        const oldStatus = parentInstance.status;
        parentInstance.status = 'Failed';
        parentInstance.errorInfo = { message: `SubWorkflowNode definition ${parentNodeIdInParent} not found in parent during resume.`, nodeId: parentNodeIdInParent, timestamp: new Date() };
        try {
            await parentInstance.save();
            queueHistoryEvent(parentInstance, {
                eventType: 'InstanceStatusChange',
                statusAtEvent: oldStatus,
                message: `Parent Instance ${parentInstanceId} Failed: SubWorkflowNode definition ${parentNodeIdInParent} not found during sub-workflow resume.`,
                details: { newStatus: 'Failed', reason: 'ParentNodeDefinitionMissing_SubWorkflowResume', parentNodeIdInParent, subWorkflowInstanceId: subWorkflowDocument._id.toString() }
            });
        } catch(e) { console.error(`[ENGINE_RESUME_PARENT] Failed to save parent ${parentInstanceId} after sub-workflow node def not found:`, e)}
        return;
    }

    const initialParentStatus = parentInstance.status;
    const subWorkflowNodeConfig = subWorkflowNodeInParentDefinition.data.config || {};
    if (subWorkflowStatus === 'Completed' && subWorkflowNodeConfig.outputMapping) {
        let outputMappingDefinition = subWorkflowNodeConfig.outputMapping;
        if (typeof outputMappingDefinition === 'string') {
            try {
                outputMappingDefinition = JSON.parse(outputMappingDefinition || '{}');
            } catch (e) {
                console.error(`[ENGINE_RESUME_PARENT] Failed to parse outputMapping JSON for node ${parentNodeIdInParent}:`, e);
                outputMappingDefinition = {};
            }
        }

        if (typeof outputMappingDefinition === 'object' && Object.keys(outputMappingDefinition).length > 0) {
            console.log(`[ENGINE_RESUME_PARENT] Applying output mapping for parent ${parentInstance._id}:`, outputMappingDefinition);
            const contextForTemplating = subWorkflowDocument.context || {};
            let appliedMappingsCount = 0;
            for (const parentKey in outputMappingDefinition) {
                if (Object.prototype.hasOwnProperty.call(outputMappingDefinition, parentKey)) {
                    const valueSourceFromSub = outputMappingDefinition[parentKey];
                    const resolvedValue = simpleTemplateRender(valueSourceFromSub, contextForTemplating, true);

                    if (resolvedValue !== undefined) {
                        parentInstance.context[parentKey] = resolvedValue;
                        console.log(`[ENGINE_RESUME_PARENT] Output Mapped to parent key '${parentKey}': from sub-workflow -> value '${JSON.stringify(resolvedValue)}'`);
                        appliedMappingsCount++;
                    } else {
                        console.log(`[ENGINE_RESUME_PARENT] Output key '${parentKey}' not set for parent instance ${parentInstance._id} as source value from sub-workflow was undefined or template path not found.`);
                    }
                }
            }
            parentInstance.markModified('context');
            if (appliedMappingsCount > 0) {
                queueHistoryEvent(parentInstance, {
                    eventType: 'ContextUpdate',
                    nodeId: parentNodeIdInParent,
                    message: `Output from sub-workflow ${subWorkflowDocument._id} mapped to parent context.`,
                    details: { subWorkflowInstanceId: subWorkflowDocument._id.toString(), mappedKeys: Object.keys(outputMappingDefinition), }
                });
            }
        } else {
            console.log(`[ENGINE_RESUME_PARENT] No output mapping defined or mapping is empty for node ${parentNodeIdInParent} in parent instance ${parentInstance._id}.`);
        }
    }
    
    parentInstance.context[`${parentNodeIdInParent}_subInstanceId`] = subWorkflowDocument._id;
    parentInstance.context[`${parentNodeIdInParent}_subInstanceStatus`] = subWorkflowStatus;
    if (['Failed', 'Terminated', 'Cancelled'].includes(subWorkflowStatus)) {
        parentInstance.context[`${parentNodeIdInParent}_subInstanceError`] = subWorkflowDocument.errorInfo || { message: `Sub-workflow ${subWorkflowStatus}` };
    }
    parentInstance.markModified('context');

    parentInstance.pendingSubWorkflows = parentInstance.pendingSubWorkflows.filter(
        sw => !(sw.nodeId === parentNodeIdInParent && sw.subInstanceId.toString() === subWorkflowDocument._id.toString())
    );
    parentInstance.markModified('pendingSubWorkflows');

    let shouldTriggerParent = false;
    let edgesToFollow = [];

    parentInstance.currentState.activeNodeIds = parentInstance.currentState.activeNodeIds.filter(id => id !== parentNodeIdInParent);

    if (parentInstance.status === 'Failed') {
        console.log(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstanceId} is already in Failed state. No further flow processing from this sub-workflow outcome.`);
    } else if (subWorkflowStatus === 'Completed') {
        edgesToFollow = parentWorkflowDefinition.flow.edges.filter(
            edge => edge.source === parentNodeIdInParent && edge.data?.conditionType !== 'error' && edge.data?.conditionType !== 'onError'
        );
        if (edgesToFollow.length === 0) {
            console.warn(`[ENGINE_RESUME_PARENT] SubWorkflowNode ${parentNodeIdInParent} in parent ${parentInstance._id} completed but has no normal outgoing edges.`);
        }
    } else if (['Failed', 'Terminated', 'Cancelled'].includes(subWorkflowStatus)) {
        edgesToFollow = parentWorkflowDefinition.flow.edges.filter(
            edge => edge.source === parentNodeIdInParent && (edge.data?.conditionType === 'error' || edge.data?.conditionType === 'onError')
        );
        if (edgesToFollow.length > 0) {
            console.log(`[ENGINE_RESUME_PARENT] Sub-workflow ${subWorkflowDocument._id} ended with status ${subWorkflowStatus}. Following error path in parent ${parentInstance._id}.`);
            parentInstance.errorInfo = {
                message: `Sub-workflow (node ${parentNodeIdInParent}, instance ${subWorkflowDocument._id}) ${subWorkflowStatus}. Routed to error path.`,
                nodeId: parentNodeIdInParent,
                timestamp: new Date(),
                subWorkflowInstanceId: subWorkflowDocument._id,
                subWorkflowError: subWorkflowDocument.errorInfo || { message: `Sub-workflow ${subWorkflowStatus}` }
            };
            parentInstance.markModified('errorInfo');
        } else {
            console.log(`[ENGINE_RESUME_PARENT] Sub-workflow ${subWorkflowDocument._id} ${subWorkflowStatus}, and no error path defined in parent ${parentInstance._id}. Parent instance will be marked as Failed.`);
            parentInstance.status = 'Failed';
            parentInstance.errorInfo = {
                message: `Sub-workflow (node ${parentNodeIdInParent}, instance ${subWorkflowDocument._id}) ${subWorkflowStatus}. No error path, parent failed.`,
                nodeId: parentNodeIdInParent,
                timestamp: new Date(),
                subWorkflowInstanceId: subWorkflowDocument._id,
                subWorkflowError: subWorkflowDocument.errorInfo || { message: `Sub-workflow ${subWorkflowStatus}` }
            };
            parentInstance.currentState.activeNodeIds = [];
        }
    }

    if (parentInstance.status !== 'Failed' && edgesToFollow.length > 0) {
        for (const edge of edgesToFollow) {
            const nextNodeId = edge.target;
            const nextNodeDefinition = parentWorkflowDefinition.flow.nodes.find(n => n.id === nextNodeId);

            if (nextNodeDefinition && (nextNodeDefinition.data.type === 'ParallelJoin' || nextNodeDefinition.data.type === 'Join')) {
                const joinNodeId = nextNodeDefinition.id;
                if (!parentInstance.joinStates) {
                    parentInstance.joinStates = new Map();
                } else if (!(parentInstance.joinStates instanceof Map)) {
                    parentInstance.joinStates = new Map(Object.entries(parentInstance.joinStates || {}));
                }
                
                let joinState = parentInstance.joinStates.get(joinNodeId) || { arrivedEdgeIds: [], status: 'pending' };
                if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                    joinState.arrivedEdgeIds.push(edge.id);
                    console.log(`[ENGINE_RESUME_PARENT] Edge ${edge.id} (from resumed SubWorkflow ${parentNodeIdInParent}, sub-status: ${subWorkflowStatus}) recorded arrival at Join node ${joinNodeId} in parent ${parentInstance._id}. Arrived: ${joinState.arrivedEdgeIds.length}`);
                }
                parentInstance.joinStates.set(joinNodeId, joinState);
                parentInstance.markModified('joinStates');
            }
            
            if (!parentInstance.currentState.activeNodeIds.includes(nextNodeId)) {
                parentInstance.currentState.activeNodeIds.push(nextNodeId);
            }
        }
    }
    
    if (parentInstance.status !== 'Failed') {
        if (parentInstance.pendingSubWorkflows.length === 0) {
            if (parentInstance.currentState.activeNodeIds.length > 0) {
                parentInstance.status = 'Running';
            } else {
                console.log(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstance._id} has no more pending sub-workflows and no new active nodes from this sub-workflow's path. Will be re-evaluated by engine.`);
                parentInstance.status = 'Running';
            }
        } else {
            parentInstance.status = 'WaitingForSubWorkflow'; 
            console.log(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstanceId} still has ${parentInstance.pendingSubWorkflows.length} pending sub-workflows. Status: ${parentInstance.status}.`);
        }
        shouldTriggerParent = true;
    } else { 
         shouldTriggerParent = false;
    }
    
    parentInstance.markModified('currentState.activeNodeIds');
    parentInstance.markModified('status');

    let savedSuccessfully = false;
    try {
        await parentInstance.save();
        savedSuccessfully = true;
    } catch (saveError) {
        if (saveError.name === 'VersionError') {
            console.warn(`[ENGINE_RESUME_PARENT] VersionError saving parent instance ${parentInstanceId} (version ${parentInstance.__v}) after sub-workflow. Path: ${saveError.modifiedPaths?.join(',')}. Another process may have updated it. Re-triggering parent might resolve or indicates deeper contention.`);
            if (shouldTriggerParent && parentInstance.status === 'Running' && parentInstance.currentState.activeNodeIds.length > 0) {
                console.log(`[ENGINE_RESUME_PARENT] Attempting to trigger parent ${parentInstanceId} despite VersionError, hoping next cycle reconciles.`);
                module.exports.triggerExecution(parentInstance._id.toString()).catch(err => {
                    console.error(`[ENGINE_RESUME_PARENT] Error re-triggering parent instance ${parentInstance._id} after VersionError:`, err);
                });
            }
        } else {
            console.error(`[ENGINE_RESUME_PARENT] Critical error saving parent instance ${parentInstanceId} after sub-workflow:`, saveError);
        }
        return;
    }
    
    if (savedSuccessfully && shouldTriggerParent && parentInstance.status === 'Running' && parentInstance.currentState.activeNodeIds.length > 0) {
        queueHistoryEvent(parentInstance, {
            eventType: 'ParentResumptionTrigger',
            nodeId: parentNodeIdInParent,
            message: `Parent instance ${parentInstanceId} re-triggered after sub-workflow ${subWorkflowDocument._id} completion.`,
            details: { parentNodeIdInParent, subWorkflowInstanceId: subWorkflowDocument._id.toString(), subWorkflowStatus, newActiveNodeIds: [...parentInstance.currentState.activeNodeIds] }
        });
        console.log(`[ENGINE_RESUME_PARENT] Triggering execution for resumed parent instance ${parentInstance._id}. Active nodes: [${parentInstance.currentState.activeNodeIds.join(',')}]`);
        module.exports.triggerExecution(parentInstance._id.toString()).catch(err => {
            console.error(`[ENGINE_RESUME_PARENT] Error re-triggering parent instance ${parentInstance._id}:`, err);
        });
    } else if (savedSuccessfully) {
        console.log(`[ENGINE_RESUME_PARENT] Parent instance ${parentInstance._id} status: ${parentInstance.status}, Active Nodes: ${parentInstance.currentState.activeNodeIds.length}. Not re-triggering now or no active nodes.`);
    }

    if (parentInstance.status !== initialParentStatus) {
         queueHistoryEvent(parentInstance, {
            eventType: 'InstanceStatusChange',
            statusAtEvent: initialParentStatus,
            message: `Parent instance ${parentInstanceId} status changed from ${initialParentStatus} to ${parentInstance.status} after sub-workflow ${subWorkflowDocument._id} (${subWorkflowStatus}) completion.`,
            details: { oldStatus: initialParentStatus, newStatus: parentInstance.status, reason: 'SubWorkflowResumption', parentNodeIdInParent, subWorkflowInstanceId: subWorkflowDocument._id.toString(), subWorkflowStatus }
        });
    }
};

module.exports = {
    triggerExecution,
    addEngineEventToInstanceHistory,
};