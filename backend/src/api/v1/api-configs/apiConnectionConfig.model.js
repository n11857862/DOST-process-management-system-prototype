const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const API_CONFIG_STATUSES = ['PendingApproval', 'Approved', 'Rejected', 'Archived'];

const apiConnectionConfigSchema = new Schema({
    name: {
        type: String,
        required: [true, 'API configuration name is required.'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    apiUrl: {
        type: String,
        required: [true, 'API URL is required.'],
        trim: true,
    },
    apiMethod: {
        type: String,
        required: [true, 'API method (GET, POST, etc.) is required.'],
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        uppercase: true,
    },
    headersTemplate: {
        type: Schema.Types.Mixed,
        default: {},
    },
    isShared: {
        type: Boolean,
        default: false,
    },
    allowedUsers: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
    }],
    usedByWorkflows: [{
        workflowId: {
            type: Schema.Types.ObjectId,
            ref: 'WorkflowDefinition',
        },
        nodeId: String,
        addedAt: {
            type: Date,
            default: Date.now,
        }
    }],
    status: {
        type: String,
        enum: API_CONFIG_STATUSES,
        default: 'PendingApproval',
        required: true,
        index: true,
    },
    requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    adminNotes: {
        type: String,
    },
    approvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    approvedAt: {
        type: Date,
    },
    rejectedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    rejectedAt: {
        type: Date,
    },
    usageCount: {
        type: Number,
        default: 0,
    },
    lastUsedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

apiConnectionConfigSchema.index({ status: 1, createdAt: -1 });
apiConnectionConfigSchema.index({ requestedBy: 1, status: 1 });
apiConnectionConfigSchema.index({ isShared: 1, status: 1 });
apiConnectionConfigSchema.index({ apiUrl: 1, apiMethod: 1, status: 1 });
apiConnectionConfigSchema.index({ 'usedByWorkflows.workflowId': 1 });

apiConnectionConfigSchema.methods.canUserAccess = function(userId) {
    if (this.requestedBy && this.requestedBy.toString() === userId.toString()) {
        return true;
    }
    
    if (this.isShared && this.status === 'Approved') {
        return true;
    }
    
    if (this.allowedUsers && this.allowedUsers.some(allowedUserId => allowedUserId.toString() === userId.toString())) {
        return true;
    }
    
    return false;
};

apiConnectionConfigSchema.methods.addWorkflowUsage = function(workflowId, nodeId) {
    const existingUsage = this.usedByWorkflows.find(usage => 
        usage.workflowId.toString() === workflowId.toString() && usage.nodeId === nodeId
    );
    
    if (!existingUsage) {
        this.usedByWorkflows.push({
            workflowId,
            nodeId,
            addedAt: new Date()
        });
        this.usageCount += 1;
        this.lastUsedAt = new Date();
    }
};

const ApiConnectionConfig = mongoose.model('ApiConnectionConfig', apiConnectionConfigSchema);

module.exports = {
    ApiConnectionConfig,
    API_CONFIG_STATUSES
};