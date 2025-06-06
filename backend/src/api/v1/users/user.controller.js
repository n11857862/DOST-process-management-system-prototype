const userService = require('./user.service');


const getAllUsersAdmin = async (req, res, next) => {
    try {
        const queryParams = {
            page: req.query.page,
            limit: req.query.limit,
        };
        const result = await userService.listAllUsers(queryParams);
        res.status(200).json({
            success: true,
            message: 'Users retrieved successfully.',
            data: result.users,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalUsers: result.totalUsers,
                limit: parseInt(queryParams.limit, 10) || 10
            }
        });
    } catch (error) {
        console.error('[USER_CONTROLLER] Error in getAllUsersAdmin:', error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error getting users.' });
    }
};


const updateUserRoleAdmin = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role: newRole } = req.body;

        if (!newRole) {
            return res.status(400).json({ success: false, message: 'New role is required in the request body.' });
        }

        const updatedUser = await userService.updateUserRole(userId, newRole);
        
        res.status(200).json({
            success: true,
            message: 'User role updated successfully.',
            data: updatedUser,
        });
    } catch (error) {
        console.error(`[USER_CONTROLLER] Error in updateUserRoleAdmin for user ${req.params.userId}:`, error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error updating user role.' });
    }
};

const updateMyProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { name } = req.body;

        if (name === undefined) {
            return res.status(400).json({ success: false, message: 'No data provided for update. "name" field is expected.' });
        }
        
        const profileData = {};
        if (name !== undefined) profileData.name = name;

        const updatedUser = await userService.updateUserProfile(userId, profileData);

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            data: updatedUser,
        });
    } catch (error) {
        console.error(`[USER_CONTROLLER] Error in updateMyProfile for user ${req.user?.id}:`, error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error updating profile.' });
    }
};

const updateUserEmail = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { email } = req.body;
        
        console.log(`[USER_CONTROLLER] Updating email for user ${userId} to ${email}`);
        
        const userService = require('./user.service');
        
        const updatedUser = await userService.updateUserEmail(userId, email);
        
        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error(`[USER_CONTROLLER] Error updating email: ${error.message}`);
        next(error);
    }
};


module.exports = {
    getAllUsersAdmin,
    updateUserRoleAdmin,
    updateMyProfile,
    updateUserEmail,
};