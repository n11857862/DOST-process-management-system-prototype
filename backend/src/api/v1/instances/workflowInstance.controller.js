const workflowInstanceService = require('./workflowInstance.service.js');

const startWorkflow = async (req, res, next) => {
    try {
        const { workflowDefinitionId, initialContext } = req.body;
        const userId = req.user.id;

        if (!workflowDefinitionId) {
            return res.status(400).json({ success: false, message: 'Workflow Definition ID is required.' });
        }

        console.log(`[WF_INSTANCE_CONTROLLER] Attempting to start workflow definition: ${workflowDefinitionId} by user ${userId}`);
        
        const instance = await workflowInstanceService.createAndStartInstance(
            workflowDefinitionId,
            userId,
            initialContext
        );

        res.status(201).json({
            success: true,
            message: 'Workflow instance started successfully.',
            data: instance,
        });
    } catch (error) {
        console.error('[WF_INSTANCE_CONTROLLER] Error starting workflow instance:', error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const submitFileForNodeAction = async (req, res, next) => {
    try {
        const { instanceId, nodeId } = req.params;
        const { fileId } = req.body;
        const actioningUserId = req.user.id;

        if (!fileId) {
            return res.status(400).json({ success: false, message: 'fileId is required in the request body.' });
        }
        
        console.log(`[WF_INSTANCE_CONTROLLER] User ${actioningUserId} submitting file ${fileId} for node ${nodeId} in instance ${instanceId}`);

        const instance = await workflowInstanceService.submitFileForNode(
            instanceId,
            nodeId,
            fileId,
            actioningUserId
        );

        res.status(200).json({
            success: true,
            message: 'File submitted successfully for node and workflow resumed.',
            data: instance,
        });

    } catch (error) {
        console.error(`[WF_INSTANCE_CONTROLLER] Error submitting file for node ${req.params.nodeId} in instance ${req.params.instanceId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not awaiting')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const adminGetAllInstances = async (req, res, next) => {
    try {
        const { 
            status, 
            workflowDefinitionId, 
            startedBy,
            page, limit, sortBy, sortOrder 
        } = req.query;

        const filters = { status, workflowDefinitionId, startedBy };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        
        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        console.log(`[WF_INSTANCE_CONTROLLER] Admin requesting all instances with filters:`, filters, "Options:", options);
        const result = await workflowInstanceService.adminListAllInstances(filters, options);

        res.status(200).json({
            success: true,
            count: result.instances.length,
            totalInstances: result.totalInstances,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            data: result.instances,
        });
    } catch (error) {
        console.error('[WF_INSTANCE_CONTROLLER] Admin error listing instances:', error.message);
        next(error);
    }
};


const adminGetSingleInstanceDetails = async (req, res, next) => {
    try {
        const { instanceId } = req.params;
        console.log(`[WF_INSTANCE_CONTROLLER] Admin requesting details for instance ${instanceId}`);
        const instance = await workflowInstanceService.adminGetInstanceDetails(instanceId);

        if (!instance) {
            return res.status(404).json({ success: false, message: 'Workflow instance not found.' });
        }
        
        res.status(200).json({ success: true, data: instance });
    } catch (error) {
        console.error(`[WF_INSTANCE_CONTROLLER] Admin error getting instance details for ${req.params.instanceId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const adminTerminateSingleInstance = async (req, res, next) => {
    try {
        const { instanceId } = req.params;
        const adminUserId = req.user.id;
        const { reason } = req.body;

        console.log(`[WF_INSTANCE_CONTROLLER] Admin ${adminUserId} attempting to terminate instance ${instanceId}`);
        
        const terminatedInstance = await workflowInstanceService.adminTerminateInstance(instanceId, adminUserId, reason);

        res.status(200).json({
            success: true,
            message: `Workflow instance ${instanceId} terminated successfully.`,
            data: terminatedInstance,
        });
    } catch (error) {
        console.error(`[WF_INSTANCE_CONTROLLER] Admin error terminating instance ${req.params.instanceId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('already in a terminal state')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const adminRetryFailedInstance = async (req, res, next) => {
    try {
        const { instanceId } = req.params;
        const adminUserId = req.user.id;
        const { contextUpdates } = req.body;

        console.log(`[WF_INSTANCE_CONTROLLER] Admin ${adminUserId} attempting to retry failed instance ${instanceId}`);
        
        const retriedInstance = await workflowInstanceService.adminRetryInstanceFailure(instanceId, adminUserId, contextUpdates);

        res.status(200).json({
            success: true,
            message: `Workflow instance ${instanceId} retry initiated from node ${retriedInstance.errorInfo?.previousError ? '(previously failed)' : ''}${retriedInstance.currentState.activeNodeIds[0]}.`,
            data: retriedInstance,
        });
    } catch (error) {
        console.error(`[WF_INSTANCE_CONTROLLER] Admin error retrying instance ${req.params.instanceId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('not in \'Failed\' state')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getAllInstances = async (req, res, next) => {
    try {
        const user = req.user;
        const queryParams = req.query;

        console.log(`[WF_INSTANCE_CONTROLLER] User ${user.id} (role: ${user.role}) requesting instance list with query:`, queryParams);
        const result = await workflowInstanceService.listInstances(queryParams, user);

        res.status(200).json({
            success: true,
            message: 'Workflow instances retrieved successfully.',
            data: result.instances,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalItems: result.totalInstances,
                limit: parseInt(queryParams.limit, 10) || 10
            }
        });
    } catch (error) {
        console.error('[WF_INSTANCE_CONTROLLER] Error listing instances:', error.message);
        next(error);
    }
};


module.exports = {
    startWorkflow,
    submitFileForNodeAction,
    adminGetAllInstances,
    adminGetSingleInstanceDetails,
    adminTerminateSingleInstance, 
    adminRetryFailedInstance,
    getAllInstances,
};