const { validationResult } = require('express-validator');

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('[VALIDATE_REQUEST] Request body received:', req.body); 
        console.log('[VALIDATE_REQUEST] Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

module.exports = validateRequest;