const express = require('express');
const userController = require('./user.controller');
const { body, param } = require('express-validator');
const authenticate = require('../../core/middlewares/authenticate');
const authorize = require('../../core/middlewares/authorize.js');
const validateRequest = require('../../core/middlewares/validateRequest');
const { USER_ROLES, User } = require('./user.model');


const router = express.Router();


router.get(
    '/admin/users',
    authenticate,
    authorize(['admin', 'manager']),
    userController.getAllUsersAdmin
);

router.put(
    '/admin/users/:userId/role',
    authenticate,
    authorize([USER_ROLES.find(role => role === 'admin') || 'admin']),
    userController.updateUserRoleAdmin
);

router.put(
    '/me/profile',
    authenticate,
    [
        body('name').optional().isString().trim().notEmpty().withMessage('Name must be a non-empty string if provided.')
                     .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
    ],
    validateRequest,
    userController.updateMyProfile
);

router.put(
    '/users/:userId/email',
    authenticate,
    authorize(['admin']),
    [
        param('userId').isMongoId().withMessage('Invalid user ID format'),
        body('email').isEmail().withMessage('Valid email is required')
                   .normalizeEmail()
                   .custom(async (email, { req }) => {
                       try {
                           const existingUser = await User.findOne({ 
                               email: email,
                               _id: { $ne: req.params.userId }
                           });
                           
                           if (existingUser) {
                               throw new Error('Email is already in use');
                           }
                           
                           return true;
                       } catch (error) {
                           console.error(`Error checking email uniqueness: ${error.message}`);
                           if (error.message === 'Email is already in use') {
                               throw error;
                           }
                           throw new Error('Error validating email. Please try again.');
                       }
                   })
    ],
    validateRequest,
    userController.updateUserEmail
);

module.exports = router;