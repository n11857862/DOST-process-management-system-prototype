const express = require('express');
const { 
    uploadFile, 
    getFileMeta, 
    downloadFileController,
    adminListAllFiles,
    adminDeleteFile
} = require('./file.controller.js');
const authenticate = require('../../core/middlewares/authenticate.js');
const authorize = require('../../core/middlewares/authorize.js');
const uploadMiddleware = require('../../../config/multerConfig.js');
const { mongoIdParamValidation } = require('../workflows/workflow.validation.js');
const validateRequest = require('../../core/middlewares/validateRequest.js');
const { USER_ROLES } = require('../users/user.model');
const { query, body, param } = require('express-validator');

const router = express.Router();

router.post(
    '/upload',
    authenticate,
    uploadMiddleware.single('file'),
    uploadFile
);

router.get(
    '/:fileId/meta',
    authenticate,
    getFileMeta
);

router.get(
    '/:fileId/download',
    authenticate,
    mongoIdParamValidation('fileId'),
    validateRequest,
    downloadFileController
);

router.get(
    '/admin/all',
    authenticate,
    authorize([USER_ROLES.find(role => role === 'admin') || 'admin']),
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('filename').optional().isString().trim(),
        query('mimetype').optional().isString().trim(),
        query('uploadedBy').optional().isMongoId(),
        query('sortBy').optional().isString().trim().isIn(['createdAt', 'filename', 'size', 'mimetype']),
        query('sortOrder').optional().isString().trim().isIn(['asc', 'desc'])
    ],
    validateRequest,
    adminListAllFiles
);

router.delete(
    '/admin/:fileId',
    authenticate,
    authorize([USER_ROLES.find(role => role === 'admin') || 'admin']),
    mongoIdParamValidation('fileId'),
    validateRequest,
    adminDeleteFile
);

module.exports = router;