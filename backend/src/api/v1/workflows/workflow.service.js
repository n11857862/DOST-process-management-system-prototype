
const mongoose = require('mongoose');
const Workflow = require('./workflow.model');

const create = async (workflowPayload, creatorId) => {
  console.log("[WORKFLOW_SERVICE] create - received workflowPayload:", JSON.stringify(workflowPayload, null, 2));

  const { 
    name, 
    description, 
    flow, 
    status = 'Draft', 
    expectedContextFields
  } = workflowPayload;

  if (!name) throw new Error('Workflow name is required.');
  if (!flow || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
      throw new Error('Invalid workflow structure: flow object with nodes and edges arrays is required.');
  }
  if (flow.nodes.length === 0) {
       throw new Error('Workflow must contain at least one node.');
   }

  try {
    const workflowDocumentData = {
        name,
        description,
        createdBy: creatorId,
        flow: flow || { nodes: [], edges: [] }, 
        status: status, 
        expectedContextFields: expectedContextFields || [],
        version: 1, 
        isLatestVersion: true,
    };
    
    console.log("[WORKFLOW_SERVICE] Data for new Workflow model:", JSON.stringify(workflowDocumentData, null, 2));
    const workflow = new Workflow(workflowDocumentData);

    const savedWorkflow = await workflow.save();

    const populatedWorkflow = await Workflow.findById(savedWorkflow._id)
                                            .populate('createdBy', 'name email')
                                            .lean(); 

    if (!populatedWorkflow) {
        throw new Error('Failed to retrieve the created workflow after saving.');
    }
    return populatedWorkflow;

  } catch (error) {
    console.error("Error creating workflow in service:", error);
    if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        throw new Error(`Workflow validation failed: ${messages.join(', ')}`);
    }
    throw error;
  }
};

const fileService = {
    linkFileToNode: async (fileId, workflowId, nodeId) => {
        console.log(`Mock linking file ${fileId} to node ${nodeId} in workflow ${workflowId}`);
        return true;
    },
};

const workflowEngine = {
    startExecution: async (workflowId, initialContext = {}) => {
        console.log(`Mock starting execution for workflow ${workflowId}`);
        return { executionId: new mongoose.Types.ObjectId(), status: 'Running' };
    }
};

const listWorkflows = async (user, queryParams = {}, options = {}) => {
    try {
        const query = {};

        if (user.role === 'manager') {
            query.createdBy = user.id;
        } else if (user.role !== 'admin') {
            return { workflows: [], totalWorkflows: 0, totalPages: 0, currentPage: 1 };
        }

        if (queryParams.allVersions !== 'true' && !queryParams.originalDefinitionId) {
            query.isLatestVersion = true;
        }

        if (queryParams.originalDefinitionId && mongoose.Types.ObjectId.isValid(queryParams.originalDefinitionId)) {
            query.originalDefinitionId = queryParams.originalDefinitionId;
            delete query.isLatestVersion;
        }

        if (queryParams.status) {
            const statuses = queryParams.status.split(',').map(s => s.trim());
            query.status = { $in: statuses };
        } else if (query.isLatestVersion === true) {
            query.status = { $in: ['Draft', 'Active'] };
        }


        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const skip = (page - 1) * limit;
        let sort = {};
        if (options.sortBy) {
            sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
        } else if (query.originalDefinitionId) {
            sort.version = -1;
        } else {
            sort.updatedAt = -1;
        }
        
        console.log(`[WORKFLOW_SERVICE] Listing workflows with query:`, JSON.stringify(query));
        const workflows = await Workflow.find(query)
            .populate('createdBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalWorkflows = await Workflow.countDocuments(query);

        return {
            workflows,
            currentPage: page,
            totalPages: Math.ceil(totalWorkflows / limit),
            totalWorkflows,
        };
  } catch (error) {
      console.error("Error listing workflows:", error);
      throw error;
  }
};

const getWorkflowById = async (workflowId, userId, userRole) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(workflowId)) {
            return null;
        }

        const workflow = await Workflow.findById(workflowId)
            .populate('createdBy', 'name email')
            .lean();

        if (!workflow) {
            return null;
        }

        if (userRole === 'admin' || (userRole === 'manager' && workflow.createdBy._id.toString() === userId.toString())) {
            return workflow;
        }
        
        return null;

    } catch (error) {
        console.error(`Error fetching workflow by ID (${workflowId}):`, error);
        throw error;
    }
};

const createNewVersionFromExisting = async (currentVersionId, updateData, userId, userRole) => {
    if (!mongoose.Types.ObjectId.isValid(currentVersionId)) {
        throw new Error('Invalid current Workflow ID format for versioning.');
    }

    const currentWorkflow = await Workflow.findById(currentVersionId);
    if (!currentWorkflow) {
        throw new Error('Workflow to version from not found.');
    }

    if (userRole !== 'admin' && currentWorkflow.createdBy.toString() !== userId.toString()) {
        return { unauthorized: true, message: 'You are not authorized to create a new version of this workflow.' };
    }

    try {
        await Workflow.updateMany(
            { originalDefinitionId: currentWorkflow.originalDefinitionId, isLatestVersion: true },
            { $set: { isLatestVersion: false } }
        );

        const newVersionData = {
            name: updateData.name || currentWorkflow.name,
            description: updateData.description || currentWorkflow.description,
            flow: updateData.flow || currentWorkflow.flow,
            status: updateData.status || currentWorkflow.status || 'Draft',
            createdBy: userId,
            originalDefinitionId: currentWorkflow.originalDefinitionId,
            version: currentWorkflow.version + 1,
            isLatestVersion: true,
            expectedContextFields: updateData.expectedContextFields !== undefined ? updateData.expectedContextFields : currentWorkflow.expectedContextFields || []
        };

        const newWorkflowVersion = new Workflow(newVersionData);
        await newWorkflowVersion.save();
        
        return await Workflow.findById(newWorkflowVersion._id)
            .populate('createdBy', 'name email')
            .lean();
    } catch (error) {
        console.error(`Error creating new workflow version from ${currentVersionId}:`, error);
        if (error.name === 'ValidationError') { }
        throw error;
    }
};

const getLatestPublishedVersionByOriginalId = async (originalId, user) => {
    if (!mongoose.Types.ObjectId.isValid(originalId)) return null;

    const workflow = await Workflow.findOne({
        originalDefinitionId: originalId,
        isLatestVersion: true,
        status: 'Published'
    })
    .populate('createdBy', 'name email')
    .lean();

    if (!workflow) return null;

    return workflow;
};

const archiveWorkflowVersion = async (workflowId, userId, userRole) => {
    if (!mongoose.Types.ObjectId.isValid(workflowId)) {
        return { archived: false, message: 'Invalid Workflow ID format.' };
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const workflowToArchive = await Workflow.findById(workflowId).session(session);
        if (!workflowToArchive) {
            await session.abortTransaction();
            session.endSession();
            return { archived: false, message: 'Workflow version not found.' };
        }

        if (userRole !== 'admin' && workflowToArchive.createdBy.toString() !== userId.toString()) {
            await session.abortTransaction();
            session.endSession();
            return { archived: false, unauthorized: true, message: 'You are not authorized to archive this workflow version.' };
        }

        const wasLatest = workflowToArchive.isLatestVersion;
        workflowToArchive.status = 'Archived';
        workflowToArchive.isLatestVersion = false;
        await workflowToArchive.save({ session });

        if (wasLatest && workflowToArchive.originalDefinitionId) {
            const previousActiveVersion = await Workflow.findOne({
                originalDefinitionId: workflowToArchive.originalDefinitionId,
                status: { $in: ['Draft', 'Published'] },
                _id: { $ne: workflowToArchive._id }
            })
            .sort({ version: -1 })
            .session(session);

            if (previousActiveVersion) {
                previousActiveVersion.isLatestVersion = true;
                await previousActiveVersion.save({ session });
                console.log(`[WORKFLOW_SERVICE] Set workflow version ${previousActiveVersion._id} (v${previousActiveVersion.version}) as latest after archiving ${workflowToArchive._id}.`);
            } else {
                 console.log(`[WORKFLOW_SERVICE] No other active version found for ${workflowToArchive.originalDefinitionId} to mark as latest after archiving ${workflowToArchive._id}.`);
            }
        }

        await session.commitTransaction();
        session.endSession();
        return { archived: true, message: `Workflow version ${workflowToArchive.version} (ID: ${workflowId}) archived successfully.` };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Error archiving workflow version ${workflowId}:`, error);
        throw error;
    }
};

const getFileDownloadUrl = (fileId) => {
  if (!fileId) return null;
  const base = apiClient.defaults.baseURL.endsWith('/') ? apiClient.defaults.baseURL.slice(0, -1) : apiClient.defaults.baseURL;
  const filesBase = FILES_ENDPOINT.startsWith('/') ? FILES_ENDPOINT : `/${FILES_ENDPOINT}`;
  return `${base}${filesBase}/${fileId}/download`;
};

const updateMyProfile = async (profileData) => {
    try {
        const response = await apiClient.put('/users/me/profile', profileData);
        return response.data;
    } catch (error) {
        console.error('Error in updateMyProfile service:', error.response?.data || error.message);
        throw error;
    }
};

const changeMyPassword = async (passwordData) => {
    try {
        const response = await apiClient.post('/auth/change-password', passwordData);
        return response.data;
    } catch (error) {
        console.error('Error in changeMyPassword service:', error.response?.data || error.message);
        throw error;
    }
};

const deleteWorkflow = async (req, res, next) => {
    try {
        const workflowId = req.params.id;
        const userId = req.user.id;
        const userRole = req.user.role;

        console.log(`[WORKFLOW_CONTROLLER] Archiving workflow ID: ${workflowId} by user ${userId} (role: ${userRole})`);

        const result = await workflowService.archiveWorkflowVersion(workflowId, userId, userRole);

        if (result.unauthorized) {
            return res.status(403).json({ success: false, message: result.message });
        }
        
        if (result.archived) {
            res.status(200).json({
                success: true,
                message: result.message || `Workflow definition (ID: ${workflowId}) archived successfully.`,
            });
        } else {
            return res.status(400).json({ success: false, message: result.message || 'Failed to archive workflow.' });
        }
    } catch (error) {
        console.error(`[WORKFLOW_CONTROLLER] Error in deleteWorkflow (archive) for ID ${req.params.id}:`, error.message);
        if (error.status) {
            return res.status(error.status).json({ success: false, message: error.message });
        }
        next(error);
    }
};



module.exports = {
    create,
    createNewVersionFromExisting,
    listWorkflows,
    getWorkflowById,
    getLatestPublishedVersionByOriginalId,
    archiveWorkflowVersion,
    getFileDownloadUrl,
    updateMyProfile,
    changeMyPassword,
    deleteWorkflow,
};