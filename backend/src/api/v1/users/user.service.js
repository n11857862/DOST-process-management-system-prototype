const { User, USER_ROLES } = require('./user.model');
const mongoose = require('mongoose');


const listAllUsers = async (queryParams = {}) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 10;
    const skip = (page - 1) * limit;

    try {
        const usersQuery = User.find({})
            .sort({ createdAt: -1 });

        const users = await usersQuery.skip(skip).limit(limit).lean();
        const totalUsers = await User.countDocuments({});

        return {
            users,
            currentPage: page,
            totalPages: Math.ceil(totalUsers / limit),
            totalUsers,
        };
    } catch (error) {
        console.error('[USER_SERVICE] Error listing all users:', error);
        throw new Error('Failed to retrieve users.');
    }
};


const updateUserRole = async (userId, newRole) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error('Invalid user ID format.');
        err.status = 400;
        throw err;
    }

    if (!USER_ROLES.includes(newRole)) {
        const err = new Error(`Invalid role. Must be one of: ${USER_ROLES.join(', ')}.`);
        err.status = 400;
        throw err;
    }

    try {
        const user = await User.findById(userId);

        if (!user) {
            const err = new Error('User not found.');
            err.status = 404;
            throw err;
        }

        user.role = newRole;
        await user.save();

        return user; 
    } catch (error) {
        console.error(`[USER_SERVICE] Error updating role for user ${userId}:`, error);
        if (!error.status) {
             throw new Error('Failed to update user role.');
        }
        throw error;
    }
};

const updateUserProfile = async (userId, profileData) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error('Invalid user ID format.');
        err.status = 400;
        throw err;
    }

    const allowedUpdates = ['name'];
    const updates = {};

    if (profileData.name !== undefined) {
        if (typeof profileData.name !== 'string' || profileData.name.trim() === '') {
            const err = new Error('Name must be a non-empty string.');
            err.status = 400;
            throw err;
        }
        updates.name = profileData.name.trim();
    }

    if (Object.keys(updates).length === 0) {
        const err = new Error('No valid profile data provided for update.');
        err.status = 400;
        throw err;
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const err = new Error('User not found.');
            err.status = 404;
            throw err;
        }

        Object.keys(updates).forEach(key => {
            user[key] = updates[key];
        });

        await user.save();
        return user;
    } catch (error) {
        console.error(`[USER_SERVICE] Error updating profile for user ${userId}:`, error);
        if (error.name === 'ValidationError') {
            error.status = 400;
        }
        if (!error.status) {
            throw new Error('Failed to update user profile.');
        }
        throw error;
    }
};

const changePassword = async (userId, currentPassword, newPassword) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error('Invalid user ID format.');
        err.status = 400;
        throw err;
    }

    try {
        const user = await User.findById(userId).select('+password');

        if (!user) {
            const err = new Error('User not found.');
            err.status = 404;
            throw err;
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            const err = new Error('Incorrect current password.');
            err.status = 401;
            throw err;
        }

        
        user.password = newPassword;
        await user.save();
        
        console.log(`[USER_SERVICE] Password changed successfully for user ${userId}`);

    } catch (error) {
        console.error(`[USER_SERVICE] Error changing password for user ${userId}:`, error);
        if (error.name === 'ValidationError') {
             error.status = 400;
        }
        if (!error.status) {
            throw new Error('Failed to change password due to a server error.');
        }
        throw error;
    }
};

const updateUserEmail = async (userId, email) => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        const err = new Error('Invalid user ID format.');
        err.status = 400;
        throw err;
    }

    if (!email || typeof email !== 'string' || email.trim() === '') {
        const err = new Error('Email must be a non-empty string.');
        err.status = 400;
        throw err;
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            const err = new Error('User not found.');
            err.status = 404;
            throw err;
        }

        user.email = email.trim().toLowerCase();

        await user.save();
        
        return user;
    } catch (error) {
        console.error(`[USER_SERVICE] Error updating email for user ${userId}:`, error);
        
        if (error.name === 'ValidationError') {
            error.status = 400;
        }
        
        if (error.code === 11000) {
            const err = new Error('Email is already in use.');
            err.status = 400;
            throw err;
        }
        
        if (!error.status) {
            throw new Error('Failed to update user email.');
        }
        throw error;
    }
};

module.exports = {
    listAllUsers,
    updateUserRole,
    updateUserProfile,
    changePassword,
    updateUserEmail,
};

