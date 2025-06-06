const File = require('../api/v1/files/file.model');
const fs = require('fs').promises;
const path = require('path');

const UPLOADS_BASE_DIR = path.resolve(process.env.FILE_UPLOAD_PATH || process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

const cleanupOrphanedFiles = async () => {
    console.log('[FILE_CLEANUP] Starting orphaned file cleanup job...');
    const cutoffDate = new Date(Date.now() - 48 * 60 * 60 * 1000);

    try {
        const orphanedFileRecords = await File.find({
            isLinked: false,
            createdAt: { $lte: cutoffDate }
        }).lean();

        if (orphanedFileRecords.length === 0) {
            console.log('[FILE_CLEANUP] No orphaned files found to clean up.');
            return;
        }

        console.log(`[FILE_CLEANUP] Found ${orphanedFileRecords.length} orphaned file records to process.`);

        for (const record of orphanedFileRecords) {
            console.log(`[FILE_CLEANUP] Processing orphaned file record: ${record._id}, Name: ${record.filename}, Path: ${record.storagePath}`);
            try {
                if (record.storageType === 'local' && record.storagePath) {
                    const physicalPath = path.join(UPLOADS_BASE_DIR, record.storagePath);
                    try {
                        await fs.unlink(physicalPath);
                        console.log(`[FILE_CLEANUP] Successfully deleted physical file: ${physicalPath}`);
                    } catch (fileError) {
                        if (fileError.code === 'ENOENT') {
                            console.warn(`[FILE_CLEANUP] Physical file not found, but proceeding to delete DB record: ${physicalPath}`);
                        } else {
                            console.error(`[FILE_CLEANUP] Error deleting physical file ${physicalPath}:`, fileError);
                        }
                    }
                }

                await File.findByIdAndDelete(record._id);
                console.log(`[FILE_CLEANUP] Successfully deleted orphaned file DB record: ${record._id}`);
            } catch (singleError) {
                console.error(`[FILE_CLEANUP] Error processing orphaned file ${record._id}:`, singleError);
            }
        }
        console.log('[FILE_CLEANUP] Orphaned file cleanup job finished.');
    } catch (error) {
        console.error('[FILE_CLEANUP] Critical error during cleanup job:', error);
    }
};

module.exports = { cleanupOrphanedFiles };

