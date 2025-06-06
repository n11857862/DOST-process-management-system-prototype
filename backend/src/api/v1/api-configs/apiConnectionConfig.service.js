const mongoose = require('mongoose');
const { ApiConnectionConfig, API_CONFIG_STATUSES } = require('./apiConnectionConfig.model.js');


const requestApiConfig = async (configData, requestedByUserId) => {
    const { name, apiUrl, apiMethod, headersTemplate, description } = configData;

    if (!name || !apiUrl || !apiMethod) {
        throw new Error('Name, API URL, and API Method are required for API configuration.');
    }

    let existingConfig = await ApiConnectionConfig.findOne({ 
        apiUrl, 
        apiMethod: apiMethod.toUpperCase(),
        status: { $in: ['Approved', 'PendingApproval'] }
    });

    if (existingConfig && existingConfig.canUserAccess(requestedByUserId)) {
        console.log(`[API_CONFIG_SERVICE] Found accessible existing API config for ${apiMethod} ${apiUrl} with ID ${existingConfig._id} and status ${existingConfig.status}.`);
        return existingConfig;
    }

    const newConfig = await ApiConnectionConfig.create({
        name,
        apiUrl,
        apiMethod: apiMethod.toUpperCase(),
        headersTemplate: headersTemplate || {},
        description,
        requestedBy: requestedByUserId,
        status: 'PendingApproval',
    });
    console.log(`[API_CONFIG_SERVICE] New API config requested and created with ID ${newConfig._id}, status: PendingApproval.`);
    return newConfig;
};


const listApiConfigs = async (filters = {}, options = {}, requestingUserId = null) => {
    const query = { ...filters };
    
    if (requestingUserId) {
        query.$or = [
            { requestedBy: requestingUserId },
            { isShared: true, status: 'Approved' },
            { allowedUsers: requestingUserId }
        ];
    }
    
    const page = parseInt(options.page, 10) || 1;
    const limit = parseInt(options.limit, 10) || 10;
    const skip = (page - 1) * limit;
    let sort = options.sortBy ? { [options.sortBy]: options.sortOrder === 'desc' ? -1 : 1 } : { createdAt: -1 };

    const configs = await ApiConnectionConfig.find(query)
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('allowedUsers', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();
    
    const totalConfigs = await ApiConnectionConfig.countDocuments(query);

    return {
        configs,
        currentPage: page,
        totalPages: Math.ceil(totalConfigs / limit),
        totalConfigs,
    };
};


const getApiConfigById = async (configId) => {
    if (!mongoose.Types.ObjectId.isValid(configId)) return null;
    return ApiConnectionConfig.findById(configId)
        .populate('requestedBy', 'name email')
        .populate('approvedBy', 'name email')
        .populate('rejectedBy', 'name email')
        .populate('allowedUsers', 'name email')
        .populate('usedByWorkflows.workflowId', 'name')
        .lean();
};


const updateApiConfigStatus = async (configId, adminUserId, newStatus, adminNotes = '') => {
    if (!mongoose.Types.ObjectId.isValid(configId)) throw new Error('Invalid API Config ID.');
    
    const validStatuses = API_CONFIG_STATUSES.filter(s => s !== 'PendingApproval');
    if (!validStatuses.includes(newStatus)) {
        throw new Error(`Invalid status update: '${newStatus}'. Must be one of ${validStatuses.join(', ')}.`);
    }

    const config = await ApiConnectionConfig.findById(configId);
    if (!config) throw new Error('API Configuration not found.');

    config.status = newStatus;
    config.adminNotes = adminNotes || config.adminNotes;

    if (newStatus === 'Approved') {
        config.approvedBy = adminUserId;
        config.approvedAt = new Date();
        config.rejectedBy = undefined;
        config.rejectedAt = undefined;
    } else if (newStatus === 'Rejected') {
        config.rejectedBy = adminUserId;
        config.rejectedAt = new Date();
        config.approvedBy = undefined;
        config.approvedAt = undefined;
    } else if (newStatus === 'Archived') {
    }
    
    await config.save();
    console.log(`[API_CONFIG_SERVICE] API Config ${configId} status updated to ${newStatus} by admin ${adminUserId}`);
    return config.populate('requestedBy approvedBy rejectedBy allowedUsers', 'name email');
};


const findOrCreatePendingConfig = async (apiDetails, requestedByUserId) => {
    const { name, apiUrl, apiMethod, headersTemplate, description } = apiDetails;

    if (!name || !apiUrl || !apiMethod) {
        throw new Error('Name, API URL, and API Method are required to find or create an API configuration.');
    }

    let config = await ApiConnectionConfig.findOne({ 
        apiUrl, 
        apiMethod: apiMethod.toUpperCase(),
        status: 'Approved',
        isShared: true
    });

    if (config) {
        console.log(`[API_CONFIG_SERVICE] Found existing shared approved API config ID ${config._id} for ${apiMethod} ${apiUrl}.`);
        config.addWorkflowUsage(null, 'automated-task-node');
        await config.save();
        return config;
    }

    config = await ApiConnectionConfig.findOne({ 
        apiUrl, 
        apiMethod: apiMethod.toUpperCase(),
        requestedBy: requestedByUserId,
        status: { $in: ['Approved', 'PendingApproval'] }
    });

    if (config) {
        console.log(`[API_CONFIG_SERVICE] Found existing user-created API config ID ${config._id} for ${apiMethod} ${apiUrl} with status ${config.status}.`);
        return config;
    }

    config = await ApiConnectionConfig.findOne({ 
        apiUrl, 
        apiMethod: apiMethod.toUpperCase(),
        status: 'Approved',
        $or: [
            { allowedUsers: requestedByUserId },
            { isShared: true }
        ]
    });

    if (config) {
        console.log(`[API_CONFIG_SERVICE] Found existing accessible API config ID ${config._id} for ${apiMethod} ${apiUrl}.`);
        config.addWorkflowUsage(null, 'automated-task-node');
        await config.save();
        return config;
    }

    config = await ApiConnectionConfig.create({
        name,
        apiUrl,
        apiMethod: apiMethod.toUpperCase(),
        headersTemplate: headersTemplate || {},
        description,
        requestedBy: requestedByUserId,
        status: 'PendingApproval',
    });
    console.log(`[API_CONFIG_SERVICE] New API config created with ID ${config._id} (name: ${name}), status: PendingApproval.`);
    return config;
};

const adminUpdateApiConfigDetails = async (configId, updateDetails, adminUserId) => {
    if (!mongoose.Types.ObjectId.isValid(configId)) {
        throw new Error('Invalid API Config ID format.');
    }

    const config = await ApiConnectionConfig.findById(configId);
    if (!config) {
        throw new Error('API Configuration not found.');
    }

    let statusChangedDueToEdit = false;
    const criticalFieldsChanged = (
        (updateDetails.apiUrl && updateDetails.apiUrl !== config.apiUrl) ||
        (updateDetails.apiMethod && updateDetails.apiMethod.toUpperCase() !== config.apiMethod)
    );

    if (config.status === 'Approved' && criticalFieldsChanged) {
        config.status = 'PendingApproval';
        config.approvedBy = undefined;
        config.approvedAt = undefined;
        statusChangedDueToEdit = true;
        console.log(`[API_CONFIG_SERVICE] API Config ${configId} status reset to PendingApproval due to critical field update by admin ${adminUserId}.`);
    }

    if (updateDetails.name !== undefined) config.name = updateDetails.name;
    if (updateDetails.description !== undefined) config.description = updateDetails.description;
    if (updateDetails.apiUrl !== undefined) config.apiUrl = updateDetails.apiUrl;
    if (updateDetails.apiMethod !== undefined) config.apiMethod = updateDetails.apiMethod.toUpperCase();
    if (updateDetails.headersTemplate !== undefined) config.headersTemplate = updateDetails.headersTemplate;
    if (updateDetails.isShared !== undefined) config.isShared = updateDetails.isShared;
    if (updateDetails.allowedUsers !== undefined) config.allowedUsers = updateDetails.allowedUsers;
    
    if (updateDetails.adminNotes !== undefined) config.adminNotes = updateDetails.adminNotes;

    try {
        const updatedConfig = await config.save();
        if (statusChangedDueToEdit) {
        }
        return updatedConfig.populate('requestedBy approvedBy rejectedBy allowedUsers', 'name email');
    } catch (error) {
        console.error(`[API_CONFIG_SERVICE] Error updating API config details for ${configId}:`, error);
        throw error;
    }
};

const searchSimilarConfigs = async (apiUrl, apiMethod, requestingUserId) => {
    const query = {
        apiUrl: { $regex: apiUrl, $options: 'i' },
        apiMethod: apiMethod.toUpperCase(),
        status: 'Approved',
        $or: [
            { requestedBy: requestingUserId },
            { isShared: true },
            { allowedUsers: requestingUserId }
        ]
    };

    return ApiConnectionConfig.find(query)
        .populate('requestedBy', 'name email')
        .select('name description apiUrl apiMethod status isShared usageCount lastUsedAt')
        .sort({ usageCount: -1, lastUsedAt: -1 })
        .limit(5)
        .lean();
};

const shareConfigWithUsers = async (configId, userIds, adminUserId) => {
    if (!mongoose.Types.ObjectId.isValid(configId)) {
        throw new Error('Invalid API Config ID format.');
    }

    const config = await ApiConnectionConfig.findById(configId);
    if (!config) {
        throw new Error('API Configuration not found.');
    }

    const newAllowedUsers = [...new Set([...config.allowedUsers.map(id => id.toString()), ...userIds])];
    config.allowedUsers = newAllowedUsers;

    await config.save();
    console.log(`[API_CONFIG_SERVICE] API Config ${configId} shared with users: ${userIds.join(', ')} by admin ${adminUserId}`);
    
    return config.populate('requestedBy approvedBy rejectedBy allowedUsers', 'name email');
};

module.exports = {
    requestApiConfig,
    findOrCreatePendingConfig,
    listApiConfigs,
    getApiConfigById,
    updateApiConfigStatus,
    adminUpdateApiConfigDetails,
    searchSimilarConfigs,
    shareConfigWithUsers,
};