const workflowService = require('./workflow.service.js');

const createWorkflow = async (req, res, next) => {
    console.log("[WORKFLOW_CONTROLLER] createWorkflow req.body:", JSON.stringify(req.body, null, 2));
    try {
        const workflowData = req.body;

        const creatorId = req.user.id;

        if (!creatorId) {
            console.error("[WORKFLOW_CONTROLLER] Creator ID missing from req.user after authentication.");
            return res.status(500).json({ message: 'Authentication succeeded but user ID is missing.' });
        }

        console.log("[WORKFLOW_CONTROLLER] Creating workflow. Data:", workflowData, "CreatorID:", creatorId);

        const newWorkflow = await workflowService.create(workflowData, creatorId);
        res.status(201).json(newWorkflow);
    } catch (error) {
        console.error("[WORKFLOW_CONTROLLER] Error in createWorkflow:", error.message, error.stack); 
        next(error);
    }
};


const listWorkflows = async (req, res, next) => {
    try {
        const user = req.user;
        const { 
            status, 
            allVersions,
            originalDefinitionId,
            page, 
            limit, 
            sortBy, 
            sortOrder 
        } = req.query;

        const queryParams = { status, allVersions, originalDefinitionId };
        Object.keys(queryParams).forEach(key => queryParams[key] === undefined && delete queryParams[key]);
        
        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        const result = await workflowService.listWorkflows(user, queryParams, options);
        
        res.status(200).json({
            success: true,
            count: result.workflows.length,
            totalWorkflows: result.totalWorkflows,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            data: result.workflows,
        });
  } catch (error) {
      console.error("[WORKFLOW_CONTROLLER] Error in listWorkflows:", error.message);
      next(error);
  }
};

const getWorkflowById = async (req, res, next) => {
    try {
        const workflowId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log(`[WORKFLOW_CONTROLLER] Getting workflow by ID: ${workflowId} for user ${userId} (role: ${userRole})`);
        const workflow = await workflowService.getWorkflowById(workflowId, userId, userRole);

        if (!workflow) {
            return res.status(404).json({ 
                success: false, 
                message: 'Workflow not found or you are not authorized to view it.' 
            });
        }

        res.status(200).json({
            success: true,
            data: workflow,
        });
    } catch (error) {
        console.error(`[WORKFLOW_CONTROLLER] Error in getWorkflowById for ID ${req.params.id}:`, error.message);
        next(error);
    }
};

const updateWorkflow = async (req, res, next) => {
    try {
        const currentVersionId = req.params.id;
        const updateData = req.body;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log(`[WORKFLOW_CONTROLLER] Creating new version from workflow ID: ${currentVersionId} by user ${userId}`);

        const newWorkflowVersion = await workflowService.createNewVersionFromExisting(currentVersionId, updateData, userId, userRole);

        if (newWorkflowVersion && newWorkflowVersion.unauthorized) {
             return res.status(403).json({ success: false, message: newWorkflowVersion.message });
        }
        if (!newWorkflowVersion) {
            return res.status(404).json({ success: false, message: 'Failed to create new workflow version or source not found.' });
        }

        res.status(201).json({
            success: true,
            message: 'New workflow version created successfully.',
            data: newWorkflowVersion,
        });
    } catch (error) {
        console.error(`[WORKFLOW_CONTROLLER] Error in updateWorkflow for ID ${req.params.id}:`, error.message);
        if (error.message.startsWith('Workflow update validation failed:')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const deleteWorkflow = async (req, res, next) => {
    try {
        const workflowId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log(`[WORKFLOW_CONTROLLER] Deleting workflow ID: ${workflowId} by user ${userId} (role: ${userRole})`);

        const result = await workflowService.deleteWorkflowById(workflowId, userId, userRole);

        if (result.unauthorized) {
            return res.status(403).json({ success: false, message: result.message });
        }
        if (!result.deleted) {
            return res.status(404).json({ success: false, message: result.message || 'Workflow not found or could not be deleted.' });
        }

        res.status(200).json({
            success: true,
            message: result.message,
        });

    } catch (error) {
        console.error(`[WORKFLOW_CONTROLLER] Error in deleteWorkflow for ID ${req.params.id}:`, error.message);
        next(error);
    }
};

module.exports = {
    createWorkflow,
    listWorkflows,
    getWorkflowById,
    updateWorkflow,
    deleteWorkflow,
};