const taskService = require('./task.service.js');
console.log('[TASK_CONTROLLER] Imported taskService keys:', Object.keys(taskService));


const getTasks = async (req, res, next) => {
    try {
        const user = req.user;
        const { 
            status, 
            assignedUserId, 
            assignedRoleName, 
            workflowInstanceId, 
            workflowDefinitionId,
            priority,
            dueDateBefore,
            dueDateAfter,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.query;

        const filters = { 
            status, 
            assignedUserId, 
            assignedRoleName, 
            workflowInstanceId, 
            workflowDefinitionId,
            priority, 
            dueDateBefore, 
            dueDateAfter 
        };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        
        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        console.log(`[TASK_CONTROLLER] User ${user.id} (Role: ${user.role}) requesting task list with filters:`, filters, "Options:", options);
        const result = await taskService.listTasks(filters, user, options);
        console.log('[TASK_CONTROLLER] Tasks being sent to frontend:', JSON.stringify(result.tasks, null, 2));
        res.status(200).json({
            success: true,
            count: result.tasks.length,
            totalTasks: result.totalTasks,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            data: result.tasks,
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error listing tasks:`, error.message);
        next(error);
    }
};


const completeTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const completionData = req.body;

        if (!taskId) {
            return res.status(400).json({ success: false, message: 'Task ID is required.' });
        }

        console.log(`[TASK_CONTROLLER] User ${actioningUserId} attempting to complete task ${taskId}`);
        const updatedTask = await taskService.completeTask(taskId, actioningUserId, completionData);

        res.status(200).json({
            success: true,
            message: 'Task completed successfully.',
            data: updatedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error completing task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not authorized') || error.message.includes('not in an actionable state')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};


const rejectTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const rejectionData = req.body;

        if (!taskId) {
            return res.status(400).json({ success: false, message: 'Task ID is required.' });
        }

        console.log(`[TASK_CONTROLLER] User ${actioningUserId} attempting to REJECT task ${taskId}`);
        const updatedTask = await taskService.rejectTask(taskId, actioningUserId, rejectionData);

        res.status(200).json({
            success: true,
            message: 'Task rejected successfully.',
            data: updatedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error rejecting task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not authorized') || error.message.includes('not in an actionable state')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const approveTaskControllerAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const approvalData = req.body;

        console.log(`[TASK_CONTROLLER] User ${actioningUserId} attempting to APPROVE task ${taskId}`);
        const updatedTask = await taskService.approveTaskAction(taskId, actioningUserId, approvalData);

        res.status(200).json({
            success: true,
            message: 'Task approved successfully.',
            data: updatedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error approving task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not authorized') || error.message.includes('not an approval task') || error.message.includes('not in an actionable state')) {
            return res.status(error.message.includes('not authorized') ? 403 : 400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const denyTaskControllerAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const rejectionData = req.body;

        console.log(`[TASK_CONTROLLER] User ${actioningUserId} attempting to DENY task ${taskId}`);
        const updatedTask = await taskService.denyTaskAction(taskId, actioningUserId, rejectionData);

        res.status(200).json({
            success: true,
            message: 'Task denied successfully.',
            data: updatedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error denying task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not authorized') || error.message.includes('not an approval task') || error.message.includes('not in an actionable state')) {
            return res.status(error.message.includes('not authorized') ? 403 : 400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getTaskDetails = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const user = req.user;

        console.log(`[TASK_CONTROLLER] User ${user.id} (Role: ${user.role}) requesting details for task ${taskId}`);
        const task = await taskService.getTaskById(taskId, user);

        if (!task) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }
        if (task.unauthorized) {
            return res.status(403).json({ success: false, message: 'You are not authorized to view this task.' });
        }

        res.status(200).json({
            success: true,
            data: task,
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error getting task details for ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const claimTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const claimingUserId = req.user.id;

        console.log(`[TASK_CONTROLLER] User ${claimingUserId} attempting to CLAIM task ${taskId}`);
        const claimedTask = await taskService.claimTask(taskId, claimingUserId);

        res.status(200).json({
            success: true,
            message: 'Task claimed successfully.',
            data: claimedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error claiming task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not assignable') || error.message.includes('already claimed') || error.message.includes('does not match') || error.message.includes('cannot be claimed')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('not authorized')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        next(error);
    }
};


const unclaimTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const actioningUserRole = req.user.role;

        console.log(`[TASK_CONTROLLER] User ${actioningUserId} (Role: ${actioningUserRole}) attempting to UNCLAIM task ${taskId}`);
        const unclaimedTask = await taskService.unclaimTask(taskId, actioningUserId, actioningUserRole);

        res.status(200).json({
            success: true,
            message: 'Task unclaimed successfully and returned to role queue.',
            data: unclaimedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error unclaiming task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not currently assigned') || error.message.includes('Cannot unclaim')) {
            return res.status(400).json({ success: false, message: error.message });
        }
         if (error.message.includes('not authorized')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const reassignTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const actioningUserId = req.user.id;
        const reassignmentDetails = req.body;

        if (!reassignmentDetails.newAssignedToType || !reassignmentDetails.newAssignedToId) {
            return res.status(400).json({ success: false, message: 'newAssignedToType and newAssignedToId are required in the request body.' });
        }
        
        console.log(`[TASK_CONTROLLER] User ${actioningUserId} attempting to REASSIGN task ${taskId} to ${reassignmentDetails.newAssignedToType}: ${reassignmentDetails.newAssignedToId}`);
        const reassignedTask = await taskService.reassignTask(taskId, reassignmentDetails, actioningUserId);

        res.status(200).json({
            success: true,
            message: 'Task reassigned successfully.',
            data: reassignedTask
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error reassigning task ${req.params.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required') || error.message.includes('cannot be reassigned')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        if (error.message.includes('not authorized')) {
            return res.status(403).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const adminDeleteTaskAction = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const adminUserId = req.user.id;

        console.log(`[TASK_CONTROLLER] Admin ${adminUserId} attempting to DELETE task ${taskId}`);
        const result = await taskService.adminDeleteTask(taskId);

        res.status(200).json({
            success: true,
            message: result.message,
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Admin error deleting task ${req.params.taskId}:`, error.message);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error deleting task.' });
    }
};

const generateTaskDocumentController = async (req, res, next) => {
    try {
        const { taskId } = req.params;
        const { templateString } = req.body;
        const user = req.user;

        if (typeof templateString !== 'string' || templateString.trim() === '') {
            return res.status(400).json({ success: false, message: 'templateString is required in the request body and cannot be empty.' });
        }

        console.log(`[TASK_CONTROLLER] User ${user.id} (Role: ${user.role}) requesting document generation for task ${taskId}`);
        const renderedDocument = await taskService.generateDocumentFromTaskContext(taskId, templateString, user);

        res.status(200).json({
            success: true,
            message: 'Document generated successfully.',
            data: {
                renderedDocument: renderedDocument,
            }
        });
    } catch (error) {
        console.error(`[TASK_CONTROLLER] Error generating document for task ${req.params.taskId}:`, error.message, error.stack);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error generating document.' });
    }
};

module.exports = {
    getTasks,
    getTaskDetails,
    completeTaskAction,
    rejectTaskAction,
    approveTaskControllerAction,
    denyTaskControllerAction,
    claimTaskAction,
    unclaimTaskAction,
    reassignTaskAction,
    adminDeleteTaskAction,
    generateTaskDocumentController,
};
