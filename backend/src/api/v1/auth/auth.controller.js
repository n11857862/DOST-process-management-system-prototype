const {User} = require('../users/user.model.js');
const jwt = require('jsonwebtoken'); 
const userService = require('../users/user.service.js');

const registerUser = async (req, res, next) => {

    try {
        const { name, username, email, password, role } = req.body;
        console.log('[AUTH_CONTROLLER] Registration attempt with data:', req.body);

        const userData = { name, password };
        if (username) userData.username = username;
        if (email) userData.email = email;
        if (role) userData.role = role;

        console.log('[AUTH_CONTROLLER] User data to be created:', userData);

        const newUser = await User.create(userData);

        if (newUser && newUser._id) {
            console.log('[AUTH_CONTROLLER] User successfully created in DB:', newUser._id.toString());
            res.status(201).json({
                success: true,
                message: 'User registered successfully.',
                data: {
                    id: newUser._id,
                    name: newUser.name,
                    username: newUser.username,
                    email: newUser.email,
                    role: newUser.role
                }
            });
        } else {
            console.error('[AUTH_CONTROLLER] User.create did not return a valid user or threw an unhandled error before this point.');
            return res.status(500).json({ message: 'User registration failed unexpectedly after create attempt.' });
        }

    } catch (error) {
        console.error('[AUTH_CONTROLLER] Error during user registration:', error);
        if (error.code === 11000) {
            return res.status(409).json({
                message: 'Registration failed: Username or email already exists.',
            });
        }
        if (error.name === 'ValidationError') {
             return res.status(400).json({
                 message: 'Registration failed: Validation error.',
                 errors: error.errors
             });
        }
        next(error);
    }
};

const loginUser = async (req, res, next) => {

    try {
        const { username, password } = req.body; 
        console.log('[AUTH_CONTROLLER] Login attempt for username:', username);

        if (!username || !password) {
            return res.status(400).json({ message: 'Please provide username and password.' });
        }

        const user = await User.findOne({ username }).select('+password');

        if (!user) {
            console.log('[AUTH_CONTROLLER] Login failed: User not found -', username);
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        if (!user.isActive) {
            console.log('[AUTH_CONTROLLER] Login failed: User inactive -', username);
            return res.status(403).json({ message: 'Account is deactivated.' });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            console.log('[AUTH_CONTROLLER] Login failed: Password mismatch for -', username);
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const payload = {
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
            }
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
        );

        console.log('[AUTH_CONTROLLER] Login successful, token generated for user:', user._id);
        res.status(200).json({
            success: true,
            token,
            data: {
                id: user._id,
                name: user.name,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error('[AUTH_CONTROLLER] Error during user login:', error);
        next(error);
    }
};

const logoutUser = async (req, res, next) => {
    try {
        
        const userId = req.user?.id;
        if (userId) {
            console.log(`[AUTH_CONTROLLER] User ${userId} logout request received.`);
        }


        res.status(200).json({
            success: true,
            message: 'User logged out successfully. Please discard your token on the client-side.'
        });
    } catch (error) {
        console.error('[AUTH_CONTROLLER] Error during logout:', error);
        next(error);
    }
};

const changeMyPassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
        }

        await userService.changePassword(userId, currentPassword, newPassword);

        res.status(200).json({
            success: true,
            message: 'Password changed successfully.',
        });
    } catch (error) {
        console.error(`[AUTH_CONTROLLER] Error in changeMyPassword for user ${req.user?.id}:`, error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error changing password.' });
    }
};

module.exports = {
    registerUser,
    loginUser,
    logoutUser,
    changeMyPassword,
};