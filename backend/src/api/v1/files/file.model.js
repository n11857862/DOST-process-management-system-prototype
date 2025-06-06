
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
    filename: {
        type: String,
        required: true,
        trim: true,
    },
    mimetype: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    storageType: {
        type: String,
        required: true,
        enum: ['local', 's3', 'gcs', 'other'],
        default: 'local',
    },
    storagePath: {
        type: String,
        required: true,
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
       isLinked: {
        type: Boolean,
        default: false,
        index: true
    },
    linkedContext: {
        type: String,
        required: false
    },
    taskIdContext: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
        required: false,
        index: true,
        sparse: true
    }

}, {
    timestamps: true,
});

fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ filename: 1 });

const File = mongoose.model('File', fileSchema);

module.exports = File;
