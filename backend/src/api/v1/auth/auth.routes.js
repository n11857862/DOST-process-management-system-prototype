const express = require('express');
const { 
    registerUser, 
    loginUser, 
    logoutUser,
    changeMyPassword
} = require('./auth.controller');
const { 
    registerValidationRules, 
    loginValidationRules,
    changePasswordValidationRules
} = require('./auth.validation');
const validateRequest = require('../../core/middlewares/validateRequest');
const authenticate = require('../../core/middlewares/authenticate');

const router = express.Router();

router.post('/register', registerValidationRules(), validateRequest, registerUser);
router.post('/login', loginValidationRules(), validateRequest, loginUser); 
router.post('/logout', authenticate, logoutUser);

router.post(
    '/change-password', 
    authenticate,
    changePasswordValidationRules(),
    validateRequest,
    changeMyPassword
);


module.exports = router;