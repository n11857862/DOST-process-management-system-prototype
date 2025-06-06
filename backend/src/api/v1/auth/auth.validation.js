const { body } = require('express-validator');
const {User, USER_ROLES} = require('../users/user.model.js');


const registerValidationRules = () => {
  return [
    body('name')
      .optional({ checkFalsy: true })
      .trim()
      .isString().withMessage('Name must be a string if provided.'),
    
    body('username')
      .trim()
      .notEmpty().withMessage('Username is required.')
      .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long.')
      .isAlphanumeric().withMessage('Username must contain only letters and numbers.')
      .custom(async (value) => {
        const user = await User.findOne({ username: value });
        if (user) {
          return Promise.reject('Username already in use.');
        }
      }),

    body('email')
      .optional({ checkFalsy: true }) 
      .trim()
      .isEmail().withMessage('Please provide a valid email address if an email is entered.')
      .custom(async (value) => {
        if (value) { 
          const user = await User.findOne({ email: value });
          if (user) {
            return Promise.reject('Email already in use if provided.');
          }
        }
      }),

    body('password')
      .notEmpty().withMessage('Password is required.')
      .isString().withMessage('Password must be a string.')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),

    body('role')
      .trim()
      .notEmpty().withMessage('Role is required.')
      .isIn(USER_ROLES).withMessage(`Invalid role specified. Must be one of: ${USER_ROLES.join(', ')}`),
  ];
};

const loginValidationRules = () => {
  return [
    body('username').notEmpty().withMessage('Username is required for login.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ];
};

const changePasswordValidationRules = () => [
    body('currentPassword').notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long.'),
    body('confirmNewPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('New password confirmation does not match new password.');
        }
        return true;
    }),
];

const reassignTaskValidationRules = () => [
    body('newAssignedToType').isIn(['User', 'Role']).withMessage('newAssignedToType must be "User" or "Role".'),
    body('newAssignedToId').notEmpty().withMessage('newAssignedToId is required.'),
    body('newAssignedToId').if(body('newAssignedToType').equals('Role'))
        .isIn(USER_ROLES)
        .withMessage(`If reassigning to a role, newAssignedToId must be one of: ${USER_ROLES.join(', ')}`),
    body('reassignComment').optional().isString().trim()
];

module.exports = {
  registerValidationRules,
  loginValidationRules,
  changePasswordValidationRules,
  reassignTaskValidationRules
};