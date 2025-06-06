const mongoose = require('mongoose');
const Task = require('./task.model.js');
console.log('[TASK_SERVICE] Task Schema Paths:', Object.keys(Task.schema.paths));
const { WorkflowInstance } = require('../instances/workflowInstance.model.js');
const Workflow = require('../workflows/workflow.model.js');
const { triggerExecution } = require('../../../engine/workflow.engine.js');
const File = require('../files/file.model.js');
const {User, USER_ROLES} = require('../users/user.model.js');

const addTaskActionToInstanceHistory = async (instanceId, eventData) => {
    if (!instanceId) {
        console.error('[TASK_SERVICE_HISTORY] Attempted to add history with no instanceId.', eventData);
        return;
    }
    try {
        const instance = await WorkflowInstance.findById(instanceId);
        if (!instance) {
            console.error(`[TASK_SERVICE_HISTORY] WorkflowInstance ${instanceId} not found when trying to add task action history.`);
            return;
        }
        if (!instance.executionHistory) {
            instance.executionHistory = [];
        }
        const historyEntry = {
            nodeId: eventData.nodeId,
            nodeLabel: eventData.nodeLabel || 'Task Action',
            nodeType: eventData.nodeType || 'Task',
            eventType: eventData.eventType,
            timestamp: eventData.timestamp || new Date(),
            statusAtEvent: instance.status,
            message: eventData.message,
            details: eventData.details || {}
        };
        instance.executionHistory.push(historyEntry);
        await instance.save();
    } catch (error) {
        console.error(`[TASK_SERVICE_HISTORY] Error adding task action to instance ${instanceId} history:`, error, eventData);
    }
};

const getTaskById = async (taskId, user) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        console.warn(`[TASK_SERVICE] Invalid Task ID format: ${taskId}`);
        return null; 
    }

    try {
        const task = await Task.findById(taskId)
            .populate('workflowInstanceId', 'status context._id workflowDefinitionId')
            .populate({
                path: 'workflowDefinitionId',
                select: 'name description version createdBy',
                populate: { path: 'createdBy', select: 'name email' }
            })
            .populate('assignedUserId', 'name email')
            .populate('actionedBy', 'name email')
            .populate('submittedFiles')
            .lean();

        if (!task) {
            return null;
        }

        let isAuthorized = false;
        if (user.role === 'admin') {
            isAuthorized = true;
        } else if (task.assignedToType === 'User' && task.assignedUserId && task.assignedUserId._id.toString() === user.id.toString()) {
            isAuthorized = true;
        } else if (task.assignedToType === 'Role' && task.assignedRoleName === user.role) {
            isAuthorized = true;
        } 


        if (!isAuthorized) {
            console.warn(`[TASK_SERVICE] User ${user.id} (Role: ${user.role}) not authorized to view task ${taskId}.`);
            return { unauthorized: true };
        }

        return task;
    } catch (error) {
        console.error(`[TASK_SERVICE] Error retrieving task by ID ${taskId}:`, error);
        throw new Error('Failed to retrieve task.');
    }
};

const findTasksByUserId = async (userId) => {
    try {
        const tasks = await Task.find({
                assignedToId: userId,
                assignedToType: 'User',
                status: { $in: ['Pending', 'In Progress'] }
            })
            .populate('workflowInstanceId', 'status context')
            .populate('workflowDefinitionId', 'name')
            .sort({ createdAt: -1 });

        return tasks;
    } catch (error) {
        console.error(`Error finding tasks for user ${userId}:`, error);
        throw new Error('Failed to retrieve tasks.');
    }
};

const completeTask = async (taskId, actioningUserId, completionData = {}) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        throw new Error('Invalid Task ID format.');
    }
    if (!actioningUserId) {
        throw new Error('Actioning User ID is required.');
    }

    const task = await Task.findById(taskId);
    if (!task) {
        throw new Error('Task not found.');
    }

    if (task.status !== 'Pending' && task.status !== 'In Progress' && task.status !== 'Needs Rework') {
        throw new Error(`Task is not in an actionable state. Current status: ${task.status}`);
    }

    const actioningUser = await User.findById(actioningUserId).lean();
    if (!actioningUser) {
        throw new Error('Actioning user not found (user from token does not exist).');
    }

    let isAuthorized = false;
    if (task.assignedToType === 'User') {
        if (task.assignedUserId && task.assignedUserId.toString() === actioningUserId.toString()) {
            isAuthorized = true;
        }
    } else if (task.assignedToType === 'Role') {
        if (task.assignedRoleName && actioningUser.role === task.assignedRoleName) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        console.log(`[TASK_SERVICE] Auth fail: User ${actioningUserId} (Role: ${actioningUser.role}) tried to complete task ${taskId} assigned to ${task.assignedToType}: ${task.assignedUserId || task.assignedRoleName}`);
        throw new Error('User is not authorized to complete this task.');
    }

    task.status = 'Completed';
    task.actionedBy = actioningUserId;
    task.actionedAt = new Date();
    if (completionData.comments) task.comments = completionData.comments;
    if (completionData.submittedFileIds && Array.isArray(completionData.submittedFileIds)) {
        task.submittedFiles = completionData.submittedFileIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => new mongoose.Types.ObjectId(id));
    }
    await task.save();
    console.log(`[TASK_SERVICE] Task ${taskId} completed by user ${actioningUserId}`);

    await addTaskActionToInstanceHistory(task.workflowInstanceId, {
        nodeId: task.nodeId,
        nodeLabel: task.title,
        nodeType: task.nodeType,
        eventType: 'TaskCompleted',
        message: `Task "${task.title}" completed by user ${actioningUser.name || actioningUserId}.`,
        details: {
            taskId: task._id.toString(),
            actioningUserId: actioningUserId.toString(),
            actioningUserName: actioningUser.name,
            completionComments: completionData.comments,
            submittedFileIds: task.submittedFiles ? task.submittedFiles.map(id => id.toString()) : []
        }
    });

    if (task.submittedFiles && task.submittedFiles.length > 0) {
    console.log(`[TASK_SERVICE] Marking ${task.submittedFiles.length} files as linked for task ${task._id}`);
    await File.updateMany(
        { _id: { $in: task.submittedFiles } },
        { $set: { isLinked: true, linkedContext: 'taskSubmission', taskIdContext: task._id } }
    );
}

    const instance = await WorkflowInstance.findById(task.workflowInstanceId);
    if (!instance) {
        console.error(`[TASK_SERVICE] Critical: WorkflowInstance ${task.workflowInstanceId} not found for completed task ${taskId}.`);
        throw new Error('Associated workflow instance not found.');
    }
    if (['Completed', 'Failed', 'Terminated'].includes(instance.status) && instance.status !== 'Suspended') {
         console.warn(`[TASK_SERVICE] Instance ${instance._id} is already in status ${instance.status}. Not resuming.`);
         return task;
    }

    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        console.error(`[TASK_SERVICE] Critical: WorkflowDefinition ${instance.workflowDefinitionId} not found for instance ${instance._id}.`);
        instance.status = 'Failed';
        instance.errorInfo = { message: 'Workflow definition missing during task completion.', nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error('Associated workflow definition not found.');
    }

    const completedNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === task.nodeId);
    if (!completedNodeDefinition) {
        console.error(`[TASK_SERVICE] Node definition ${task.nodeId} not found in workflow ${workflowDefinition.name}.`);
        instance.status = 'Failed';
        instance.errorInfo = { message: `Node definition ${task.nodeId} missing.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Node definition ${task.nodeId} for completed task not found.`);
    }

    const outgoingEdgesFromCompletedTask = workflowDefinition.flow.edges.filter(edge => edge.source === completedNodeDefinition.id);
    
    if (outgoingEdgesFromCompletedTask.length === 0 && completedNodeDefinition.data.type !== 'End') {
        console.warn(`[TASK_SERVICE] Completed Task Node ${completedNodeDefinition.id} has no outgoing edges. Checking if it's an implicit end.`);
    }

    instance.currentState.activeNodeIds = [];
    
    for (const edge of outgoingEdgesFromCompletedTask) {
        const nextNodeId = edge.target;
        const nextNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === nextNodeId);
        
        if (nextNodeDefinition && (nextNodeDefinition.data.type === 'ParallelJoin' || nextNodeDefinition.data.type === 'Join')) {
        const joinNodeId = nextNodeDefinition.id;
        
        if (!instance.joinStates) {
            instance.joinStates = new Map();
        }
        let joinState = instance.joinStates.get(joinNodeId);
        if (!joinState) {
            joinState = { arrivedEdgeIds: [] };
        }
        
        if (!joinState.arrivedEdgeIds.includes(edge.id)) {
            joinState.arrivedEdgeIds.push(edge.id);
            console.log(`[TASK_SERVICE] Edge ${edge.id} from completed task ${task.nodeId} recorded arrival at Join node ${joinNodeId}.`);
        }
        instance.joinStates.set(joinNodeId, joinState);
        instance.markModified('joinStates');
    }
        
        instance.currentState.activeNodeIds.push(nextNodeId);
    }
    
    instance.status = 'Running';
    
    if (completionData.outputs) {
        instance.context = { ...instance.context, ...completionData.outputs };
        instance.markModified('context');
    }
    
    await instance.save();
    console.log(`[TASK_SERVICE] Workflow instance ${instance._id} updated. New active nodes: [${instance.currentState.activeNodeIds.join(', ')}]. Triggering engine.`);

    triggerExecution(instance._id.toString()).catch(engineError => {
        console.error(`[TASK_SERVICE] Background engine trigger for ${instance._id} after task completion failed:`, engineError);
    });

    return task;
};

const rejectTask = async (taskId, actioningUserId, rejectionData = {}) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        throw new Error('Invalid Task ID format.');
    }
    if (!actioningUserId) {
        throw new Error('Actioning User ID is required.');
    }

    const task = await Task.findById(taskId);
    if (!task) {
        throw new Error('Task not found.');
    }

    if (task.status !== 'Pending' && task.status !== 'In Progress' && task.status !== 'Needs Rework') {
        throw new Error(`Task is not in an actionable state for rejection. Current status: ${task.status}`);
    }

    const actioningUser = await User.findById(actioningUserId).lean();
    if (!actioningUser) {
        throw new Error('Actioning user not found.');
    }

    let isAuthorized = false;
    if (task.assignedToType === 'User') {
        if (task.assignedUserId && task.assignedUserId.toString() === actioningUserId.toString()) {
            isAuthorized = true;
        }
    } else if (task.assignedToType === 'Role') {
        if (task.assignedRoleName && actioningUser.role === task.assignedRoleName) {
            isAuthorized = true;
        }
    }

    if (!isAuthorized) {
        throw new Error('User is not authorized to reject this task.');
    }

    task.status = 'Rejected';
    task.actionedBy = actioningUserId;
    task.actionedAt = new Date();
    if (rejectionData.comments) task.comments = rejectionData.comments;
    
    await task.save();
    console.log(`[TASK_SERVICE] Task ${taskId} REJECTED by user ${actioningUserId}`);

    await addTaskActionToInstanceHistory(task.workflowInstanceId, {
        nodeId: task.nodeId,
        nodeLabel: task.title,
        nodeType: task.nodeType,
        eventType: 'TaskRejected',
        message: `Task "${task.title}" rejected by user ${actioningUser.name || actioningUserId}. Reason: ${rejectionData.comments || 'No reason provided.'}`,
        details: {
            taskId: task._id.toString(),
            actioningUserId: actioningUserId.toString(),
            actioningUserName: actioningUser.name,
            rejectionComments: rejectionData.comments
        }
    });

    const instance = await WorkflowInstance.findById(task.workflowInstanceId);
    if (!instance) {
        console.error(`[TASK_SERVICE] Critical: WorkflowInstance ${task.workflowInstanceId} not found for rejected task ${taskId}.`);
        throw new Error('Associated workflow instance not found.');
    }
    if (['Completed', 'Failed', 'Terminated'].includes(instance.status) && instance.status !== 'Suspended') {
         console.warn(`[TASK_SERVICE] Instance ${instance._id} is already in status ${instance.status}. Not resuming for rejection.`);
         return task;
    }

    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        console.error(`[TASK_SERVICE] Critical: WorkflowDefinition ${instance.workflowDefinitionId} not found for instance ${instance._id}.`);
        instance.status = 'Failed';
        instance.errorInfo = { message: 'Workflow definition missing during task rejection.', nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error('Associated workflow definition not found.');
    }

    const rejectedNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === task.nodeId);
    if (!rejectedNodeDefinition) {
        console.error(`[TASK_SERVICE] Node definition ${task.nodeId} not found in workflow ${workflowDefinition.name}.`);
        instance.status = 'Failed';
        instance.errorInfo = { message: `Node definition ${task.nodeId} missing.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Node definition ${task.nodeId} for rejected task not found.`);
    }

    let outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === rejectedNodeDefinition.id);
    
    instance.currentState.activeNodeIds = [];
    
    for (const edge of outgoingEdges) {
        const nextNodeId = edge.target;
        const nextNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === nextNodeId);
        
        if (nextNodeDefinition && nextNodeDefinition.data.type === 'ParallelJoin') {
            const joinNodeId = nextNodeDefinition.id;
            
            if (!instance.joinStates) {
                instance.joinStates = new Map();
            }
            
            let joinState = instance.joinStates.get(joinNodeId);
            if (!joinState) {
                joinState = { arrivedEdgeIds: [] };
            }
            
            if (!joinState.arrivedEdgeIds.includes(edge.id)) {
                joinState.arrivedEdgeIds.push(edge.id);
                console.log(`[TASK_SERVICE] Edge ${edge.id} from rejected task ${task.nodeId} recorded arrival at ParallelJoin node ${joinNodeId}.`);
            }
            
            instance.joinStates.set(joinNodeId, joinState);
            instance.markModified('joinStates');
        }
        
        instance.currentState.activeNodeIds.push(nextNodeId);
    }

    instance.status = 'Running';
    if (rejectionData.outputs) {
        instance.context = { ...instance.context, ...rejectionData.outputs, taskOutcome: 'Rejected', rejectionComments: task.comments };
        instance.markModified('context');
    } else {
        instance.context = { ...instance.context, taskOutcome: 'Rejected', rejectionComments: task.comments };
        instance.markModified('context');
    }
    
    await instance.save();
    console.log(`[TASK_SERVICE] Workflow instance ${instance._id} updated after task rejection. New active nodes: ${instance.currentState.activeNodeIds.join(', ')}. Triggering engine.`);

    triggerExecution(instance._id.toString()).catch(engineError => {
        console.error(`[TASK_SERVICE] Background engine trigger for ${instance._id} after task rejection failed:`, engineError.message);
    });

    return task;
};

const approveTaskAction = async (taskId, actioningUserId, approvalData = {}) => {
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(actioningUserId)) {
        throw new Error('Invalid Task ID or Actioning User ID format.');
    }

    const task = await Task.findById(taskId);
    if (!task) throw new Error(`Approval task with ID ${taskId} not found.`);
    if (task.taskType !== 'ApprovalTask') {
        throw new Error(`Task ${taskId} is not an approval task. Use completeTask for generic tasks.`);
    }
    if (!['Pending', 'In Progress', 'Needs Rework', 'Escalated'].includes(task.status)) {
        throw new Error(`Approval task ${taskId} is not actionable. Status: ${task.status}`);
    }

    const actioningUserDoc = await User.findById(actioningUserId).lean();
    if (!actioningUserDoc) throw new Error(`Actioning user ID ${actioningUserId} not found.`);


    task.status = 'Completed';
    task.approvalDecision = 'Approved';
    task.actionedBy = actioningUserId;
    task.actionedAt = new Date();
    task.comments = (task.comments ? task.comments + "\n---\n" : "") + `Approved by ${actioningUserDoc.username}: ${approvalData.comments || '(No comments)'}`;
    await task.save();
    console.log(`[TASK_SERVICE] Approval Task ${taskId} APPROVED by user ${actioningUserId}`);

    await addTaskActionToInstanceHistory(task.workflowInstanceId, {
        nodeId: task.nodeId,
        nodeLabel: task.title,
        nodeType: task.nodeType,
        eventType: 'TaskApproved',
        message: `Approval task "${task.title}" approved by user ${actioningUserDoc.name || actioningUserId}. Comments: ${approvalData.comments || 'N/A'}`,
        details: {
            taskId: task._id.toString(),
            actioningUserId: actioningUserId.toString(),
            actioningUserName: actioningUserDoc.name,
            approvalComments: approvalData.comments
        }
    });

    const instance = await WorkflowInstance.findById(task.workflowInstanceId);
    if (!instance) {
        console.error(`[TASK_SERVICE] CRITICAL: Workflow instance ${task.workflowInstanceId} not found for approved task ${taskId}.`);
        throw new Error('Associated workflow instance not found.');
    }

    if (['Completed', 'Failed', 'Terminated'].includes(instance.status) && instance.status !== 'Suspended') {
        console.warn(`[TASK_SERVICE] Instance ${instance._id} is already in status ${instance.status}. Not resuming for approval of task ${taskId}.`);
        return task;
    }

    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        instance.status = 'Failed';
        instance.errorInfo = { message: `Workflow definition ${instance.workflowDefinitionId} not found.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Workflow definition ${instance.workflowDefinitionId} not found for instance ${instance._id}.`);
    }

    const approvalNodeDef = workflowDefinition.flow.nodes.find(n => n.id === task.nodeId);
    if (!approvalNodeDef) {
        instance.status = 'Failed';
        instance.errorInfo = { message: `Approval node definition (ID: ${task.nodeId}) not found in workflow.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Approval node definition (ID: ${task.nodeId}) not found in workflow ${workflowDefinition.name}.`);
    }

    instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== task.nodeId);

    const approvedEdge = workflowDefinition.flow.edges.find(
        edge => edge.source === approvalNodeDef.id && (edge.sourceHandle === 'approved' || edge.data?.conditionType === 'approved')
    );

    if (approvedEdge) {
        const nextNodeId = approvedEdge.target;
        const nextNodeDef = workflowDefinition.flow.nodes.find(n => n.id === nextNodeId);
        if (nextNodeDef && nextNodeDef.data.type === 'ParallelJoin') {
            if (!instance.joinStates) instance.joinStates = new Map();
            let joinState = instance.joinStates.get(nextNodeId) || { arrivedEdgeIds: [] };
            if (!joinState.arrivedEdgeIds.includes(approvedEdge.id)) {
                joinState.arrivedEdgeIds.push(approvedEdge.id);
            }
            instance.joinStates.set(nextNodeId, joinState);
            instance.markModified('joinStates');
        }
        if (!instance.currentState.activeNodeIds.includes(nextNodeId)) {
            instance.currentState.activeNodeIds.push(nextNodeId);
        }
        console.log(`[TASK_SERVICE] Following 'approved' path from ${task.nodeId} to ${nextNodeId} for instance ${instance._id}.`);
    } else {
        console.warn(`[TASK_SERVICE] No 'approved' edge found for Approval Node ${approvalNodeDef.id}. Path may end here.`);
    }

    instance.status = 'Running';
    instance.context = {
        ...instance.context,
        [`${task.nodeId}_decision`]: 'Approved',
        [`${task.nodeId}_approver`]: actioningUserDoc.username,
        [`${task.nodeId}_approvalComments`]: approvalData.comments || '',
        [`${task.nodeId}_approvalTimestamp`]: task.actionedAt,
    };
    instance.markModified('context');
    instance.markModified('currentState.activeNodeIds');

    await instance.save();
    console.log(`[TASK_SERVICE] Workflow instance ${instance._id} updated after approval. New active: [${instance.currentState.activeNodeIds.join(', ')}]. Triggering engine.`);
    triggerExecution(instance._id.toString()).catch(err => console.error(`[TASK_SERVICE] BG engine trigger failed (approveTask ${taskId}):`, err.message));
    return task;
};

const denyTaskAction = async (taskId, actioningUserId, denialData = {}) => {
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(actioningUserId)) {
        throw new Error('Invalid Task ID or Actioning User ID format.');
    }

    const task = await Task.findById(taskId);
    if (!task) throw new Error(`Approval task with ID ${taskId} not found.`);
    if (task.taskType !== 'ApprovalTask') {
        throw new Error(`Task ${taskId} is not an approval task.`);
    }
    if (!['Pending', 'In Progress', 'Needs Rework', 'Escalated'].includes(task.status)) {
        throw new Error(`Approval task ${taskId} is not actionable. Status: ${task.status}`);
    }

    const actioningUserDoc = await User.findById(actioningUserId).lean();
    if (!actioningUserDoc) throw new Error(`Actioning user ID ${actioningUserId} not found.`);


    task.status = 'Rejected';
    task.approvalDecision = 'Rejected';
    task.actionedBy = actioningUserId;
    task.actionedAt = new Date();
    task.comments = (task.comments ? task.comments + "\n---\n" : "") + `Rejected by ${actioningUserDoc.username}: ${denialData.comments || '(No comments)'}`;
    await task.save();
    console.log(`[TASK_SERVICE] Approval Task ${taskId} REJECTED by user ${actioningUserId}`);

    await addTaskActionToInstanceHistory(task.workflowInstanceId, {
        nodeId: task.nodeId,
        nodeLabel: task.title,
        nodeType: task.nodeType,
        eventType: 'TaskDenied',
        message: `Approval task "${task.title}" denied by user ${actioningUserDoc.name || actioningUserId}. Reason: ${denialData.comments || 'N/A'}`,
        details: {
            taskId: task._id.toString(),
            actioningUserId: actioningUserId.toString(),
            actioningUserName: actioningUserDoc.name,
            denialComments: denialData.comments
        }
    });

    const instance = await WorkflowInstance.findById(task.workflowInstanceId);
    if (!instance) {
        console.error(`[TASK_SERVICE] CRITICAL: Workflow instance ${task.workflowInstanceId} not found for rejected task ${taskId}.`);
        throw new Error('Associated workflow instance not found.');
    }

    if (['Completed', 'Failed', 'Terminated'].includes(instance.status) && instance.status !== 'Suspended') {
        console.warn(`[TASK_SERVICE] Instance ${instance._id} is already in status ${instance.status}. Not resuming for rejection of task ${taskId}.`);
        return task;
    }

    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        instance.status = 'Failed';
        instance.errorInfo = { message: `Workflow definition ${instance.workflowDefinitionId} not found.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Workflow definition ${instance.workflowDefinitionId} not found for instance ${instance._id}.`);
    }

    const approvalNodeDef = workflowDefinition.flow.nodes.find(n => n.id === task.nodeId);
    if (!approvalNodeDef) {
        instance.status = 'Failed';
        instance.errorInfo = { message: `Approval node definition (ID: ${task.nodeId}) not found in workflow.`, nodeId: task.nodeId, timestamp: new Date() };
        await instance.save();
        throw new Error(`Approval node definition (ID: ${task.nodeId}) not found in workflow ${workflowDefinition.name}.`);
    }
    
    const nodeConfig = approvalNodeDef.data.config || {};
    const rejectionBehavior = nodeConfig.rejectionBehavior || 'followRejectedPath';
    console.log(`[TASK_SERVICE] Rejection behavior for node ${task.nodeId}: ${rejectionBehavior}`);

    instance.currentState.activeNodeIds = instance.currentState.activeNodeIds.filter(id => id !== task.nodeId);
    let triggerEngine = false;

    if (rejectionBehavior === 'failWorkflow') {
        instance.status = 'Failed';
        instance.errorInfo = {
            message: `Approval for node ${task.nodeId} was rejected. Workflow failed as per 'failWorkflow' configuration.`,
            nodeId: task.nodeId,
            rejectionComments: denialData.comments || 'No comments.',
            rejectedBy: actioningUserDoc.username,
            timestamp: new Date(),
        };
        instance.markModified('errorInfo');
        console.log(`[TASK_SERVICE] Instance ${instance._id} FAILED due to rejection at node ${task.nodeId}.`);
    } else {
        const rejectedEdge = workflowDefinition.flow.edges.find(
            edge => edge.source === approvalNodeDef.id && (edge.sourceHandle === 'rejected' || edge.data?.conditionType === 'rejected')
        );

        if (rejectedEdge) {
            const nextNodeId = rejectedEdge.target;
            const nextNodeDef = workflowDefinition.flow.nodes.find(n => n.id === nextNodeId);
            if (nextNodeDef && nextNodeDef.data.type === 'ParallelJoin') {
                if (!instance.joinStates) instance.joinStates = new Map();
                let joinState = instance.joinStates.get(nextNodeId) || { arrivedEdgeIds: [] };
                if (!joinState.arrivedEdgeIds.includes(rejectedEdge.id)) {
                   joinState.arrivedEdgeIds.push(rejectedEdge.id);
                }
                instance.joinStates.set(nextNodeId, joinState);
                instance.markModified('joinStates');
            }
            if (!instance.currentState.activeNodeIds.includes(nextNodeId)) {
                instance.currentState.activeNodeIds.push(nextNodeId);
            }
            instance.status = 'Running';
            triggerEngine = true;
            console.log(`[TASK_SERVICE] Following 'rejected' visual path from ${task.nodeId} to ${nextNodeId} for instance ${instance._id}.`);
        } else {
            if (rejectionBehavior === 'endPathIfNoConnection') {
                console.log(`[TASK_SERVICE] Approval node ${task.nodeId} rejected. Behavior 'endPathIfNoConnection', no 'rejected' edge. This path ends.`);
                instance.status = 'Running';
                triggerEngine = true;
            } else { 
                instance.status = 'Failed';
                instance.errorInfo = {
                    message: `Approval node ${task.nodeId} rejected. Configured to 'followRejectedPath' but no 'rejected' edge found. Design flaw.`,
                    nodeId: task.nodeId,
                    rejectionComments: denialData.comments || 'No comments.',
                    rejectedBy: actioningUserDoc.username,
                    timestamp: new Date(),
                };
                instance.markModified('errorInfo');
                console.warn(`[TASK_SERVICE] Instance ${instance._id} FAILED. Approval node ${task.nodeId} rejected. 'followRejectedPath' but no 'rejected' edge.`);
            }
        }
    }

    instance.context = {
        ...instance.context,
        [`${task.nodeId}_decision`]: 'Rejected',
        [`${task.nodeId}_rejectedBy`]: actioningUserDoc.username,
        [`${task.nodeId}_rejectionComments`]: denialData.comments || '',
        [`${task.nodeId}_rejectionTimestamp`]: task.actionedAt,
    };
    instance.markModified('context');
    instance.markModified('currentState.activeNodeIds');

    await instance.save();
    console.log(`[TASK_SERVICE] Workflow instance ${instance._id} updated after task rejection. Status: ${instance.status}. New active: [${instance.currentState.activeNodeIds.join(', ')}].`);

    if (triggerEngine && instance.status === 'Running') {
        triggerExecution(instance._id.toString()).catch(err => console.error(`[TASK_SERVICE] BG engine trigger failed (denyTask ${taskId}):`, err.message));
    } else {
         console.log(`[TASK_SERVICE] Engine execution not triggered for instance ${instance._id} (status: ${instance.status}).`);
    }
    return task;
};

const listTasks = async (filters = {}, user, options = {}) => {
    try {
        const query = {};

        if (filters.workflowInstanceId && mongoose.Types.ObjectId.isValid(filters.workflowInstanceId)) {
            query.workflowInstanceId = filters.workflowInstanceId;
            
            const instance = await mongoose.model('WorkflowInstance').findById(filters.workflowInstanceId).lean();
            if (!instance) {
                console.warn(`[TASK_SERVICE] Workflow instance ${filters.workflowInstanceId} not found.`);
                return { tasks: [], currentPage: 1, totalPages: 0, totalTasks: 0 };
            }
            
            let hasInstanceAccess = user.role === 'admin' || 
                                  instance.startedBy.toString() === user.id.toString() ||
                                  user.role === 'manager';
            
            if (!hasInstanceAccess && user.role === 'staff') {
                const staffTasksInInstance = await Task.countDocuments({
                    workflowInstanceId: filters.workflowInstanceId,
                    $or: [
                        { assignedToType: 'User', assignedUserId: user.id },
                        { assignedToType: 'Role', assignedRoleName: user.role }
                    ]
                });
                
                if (staffTasksInInstance > 0) {
                    hasInstanceAccess = true;
                    console.log(`[TASK_SERVICE] Staff user ${user.id} has ${staffTasksInInstance} tasks in instance ${filters.workflowInstanceId}, granting access.`);
                }
            }
            
            if (!hasInstanceAccess) {
                console.warn(`[TASK_SERVICE] User ${user.id} (role: ${user.role}) not authorized to view tasks for instance ${filters.workflowInstanceId}.`);
                return { tasks: [], currentPage: 1, totalPages: 0, totalTasks: 0 };
            }
            
            console.log(`[TASK_SERVICE] User ${user.id} has access to instance ${filters.workflowInstanceId}, showing all tasks for this instance.`);
        } else {
            if (user.role === 'staff') {
                query.$or = [
                    { assignedToType: 'User', assignedUserId: user.id },
                    { assignedToType: 'Role', assignedRoleName: user.role }
                ];
                if (!filters.status) {
                     query.status = { $in: ['Pending', 'In Progress', 'Needs Rework'] };
                }
            } else if (user.role === 'manager') {
                query.$or = [
                    { assignedToType: 'User', assignedUserId: user.id },
                    { assignedToType: 'Role', assignedRoleName: user.role },
                    { assignedToType: 'Role', assignedRoleName: 'staff' }
                ];
            } else if (user.role === 'admin') {
            } else {
                return { tasks: [], currentPage: 1, totalPages: 0, totalTasks: 0 }; 
            }
        }

        if (filters.status) {
            const statuses = filters.status.split(',').map(s => s.trim());
            query.status = { $in: statuses };
        }
        if (filters.assignedUserId && mongoose.Types.ObjectId.isValid(filters.assignedUserId)) {
            if (user.role === 'admin' || user.role === 'manager') {
                query.assignedToType = 'User';
                query.assignedUserId = filters.assignedUserId;
                if(query.$or) delete query.$or;
            } else if (user.role === 'staff' && user.id === filters.assignedUserId) {
                query.assignedToType = 'User';
                query.assignedUserId = user.id;
            } else {
                 console.warn(`[TASK_SERVICE] Staff user ${user.id} attempted to filter tasks for other user ${filters.assignedUserId}. Denying.`);
                 return [];
            }
        }
        if (filters.assignedRoleName) {
             if (user.role === 'admin' || user.role === 'manager') {
                query.assignedToType = 'Role';
                query.assignedRoleName = filters.assignedRoleName;
                if(query.$or) delete query.$or;
            } else if (user.role === 'staff' && user.role === filters.assignedRoleName) {
                query.assignedToType = 'Role';
                query.assignedRoleName = user.role;
            } else {
                 console.warn(`[TASK_SERVICE] Staff user ${user.id} attempted to filter tasks for other role ${filters.assignedRoleName}. Denying.`);
                return [];
            }
        }
        if (filters.workflowDefinitionId && mongoose.Types.ObjectId.isValid(filters.workflowDefinitionId)) {
            query.workflowDefinitionId = filters.workflowDefinitionId;
        }
        
        if (filters.priority) {
            const priorities = filters.priority.split(',').map(p => p.trim());
            query.priority = { $in: priorities };
        }

        if (filters.dueDateAfter) {
            query.dueDate = { ...query.dueDate, $gte: new Date(filters.dueDateAfter) };
        }
        if (filters.dueDateBefore) {
            query.dueDate = { ...query.dueDate, $lte: new Date(filters.dueDateBefore) };
        }
        
        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const skip = (page - 1) * limit;

        let sort = {};
        if (options.sortBy) {
            sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.dueDate = 1;
            sort.priority = -1;
            sort.createdAt = -1;
        }
                console.log('[TASK_SERVICE_DEBUG] Attempting direct fetch for specific task...');
        console.log('[TASK_SERVICE] Listing tasks with query:', JSON.stringify(query));
        const tasks = await Task.find(query)
.select([
    '_id', 'taskData', 'title', 'description', 'priority', 'status', 'dueDate', 'createdAt', 'updatedAt',
    'taskType', 'nodeType', 'nodeSpecificData', 'approvalDecision',
    'submittedFiles',
    'assignedToType', 'assignedRoleName'
])
            .populate('workflowInstanceId', 'status context._id startedBy')
            .populate({ 
                path: 'workflowDefinitionId', 
                select: 'name description version' 
            })
            .populate('assignedUserId', 'username name email _id')
            .populate('actionedBy', 'username name email _id')
            .populate({
                path: 'submittedFiles',
                select: 'filename originalname mimetype _id'
            })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
            
        console.log('[TASK_SERVICE] Test 5 - Refined Select + All Populates:', JSON.stringify(tasks, null, 2));
            
        const totalTasks = await Task.countDocuments(query);

        return {
            tasks,
            currentPage: page,
            totalPages: Math.ceil(totalTasks / limit),
            totalTasks
        };
    } catch (error) {
        console.error(`[TASK_SERVICE] Error listing tasks for user ${user.id} with filters ${JSON.stringify(filters)}:`, error);
        throw new Error('Failed to retrieve tasks.');
    }
};

const claimTask = async (taskId, claimingUserId) => {
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(claimingUserId)) {
        throw new Error('Invalid Task ID or User ID format.');
    }

    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found.');

    const claimingUser = await User.findById(claimingUserId).lean();
    if (!claimingUser) throw new Error('Claiming user not found.');

    if (task.assignedToType === 'User' && task.assignedUserId) {
        if (task.assignedUserId.toString() === claimingUserId.toString()) {
            if (task.status === 'Pending') {
                task.status = 'In Progress';
                await task.save();
                console.log(`[TASK_SERVICE] Task ${taskId} already assigned to user ${claimingUserId}, status updated to In Progress.`);
                return task.populate('assignedUserId', 'name email');
            }
            throw new Error('Task is already assigned to you.');
        }
        throw new Error('Task is already claimed by another user.');
    }

    if (task.assignedToType !== 'Role') {
        throw new Error('Task is not assigned to a role and cannot be claimed in this manner.');
    }

    if (task.assignedRoleName !== claimingUser.role) {
        throw new Error(`User's role '${claimingUser.role}' does not match task's assigned role '${task.assignedRoleName}'. Cannot claim.`);
    }

    if (task.status !== 'Pending') {
        throw new Error(`Task cannot be claimed. Current status: ${task.status}. Expected 'Pending'.`);
    }

    task.assignedToType = 'User';
    task.assignedUserId = claimingUserId;
    task.status = 'In Progress';

    await task.save();
    console.log(`[TASK_SERVICE] Task ${taskId} claimed by user ${claimingUserId}. Original role: ${task.assignedRoleName}, New status: ${task.status}.`);
    return task.populate('assignedUserId', 'name email');
};


const unclaimTask = async (taskId, actioningUserId, actioningUserRole) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        throw new Error('Invalid Task ID format.');
    }

    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found.');
    const originalRoleForQueue = task.assignedRoleName; 
    if (task.assignedToType === 'User' && !originalRoleForQueue) {
        throw new Error('Cannot unclaim: Task does not have an original role assignment to return to.');
    }

    const canUnclaim = 
        task.assignedUserId.toString() === actioningUserId.toString() ||
        actioningUserRole === 'manager' ||
        actioningUserRole === 'admin';

    if (!canUnclaim) {
        throw new Error('User is not authorized to unclaim this task.');
    }
    
    if (!task.assignedRoleName) {
        throw new Error('Cannot unclaim: Original role assignment information (assignedRoleName) is missing from the task.');
    }

    const originalRole = task.assignedRoleName;
    task.assignedToType = 'Role';
    task.assignedUserId = undefined;
    task.assignedRoleName = originalRole;
    task.status = 'Pending';

    if (task.actionedBy && task.actionedBy.toString() === actioningUserId.toString()) {
        task.actionedBy = undefined;
        task.actionedAt = undefined;
    }
    
    await task.save();
    console.log(`[TASK_SERVICE] Task ${taskId} unclaimed by user ${actioningUserId}. Now assigned to role: ${task.assignedRoleName}, Status: ${task.status}.`);
    return task.populate('assignedUserId', 'name email');
};

const reassignTask = async (taskId, reassignmentDetails, actioningUserId) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        throw new Error('Invalid Task ID format.');
    }
    if (!actioningUserId) {
        throw new Error('Actioning User ID is required for reassignment.');
    }

    const { newAssignedToType, newAssignedToId, reassignComment } = reassignmentDetails;

    if (!newAssignedToType || !newAssignedToId) {
        throw new Error('New assignment type and ID/name are required.');
    }
    if (!['User', 'Role'].includes(newAssignedToType)) {
        throw new Error("Invalid newAssignedToType. Must be 'User' or 'Role'.");
    }

    const task = await Task.findById(taskId);
    if (!task) throw new Error('Task not found.');

    if (['Completed', 'Cancelled', 'Rejected'].includes(task.status)) {
        throw new Error(`Task cannot be reassigned. Current status: ${task.status}.`);
    }

    const actioningUser = await User.findById(actioningUserId).lean();
    if (!actioningUser || (actioningUser.role !== 'manager' && actioningUser.role !== 'admin')) {
        throw new Error('User not authorized to reassign tasks. Requires Manager or Admin role.');
    }

    if (newAssignedToType === 'User') {
        if (!mongoose.Types.ObjectId.isValid(newAssignedToId)) {
            throw new Error('Invalid newAssignedToId format for User assignment.');
        }
        const userExists = await User.findById(newAssignedToId).lean();
        if (!userExists || !userExists.isActive) {
            throw new Error(`New assigned user ${newAssignedToId} not found or inactive.`);
        }
        task.assignedUserId = newAssignedToId;
        task.assignedRoleName = undefined;
    } else {
        if (!USER_ROLES.includes(newAssignedToId)) {
            throw new Error(`Invalid newAssignedRoleName '${newAssignedToId}'. Must be one of: ${USER_ROLES.join(', ')}`);
        }
        task.assignedRoleName = newAssignedToId;
        task.assignedUserId = undefined;
    }

    const oldAssigneeType = task.assignedToType;
    const oldAssigneeId = task.assignedToType === 'User' ? task.assignedUserId?.toString() : task.assignedRoleName;

    task.assignedToType = newAssignedToType;
    
    const comment = `Task reassigned by ${actioningUser.name || actioningUserId} from ${oldAssigneeType}: ${oldAssigneeId || 'N/A'} to ${newAssignedToType}: ${newAssignedToId}. Reason: ${reassignComment || 'No reason provided.'}`;
    if (task.comments) {
        task.comments += `\n---\n${comment}`;
    } else {
        task.comments = comment;
    }
    task.markModified('comments');

    if (task.status === 'In Progress') {
        task.status = 'Pending';
    }

    await task.save();
    console.log(`[TASK_SERVICE] Task ${taskId} reassigned to ${newAssignedToType}: ${newAssignedToId} by user ${actioningUserId}.`);
    
    return task.populate([
        { path: 'assignedUserId', select: 'name email' },
        { path: 'actionedBy', select: 'name email' },
        { path: 'workflowInstanceId', select: 'status' },
        { path: 'workflowDefinitionId', select: 'name' }
    ]);
};

const adminDeleteTask = async (taskId) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        const err = new Error('Invalid Task ID format.');
        err.status = 400;
        throw err;
    }

    try {
        const task = await Task.findById(taskId);
        if (!task) {
            const err = new Error('Task not found.');
            err.status = 404;
            throw err;
        }

        
        await Task.findByIdAndDelete(taskId);
        console.log(`[TASK_SERVICE] Admin deleted task ${taskId} (Node: ${task.nodeId}, Title: ${task.title})`);

        return { success: true, message: `Task '${task.title}' (ID: ${taskId}) deleted successfully.` };

    } catch (error) {
        console.error(`[TASK_SERVICE] Error deleting task ${taskId} for admin:`, error);
        if (!error.status) {
            throw new Error('Failed to delete task.');
        }
        throw error;
    }
};

const simpleTemplateRender = (templateString, context, returnUndefinedOnFail = false) => {
    if (typeof templateString !== 'string') {
        return templateString;
    }
    return templateString.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, path) => {
        if (!path) { 
            console.warn(`[TEMPLATE_RENDER] Empty path in template string: "${match}".`);
            return returnUndefinedOnFail ? undefined : match;
        }
        const keys = path.split('.');
        let value = context;
        try {
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    console.warn(`[TEMPLATE_RENDER] Path "${path}" (from template "${match}") not fully resolved in context.`);
                    return returnUndefinedOnFail ? undefined : match;
                }
            }
            if (value === null) return 'null';
            if (value === undefined && returnUndefinedOnFail) return undefined;
            if (value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value, null, 2);
            return String(value);
        } catch (e) {
            console.error(`[TEMPLATE_RENDER] Error resolving path "${path}" (from template "${match}"):`, e);
            return returnUndefinedOnFail ? undefined : match;
        }
    });
};

const generateDocumentFromTaskContext = async (taskId, templateString, requestingUser) => {
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
        const err = new Error('Invalid Task ID format.');
        err.status = 400;
        throw err;
    }
    if (typeof templateString !== 'string' || templateString.trim() === '') {
        const err = new Error('Template string is required and cannot be empty.');
        err.status = 400;
        throw err;
    }

    try {
        const task = await Task.findById(taskId)
            .populate('workflowInstanceId')
            .populate('assignedUserId', 'name username email')
            .lean();

        if (!task) {
            const err = new Error('Task not found.');
            err.status = 404;
            throw err;
        }
        if (!task.workflowInstanceId) {
            const err = new Error('Task is not associated with a workflow instance (missing context).');
            err.status = 400;
            throw err;
        }

        let authorized = false;
        if (requestingUser.role === 'admin' || requestingUser.role === 'manager') {
            authorized = true;
        } else if (task.assignedToType === 'User' && task.assignedUserId?._id.toString() === requestingUser.id.toString()) {
            authorized = true;
        } else if (task.assignedToType === 'Role' && task.assignedRoleName === requestingUser.role) {
            authorized = true;
        }

        if (!authorized) {
            const err = new Error('Forbidden: You are not authorized to generate a document for this task.');
            err.status = 403;
            throw err;
        }

        const templateContext = {
            ...(task.workflowInstanceId.context || {}),
            taskId: task._id.toString(),
            taskTitle: task.title,
            taskDescription: task.description,
            taskStatus: task.status,
            taskPriority: task.priority,
            taskAssignee: task.assignedUserId ? (task.assignedUserId.name || task.assignedUserId.username) : task.assignedRoleName,
        };
        
        const renderedDocument = simpleTemplateRender(templateString, templateContext);
        console.log(`[TASK_SERVICE] Document generated for task ${taskId} by user ${requestingUser.id}`);
        return renderedDocument;

    } catch (error) {
        console.error(`[TASK_SERVICE] Error generating document for task ${taskId}:`, error);
        if (!error.status) {
            throw new Error('Failed to generate document from task.');
        }
        throw error;
    }
};


module.exports = {
    getTaskById, 
    listTasks,
    completeTask,
    rejectTask,
    approveTaskAction,
    denyTaskAction,
    claimTask,
    unclaimTask,
    reassignTask,
    adminDeleteTask,
    generateDocumentFromTaskContext,
};
