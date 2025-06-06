const mongoose = require('mongoose');
const File = require('./file.model.js');
const path = require('path');
const fs = require('fs');
const { User } = require('../users/user.model');

const UPLOAD_DIR_ABSOLUTE = path.resolve(process.env.FILE_UPLOAD_PATH || process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
console.log('[FILE_SERVICE_INIT] UPLOAD_DIR_ABSOLUTE (module scope):', UPLOAD_DIR_ABSOLUTE);



const createFileRecord = async (fileData, userId, storageType = 'local') => {
    if (!fileData) {
        throw new Error('File data is required.');
    }
    if (!userId) {
        throw new Error('User ID is required for uploading a file.');
    }

    

    const newFile = new File({
        filename: fileData.originalname,
        mimetype: fileData.mimetype,
        size: fileData.size,
        storageType: storageType,
        storagePath: fileData.filename,
        uploadedBy: userId,
        isLinked: false, 
    });

    try {
        const savedFile = await newFile.save();
        console.log(`[FILE_SERVICE] File record created: ${savedFile._id} for original file ${savedFile.filename}`);
        return savedFile;
    } catch (error) {
        console.error('Error creating file record in service:', error);
        throw error;
    }
};

const listAllFilesForAdmin = async (queryParams = {}) => {
    const page = parseInt(queryParams.page, 10) || 1;
    const limit = parseInt(queryParams.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const query = {};
    if (queryParams.filename) {
        query.filename = { $regex: queryParams.filename, $options: 'i' };
    }
    if (queryParams.mimetype) {
        query.mimetype = { $regex: queryParams.mimetype, $options: 'i' };
    }
    if (queryParams.uploadedBy && mongoose.Types.ObjectId.isValid(queryParams.uploadedBy)) {
        query.uploadedBy = queryParams.uploadedBy;
    }

    let sort = { createdAt: -1 };
    if (queryParams.sortBy && queryParams.sortOrder) {
        sort = { [queryParams.sortBy]: queryParams.sortOrder === 'desc' ? -1 : 1 };
    }
    
    try {
        const files = await File.find(query)
            .populate('uploadedBy', 'username name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalFiles = await File.countDocuments(query);

        return {
            files,
            currentPage: page,
            totalPages: Math.ceil(totalFiles / limit),
            totalFiles,
        };
    } catch (error) {
        console.error('[FILE_SERVICE] Error listing all files for admin:', error);
        throw new Error('Failed to retrieve files.');
    }
};

const deleteFileByIdAdmin = async (fileId) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
        const err = new Error('Invalid File ID format.');
        err.status = 400;
        throw err;
    }

    try {
        const fileRecord = await File.findById(fileId);
        if (!fileRecord) {
            const err = new Error('File record not found.');
            err.status = 404;
            throw err;
        }

        if (fileRecord.storageType === 'local' && fileRecord.storagePath) {
            const physicalPath = path.join(UPLOAD_DIR_ABSOLUTE, fileRecord.storagePath);
            try {
                await fs.access(physicalPath);
                await fs.unlink(physicalPath);
                console.log(`[FILE_SERVICE] Physically deleted local file: ${physicalPath}`);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.warn(`[FILE_SERVICE] Physical file not found for deletion, but proceeding to delete DB record: ${physicalPath}`);
                } else {
                    console.error(`[FILE_SERVICE] Error deleting physical file ${physicalPath}:`, error);
                }
            }
        }

        await File.findByIdAndDelete(fileId);
        console.log(`[FILE_SERVICE] Deleted file record from DB: ${fileId}`);
        
        return { success: true, message: `File '${fileRecord.filename}' (ID: ${fileId}) deleted successfully.` };
    } catch (error) {
        console.error(`[FILE_SERVICE] Error deleting file ${fileId}:`, error);
        if (!error.status) {
            throw new Error('Failed to delete file.');
        }
        throw error;
    }
};




const getFileRecordById = async (fileId) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return null;
    }
    return await File.findById(fileId).populate('uploadedBy', 'name email');
};


const prepareFileForDownload = async (fileId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
        throw new Error('Invalid file ID format.');
    }

    const fileRecord = await File.findById(fileId).lean();

    if (!fileRecord) {
        throw new Error('File record not found.');
    }
    
    console.log('[FILE_SERVICE] prepareFileForDownload - START');
    console.log('[FILE_SERVICE]   - Using UPLOAD_DIR_ABSOLUTE:', UPLOAD_DIR_ABSOLUTE);
    console.log('[FILE_SERVICE]   - fileRecord.storagePath (from DB):', `"${fileRecord.storagePath}"`);

    if (typeof UPLOAD_DIR_ABSOLUTE !== 'string' || typeof fileRecord.storagePath !== 'string') {
        console.error('[FILE_SERVICE CRITICAL] UPLOAD_DIR_ABSOLUTE or storagePath is not a string!');
        throw new Error('Path construction component error: base directory or storage path is invalid.');
    }
    
    const absolutePath = path.join(UPLOAD_DIR_ABSOLUTE, fileRecord.storagePath);
    console.log('[FILE_SERVICE]   - Constructed absolutePath for download:', `"${absolutePath}"`);
    
    if (!absolutePath.startsWith(UPLOAD_DIR_ABSOLUTE)) {
        console.error(`[FILE_SERVICE] SECURITY ALERT: Constructed path "${absolutePath}" is outside of base upload directory "${UPLOAD_DIR_ABSOLUTE}". fileRecord.storagePath was: "${fileRecord.storagePath}"`);
        throw new Error('Invalid file path generated (security check failed).');
    }
    
    console.log(`[FILE_SERVICE] Preparing file for download. Original DB filename: ${fileRecord.filename}, Physical path: ${absolutePath}`);

    return {
        absolutePath: absolutePath,
        originalFilename: fileRecord.filename,
        mimetype: fileRecord.mimetype,
    };
};

module.exports = {
    createFileRecord,
    getFileRecordById,
    prepareFileForDownload,
    listAllFilesForAdmin,
    deleteFileByIdAdmin, 
};