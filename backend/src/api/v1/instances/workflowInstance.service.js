const mongoose = require('mongoose');
const { WorkflowInstance } = require('./workflowInstance.model.js');
const Workflow = require('../workflows/workflow.model.js');
const {User} = require('../users/user.model.js');
const { triggerExecution } = require('../../../engine/workflow.engine.js'); 
const Task = require('../tasks/task.model.js');
const IssueReport = require('../issues/issueReport.model.js');


const listInstances = async (queryParams, user) => {
    const {
        status,
        workflowDefinitionId,
        startedBy: startedByFilter,
        dateFrom,
        dateTo,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        staffTaskView = false
    } = queryParams;

    const query = {};

    if (user.role === 'staff') {
        if (staffTaskView === 'true' || staffTaskView === true) {
            const staffTasks = await Task.find({
                $or: [
                    { assignedToType: 'User', assignedUserId: user.id },
                    { assignedToType: 'Role', assignedRoleName: user.role }
                ]
            }).distinct('workflowInstanceId').lean();
            
            console.log(`[WF_INSTANCE_SERVICE] Found ${staffTasks.length} instances with tasks for staff user ${user.id}`);
            
            if (staffTasks.length === 0) {
                return {
                    instances: [],
                    currentPage: parseInt(page, 10),
                    totalPages: 0,
                    totalInstances: 0,
                };
            }
            
            query._id = { $in: staffTasks };
        } else {
            query.startedBy = user.id;
        }
    } else if (user.role === 'manager') {
        if (startedByFilter && mongoose.Types.ObjectId.isValid(startedByFilter)) {
            query.startedBy = startedByFilter;
        }
    } else if (user.role === 'admin') {
        if (startedByFilter && mongoose.Types.ObjectId.isValid(startedByFilter)) {
            query.startedBy = startedByFilter;
        }
    } else {
        query.startedBy = user.id;
    }


    if (status) {
        query.status = { $in: status.split(',').map(s => s.trim()) };
    }
    if (workflowDefinitionId && mongoose.Types.ObjectId.isValid(workflowDefinitionId)) {
        query.workflowDefinitionId = workflowDefinitionId;
    }

    if (dateFrom || dateTo) {
        query.startedAt = {};
        if (dateFrom) {
            try {
                query.startedAt.$gte = new Date(dateFrom);
            } catch (e) { console.warn("Invalid dateFrom format"); delete query.startedAt.$gte;}
        }
        if (dateTo) {
             try {
                query.startedAt.$lte = new Date(dateTo);
            } catch (e) { console.warn("Invalid dateTo format"); delete query.startedAt.$lte;}
        }
        if(Object.keys(query.startedAt).length === 0) delete query.startedAt;
    }
    
    const  options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
        populate: [
            { path: 'workflowDefinitionId', select: 'name version' },
            { path: 'startedBy', select: 'username name email' }
        ],
        lean: true
    };

    try {
        console.log(`[WF_INSTANCE_SERVICE] Listing instances for user ${user.id} (role: ${user.role}) with query:`, JSON.stringify(query), "Options:", {page: options.page, limit: options.limit, sort: options.sort});
        const result = await WorkflowInstance.paginate(query, options);

        if (user.role === 'staff' && (staffTaskView === 'true' || staffTaskView === true) && result.docs.length > 0) {
            const instanceIds = result.docs.map(instance => instance._id);
            const taskCounts = await Task.aggregate([
                {
                    $match: {
                        workflowInstanceId: { $in: instanceIds },
                        $or: [
                            { assignedToType: 'User', assignedUserId: new mongoose.Types.ObjectId(user.id) },
                            { assignedToType: 'Role', assignedRoleName: user.role }
                        ]
                    }
                },
                {
                    $group: {
                        _id: '$workflowInstanceId',
                        taskCount: { $sum: 1 }
                    }
                }
            ]);
            
            const taskCountMap = {};
            taskCounts.forEach(tc => {
                taskCountMap[tc._id.toString()] = tc.taskCount;
            });
            
            result.docs.forEach(instance => {
                instance.taskCount = taskCountMap[instance._id.toString()] || 0;
            });
        }



        return {
            instances: result.docs,
            currentPage: result.page,
            totalPages: result.totalPages,
            totalInstances: result.totalDocs,
        };
    } catch (error) {
        console.error(`[WF_INSTANCE_SERVICE] Error listing instances for user ${user.id}:`, error);
        throw new Error('Failed to retrieve workflow instances.');
    }
};


const createAndStartInstance = async (
    workflowDefinitionId, 
    userId, 
    initialContext = {},
    parentInstanceId = null,
    parentNodeIdInParent = null
) => {
    if (!mongoose.Types.ObjectId.isValid(workflowDefinitionId)) {
        throw new Error('Invalid Workflow Definition ID format.');
    }
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid User ID format.');
    }

    const workflowDefinition = await Workflow.findById(workflowDefinitionId).lean();
    if (!workflowDefinition) {
        throw new Error('Workflow Definition not found.');
    }

    if (userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('Initiating user not found.');
        }
    }
    
    const startNode = workflowDefinition.flow.nodes.find(node => node.data?.type === 'Start');
    if (!startNode) {
        throw new Error("Workflow definition does not have a 'Start' node.");
    }

    const newInstanceData = {
        workflowDefinitionId: workflowDefinition._id,
        status: 'Not Started',
        startedBy: userId || undefined,
        startedAt: Date.now(),
        context: initialContext || {},
        currentState: {
            activeNodeIds: [startNode.id],
        },
        parentInstanceId: parentInstanceId || undefined,
        parentNodeIdInParent: parentNodeIdInParent || undefined,
        pendingSubWorkflows: [],
    };

    try {
        const newInstance = await WorkflowInstance.create(newInstanceData);
        console.log(`[WF_INSTANCE_SERVICE] Created new instance ${newInstance._id} for definition ${workflowDefinitionId}. First active node: ${startNode.id}`);
        
        try {
            await triggerExecution(newInstance._id.toString());
        } catch (engineError) {
            console.error(`[WF_INSTANCE_SERVICE] Engine execution for ${newInstance._id} failed directly:`, engineError.message);
            try {
                const instanceToFail = await WorkflowInstance.findById(newInstance._id);
                if (instanceToFail && instanceToFail.status !== 'Completed' && instanceToFail.status !== 'Failed') {
                    instanceToFail.status = 'Failed';
                    instanceToFail.errorInfo = {
                        message: `Engine execution failed: ${engineError.message}`,
                        details: engineError.stack,
                        timestamp: new Date()
                    };
                    await instanceToFail.save();
                    console.log(`[WF_INSTANCE_SERVICE] Instance ${newInstance._id} marked as Failed due to engine error.`);
                }
            } catch (failUpdateError) {
                console.error(`[WF_INSTANCE_SERVICE] CRITICAL: Failed to update instance ${newInstance._id} to Failed status after engine error:`, failUpdateError.message);
            }
            throw engineError; 
        }

        const finalInstance = await WorkflowInstance.findById(newInstance._id).lean();
        return finalInstance || newInstance;

    } catch (error) {
        console.error('Error creating workflow instance in service:', error);
        throw error;
    }
};

const submitFileForNode = async (instanceId, nodeId, fileId, actioningUserId) => {
    if (!mongoose.Types.ObjectId.isValid(instanceId) || 
        !mongoose.Types.ObjectId.isValid(fileId) ||
        !nodeId ) {
        throw new Error('Invalid instance, node, or file ID format provided.');
    }

    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance) {
        throw new Error('Workflow instance not found.');
    }
    if (instance.status !== 'AwaitingFileUpload') {
        throw new Error(`Instance is not awaiting a file upload. Current status: ${instance.status}`);
    }
    if (!instance.pendingActionDetails || instance.pendingActionDetails.nodeId !== nodeId) {
        throw new Error('Instance is not awaiting a file for the specified node, or pending details are missing.');
    }


    const workflowDefinition = await Workflow.findById(instance.workflowDefinitionId).lean();
    if (!workflowDefinition) {
        throw new Error('Associated workflow definition not found.');
    }
    const fileUploadNodeDefinition = workflowDefinition.flow.nodes.find(n => n.id === nodeId);
    if (!fileUploadNodeDefinition || fileUploadNodeDefinition.data.type !== 'FileUpload') {
        throw new Error(`FileUploadNode with ID ${nodeId} not found in definition or is not of type FileUpload.`);
    }

    const contextPath = instance.pendingActionDetails.configSnapshot?.contextPathForFileId;
    if (!contextPath) {
        console.warn(`[WF_INSTANCE_SERVICE] No 'contextPathForFileId' configured for FileUploadNode ${nodeId} in instance ${instanceId}. File ID will not be saved to context.`);
    } else {
        const setNestedValue = (obj, path, value) => {
            const keys = path.split('.');
            let current = obj;
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = current[keys[i]] || {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
        };
        setNestedValue(instance.context, contextPath, fileId);
        instance.markModified('context');
        console.log(`[WF_INSTANCE_SERVICE] File ID ${fileId} stored in instance ${instanceId} context at ${contextPath}.`);
    }

    instance.pendingActionDetails = undefined; 
    instance.markModified('pendingActionDetails');
    instance.status = 'Running';

    const outgoingEdges = workflowDefinition.flow.edges.filter(edge => edge.source === fileUploadNodeDefinition.id);
    if (outgoingEdges.length > 0) {
        instance.currentState.activeNodeIds = outgoingEdges.map(edge => edge.target);
    } else {
        instance.currentState.activeNodeIds = [];
        console.log(`[WF_INSTANCE_SERVICE] FileUploadNode ${nodeId} has no outgoing edges.`);
    }
    
    await instance.save();
    console.log(`[WF_INSTANCE_SERVICE] Instance ${instanceId} resumed. New active nodes: ${instance.currentState.activeNodeIds.join(', ')}. Triggering engine.`);

    triggerExecution(instance._id.toString()).catch(engineError => {
        console.error(`[WF_INSTANCE_SERVICE] Background engine trigger for ${instance._id} after file submission failed:`, engineError.message);
    });

    return instance;
};


const adminListAllInstances = async (filters = {}, options = {}) => {
    try {
        const query = { ...filters };

        if (filters.workflowDefinitionId && mongoose.Types.ObjectId.isValid(filters.workflowDefinitionId)) {
            query.workflowDefinitionId = filters.workflowDefinitionId;
        } else if (filters.workflowDefinitionId) {
            delete query.workflowDefinitionId;
        }
        if (filters.startedBy && mongoose.Types.ObjectId.isValid(filters.startedBy)) {
            query.startedBy = filters.startedBy;
        } else if (filters.startedBy) {
            delete query.startedBy;
        }
        
        if (filters.status) {
            const statuses = filters.status.split(',').map(s => s.trim());
            query.status = { $in: statuses };
        }


        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 25;
        const skip = (page - 1) * limit;
        let sort = options.sortBy ? { [options.sortBy]: options.sortOrder === 'desc' ? -1 : 1 } : { createdAt: -1 };

        console.log('[WF_INSTANCE_SERVICE] Admin listing instances with query:', JSON.stringify(query));
        const instances = await WorkflowInstance.find(query)
            .populate({
                path: 'workflowDefinitionId',
                select: 'name version description',
            })
            .populate('startedBy', 'name email role')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalInstances = await WorkflowInstance.countDocuments(query);

        console.log(`[WF_INSTANCE_SERVICE] Admin query found ${totalInstances} total instances.`);
        console.log(`[WF_INSTANCE_SERVICE] Admin query returned ${instances.length} instances for the current page.`);
        if (instances.length > 0) {
            console.log("[WF_INSTANCE_SERVICE] First instance in current page results:", JSON.stringify(instances[0]._id));
        }

        return {
            instances,
            currentPage: page,
            totalPages: Math.ceil(totalInstances / limit),
            totalInstances,
        };
    } catch (error) {
        console.error(`[WF_INSTANCE_SERVICE] Error listing all instances for admin:`, error);
        throw new Error('Failed to retrieve workflow instances.');
    }
};


const adminGetInstanceDetails = async (instanceId) => {
    if (!mongoose.Types.ObjectId.isValid(instanceId)) {
        return null;
    }
    try {
        const instance = await WorkflowInstance.findById(instanceId)
            .populate({
                path: 'workflowDefinitionId',
                select: 'name version description flow.nodes flow.edges createdBy',
                populate: { path: 'createdBy', select: 'name email' }
            })
            .populate('startedBy', 'name email role')
            .populate({
                path: 'pendingSubWorkflows.subInstanceId',
                model: 'WorkflowInstance',
                select: 'status workflowDefinitionId',
                populate: { path: 'workflowDefinitionId', select: 'name' }
            })
            .populate('terminationInfo.terminatedBy', 'name email')
            .lean(); 

        if (!instance) {
            return null;
        }

        const tasks = await Task.find({ workflowInstanceId: instance._id })
            .populate('assignedUserId', 'name username email')
            .populate('actionedBy', 'name username email')
            .populate('submittedFiles', 'filename originalname mimetype size createdAt')
            .sort({ createdAt: 'asc' })
            .lean();

        const taskIdsForInstance = tasks.map(task => task._id);
        let issues = [];
        if (taskIdsForInstance.length > 0) {
            issues = await IssueReport.find({ taskId: { $in: taskIdsForInstance } })
                .populate('reportedBy', 'name username email')
                .populate('resolvedBy', 'name username email')
                .populate('taskId', 'title nodeId')
                .sort({ createdAt: 'asc' })
                .lean();
        }
        
        instance.associatedTasks = tasks;
        instance.associatedIssueReports = issues;
        

        return instance;
    } catch (error) {
        console.error(`[WF_INSTANCE_SERVICE] Error retrieving instance details for admin (ID: ${instanceId}):`, error);
        throw new Error('Failed to retrieve workflow instance details.');
    }
};

const adminTerminateInstance = async (instanceId, adminUserId, reason = "Terminated by administrator.") => {
    if (!mongoose.Types.ObjectId.isValid(instanceId)) {
        throw new Error('Invalid Workflow Instance ID format.');
    }
    if (!mongoose.Types.ObjectId.isValid(adminUserId)) {
        throw new Error('Invalid Admin User ID format.');
    }


    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance) {
        throw new Error('Workflow instance not found.');
    }

    if (['Completed', 'Failed', 'Terminated'].includes(instance.status)) {
        throw new Error(`Workflow instance is already in a terminal state: ${instance.status}. Cannot terminate.`);
    }

    const oldStatus = instance.status;
    instance.status = 'Terminated';
    instance.completedAt = new Date();
    instance.currentState.activeNodeIds = [];

    instance.terminationInfo = {
        reason: reason,
        terminatedBy: adminUserId,
        terminatedAt: new Date(),
        previousStatus: oldStatus
    };

    instance.pendingActionDetails = undefined;
    instance.markModified('pendingActionDetails');


    await instance.save();
    console.log(`[WF_INSTANCE_SERVICE] Admin ${adminUserId} terminated instance ${instanceId}. Reason: ${reason}`);

    const Task = require('../tasks/task.model.js');
    await Task.updateMany(
        { workflowInstanceId: instance._id, status: { $in: ['Pending', 'In Progress', 'Needs Rework', 'IssueReported', 'AwaitingFileUpload'] } },
        { $set: { status: 'Cancelled', comments: `Parent workflow instance terminated by admin: ${reason}` } }
    );

    return WorkflowInstance.findById(instance._id).populate([
        { path: 'workflowDefinitionId', select: 'name version' },
        { path: 'startedBy', select: 'name email' },
        { path: 'terminationInfo.terminatedBy', select: 'name email' }
    ]).lean();
};

const adminRetryInstanceFailure = async (instanceId, adminUserId, newContextData = null) => {
    if (!mongoose.Types.ObjectId.isValid(instanceId)) {
        throw new Error('Invalid Workflow Instance ID format.');
    }

    const instance = await WorkflowInstance.findById(instanceId);
    if (!instance) {
        throw new Error('Workflow instance not found.');
    }

    if (instance.status !== 'Failed') {
        throw new Error(`Workflow instance is not in 'Failed' state. Current status: ${instance.status}. Cannot retry.`);
    }

    const failedNodeId = instance.errorInfo?.nodeId;
    if (!failedNodeId) {
        throw new Error('Cannot retry: Failed node ID not found in instance error information.');
    }

    const previousErrorInfo = { ...instance.errorInfo };
    instance.errorInfo = {
        retriedBy: adminUserId,
        retriedAt: new Date(),
        previousError: previousErrorInfo.message,
    };
    instance.markModified('errorInfo');

    if (newContextData && typeof newContextData === 'object') {
        instance.context = { ...instance.context, ...newContextData };
        instance.markModified('context');
        console.log(`[WF_INSTANCE_SERVICE] Admin ${adminUserId} updated context for instance ${instanceId} before retry.`);
    }
    
    instance.status = 'Running';
    instance.currentState.activeNodeIds = [failedNodeId];
    
    await instance.save();
    console.log(`[WF_INSTANCE_SERVICE] Admin ${adminUserId} initiated retry for instance ${instanceId} from node ${failedNodeId}.`);

    triggerExecution(instance._id.toString()).catch(engineError => {
        console.error(`[WF_INSTANCE_SERVICE] Background engine trigger for retry of ${instance._id} failed:`, engineError.message);
    });

    return instance.populate([
        { path: 'workflowDefinitionId', select: 'name version' },
        { path: 'startedBy', select: 'name email' },
    ]);
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
            if (value === undefined) return 'undefined';
            if (typeof value === 'object') return JSON.stringify(value, null, 2);
            return String(value);
        } catch (e) {
            console.error(`[TEMPLATE_RENDER] Error resolving path "${path}" (from template "${match}"):`, e);
            return returnUndefinedOnFail ? undefined : match;
        }
    });
};



module.exports = {
    createAndStartInstance,
    submitFileForNode,
    adminListAllInstances,
    adminGetInstanceDetails,
    adminTerminateInstance,
    adminRetryInstanceFailure,
    listInstances,
};