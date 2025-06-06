const fileService = require('./file.service.js');
const fs = require('fs');

const uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded.' });
        }

        const userId = req.user.id;
        console.log(`[FILE_CONTROLLER] File upload attempt by user ${userId}:`, req.file.originalname);

        const fileRecord = await fileService.createFileRecord(req.file, userId);

        res.status(201).json({
            success: true,
            message: 'File uploaded and record created successfully.',
            data: {
                fileId: fileRecord._id,
                filename: fileRecord.filename,
                originalname: req.file.originalname,
                mimetype: fileRecord.mimetype,
                size: fileRecord.size,
                storagePath: fileRecord.storagePath,
            },
        });
    } catch (error) {
        console.error('[FILE_CONTROLLER] Error uploading file:', error.message);
        if (error.message.includes('No file uploaded') || error.message.includes('User ID is required')) {
             return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};



const getFileMeta = async (req, res, next) => {
    try {
        const fileRecord = await fileService.getFileRecordById(req.params.fileId);
        if (!fileRecord) {
            return res.status(404).json({ success: false, message: 'File metadata not found.' });
        }
        res.status(200).json({ success: true, data: fileRecord });
    } catch (error) {
        next(error);
    }
};


const downloadFileController = async (req, res, next) => {
    try {
        const { fileId } = req.params;
        const userId = req.user.id;

        console.log(`[FILE_CONTROLLER] User ${userId} attempting to download file ID: ${fileId}`);
        
        const fileDetails = await fileService.prepareFileForDownload(fileId, userId);

        if (!fileDetails) {
            return res.status(404).json({ success: false, message: 'File not found or you are not authorized.' });
        }

        
        if (!fs.existsSync(fileDetails.absolutePath)) {
            console.error(`[FILE_CONTROLLER] File not found on disk: ${fileDetails.absolutePath} for file ID ${fileId}`);
            return res.status(404).json({ success: false, message: 'File not found on server.' });
        }

        res.download(fileDetails.absolutePath, fileDetails.originalFilename, (err) => {
            if (err) {
                console.error(`[FILE_CONTROLLER] Error occurred during file download stream for ${fileId}:`, err);
                if (!res.headersSent) {
                    return res.status(500).json({ success: false, message: 'Could not download the file.' });
                }
            } else {
                console.log(`[FILE_CONTROLLER] File ${fileDetails.originalFilename} (ID: ${fileId}) successfully sent for download.`);
            }
        });

    } catch (error) {
        console.error(`[FILE_CONTROLLER] Error in downloadFileController for file ID ${req.params.fileId}:`, error.message);
        if (!res.headersSent) {
            if (error.message.toLowerCase().includes('not found') || error.message.toLowerCase().includes('invalid id')) {
                return res.status(404).json({ success: false, message: error.message });
            }
            if (error.message.toLowerCase().includes('not authorized')) {
                return res.status(403).json({ success: false, message: error.message });
            }
        }
        next(error);
    }
};

const adminListAllFiles = async (req, res, next) => {
    try {
        const queryParams = req.query;
        const result = await fileService.listAllFilesForAdmin(queryParams);
        res.status(200).json({
            success: true,
            message: 'Files retrieved successfully.',
            data: result.files,
            pagination: {
                currentPage: result.currentPage,
                totalPages: result.totalPages,
                totalItems: result.totalFiles,
                limit: parseInt(queryParams.limit, 10) || 10
            }
        });
    } catch (error) {
        console.error('[FILE_CONTROLLER] Admin error listing files:', error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error retrieving files.' });
    }
};

const adminDeleteFile = async (req, res, next) => {
    try {
        const { fileId } = req.params;
        console.log(`[FILE_CONTROLLER] Admin attempting to DELETE file ID: ${fileId}`);
        const result = await fileService.deleteFileByIdAdmin(fileId);
        
        res.status(200).json(result);
    } catch (error) {
        console.error(`[FILE_CONTROLLER] Admin error deleting file ${req.params.fileId}:`, error);
        const statusCode = error.status || 500;
        res.status(statusCode).json({ success: false, message: error.message || 'Internal server error deleting file.' });
    }
};

module.exports = {
    uploadFile,
    getFileMeta,
    downloadFileController, 
    adminListAllFiles,
    adminDeleteFile,
};