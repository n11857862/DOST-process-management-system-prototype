const apiConfigService = require('./apiConnectionConfig.service.js');


const adminListApiConfigs = async (req, res, next) => {
    try {
        let { status, page, limit, sortBy, sortOrder } = req.query;
        const filters = {};

        if (status !== undefined && status !== "") {
            filters.status = status;
        }

        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        // Admin can see all configs, so don't pass requestingUserId
        const result = await apiConfigService.listApiConfigs(filters, options);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('[API_CONFIG_CONTROLLER] Error listing API configs for admin:', error.message);
        next(error);
    }
};

const userListApiConfigs = async (req, res, next) => {
    try {
        let { status, page, limit, sortBy, sortOrder } = req.query;
        const filters = {};

        if (status !== undefined && status !== "") {
            filters.status = status;
        }

        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        // Users can only see configs they have access to
        const result = await apiConfigService.listApiConfigs(filters, options, req.user.id);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        console.error('[API_CONFIG_CONTROLLER] Error listing API configs for user:', error.message);
        next(error);
    }
};


const adminGetApiConfigDetails = async (req, res, next) => {
    try {
        const { configId } = req.params;
        const config = await apiConfigService.getApiConfigById(configId);
        if (!config) {
            return res.status(404).json({ success: false, message: 'API Configuration not found.' });
        }
        res.status(200).json({ success: true, data: config });
    } catch (error) {
        console.error(`[API_CONFIG_CONTROLLER] Error getting API config details for ${req.params.configId}:`, error.message);
        next(error);
    }
};


const adminUpdateApiConfigStatus = async (req, res, next) => {
    try {
        const { configId } = req.params;
        const { status, adminNotes } = req.body;
        const adminUserId = req.user.id;

        if (!status) {
            return res.status(400).json({ success: false, message: 'New status is required.' });
        }

        const updatedConfig = await apiConfigService.updateApiConfigStatus(configId, adminUserId, status, adminNotes);
        res.status(200).json({ success: true, message: `API Configuration status updated to ${status}.`, data: updatedConfig });
    } catch (error) {
        console.error(`[API_CONFIG_CONTROLLER] Error updating API config status for ${req.params.configId}:`, error.message);
         if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(error.message.startsWith('Invalid status update:') ? 400 : 404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const findOrCreateConfigController = async (req, res, next) => {
    try {
        const apiDetails = req.body;
        const requestedByUserId = req.user.id;

        if (!apiDetails.name || !apiDetails.apiUrl || !apiDetails.apiMethod) {
            return res.status(400).json({ success: false, message: 'Name, apiUrl, and apiMethod are required.' });
        }
        
        console.log(`[API_CONFIG_CONTROLLER] User ${requestedByUserId} finding/creating API config for: ${apiDetails.name}`);
        const config = await apiConfigService.findOrCreatePendingConfig(apiDetails, requestedByUserId);
        
        // Determine if this was a new creation or existing config reuse
        const isNewConfig = config.requestedBy.toString() === requestedByUserId && 
                           config.createdAt && 
                           (Date.now() - new Date(config.createdAt).getTime()) < 5000; // Created within last 5 seconds
        
        res.status(isNewConfig ? 201 : 200).json({
            success: true,
            message: isNewConfig ? 'New API configuration request created.' : 'Existing API configuration found and linked.',
            data: config,
        });
    } catch (error) {
        console.error('[API_CONFIG_CONTROLLER] Error in findOrCreatePendingConfig:', error.message);
        if (error.message.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        // Removed the unique constraint error handling since we no longer have unique constraints
        next(error);
    }
};

const adminEditApiConfig = async (req, res, next) => {
    try {
        const { configId } = req.params;
        const updateDetails = req.body;
        const adminUserId = req.user.id;

        if (Object.keys(updateDetails).length === 0) {
            return res.status(400).json({ success: false, message: 'No update data provided.' });
        }
        
        console.log(`[API_CONFIG_CONTROLLER] Admin ${adminUserId} attempting to edit API config ${configId}`);
        const updatedConfig = await apiConfigService.adminUpdateApiConfigDetails(configId, updateDetails, adminUserId);
        
        res.status(200).json({
            success: true,
            message: 'API Configuration details updated successfully.',
            data: updatedConfig
        });
    } catch (error) {
        console.error(`[API_CONFIG_CONTROLLER] Error editing API config ${req.params.configId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const searchSimilarConfigs = async (req, res, next) => {
    try {
        const { apiUrl, apiMethod } = req.query;
        const requestingUserId = req.user.id;

        if (!apiUrl || !apiMethod) {
            return res.status(400).json({ success: false, message: 'apiUrl and apiMethod are required for search.' });
        }

        const similarConfigs = await apiConfigService.searchSimilarConfigs(apiUrl, apiMethod, requestingUserId);
        
        res.status(200).json({
            success: true,
            message: `Found ${similarConfigs.length} similar configurations.`,
            data: similarConfigs
        });
    } catch (error) {
        console.error('[API_CONFIG_CONTROLLER] Error searching similar configs:', error.message);
        next(error);
    }
};

const shareConfigWithUsers = async (req, res, next) => {
    try {
        const { configId } = req.params;
        const { userIds } = req.body;
        const adminUserId = req.user.id;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ success: false, message: 'userIds array is required and must not be empty.' });
        }

        const updatedConfig = await apiConfigService.shareConfigWithUsers(configId, userIds, adminUserId);
        
        res.status(200).json({
            success: true,
            message: `API Configuration shared with ${userIds.length} user(s).`,
            data: updatedConfig
        });
    } catch (error) {
        console.error(`[API_CONFIG_CONTROLLER] Error sharing config ${req.params.configId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

module.exports = {
    adminListApiConfigs,
    userListApiConfigs,
    adminGetApiConfigDetails,
    adminUpdateApiConfigStatus,
    findOrCreateConfigController,
    adminEditApiConfig,
    searchSimilarConfigs,
    shareConfigWithUsers,
};