const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { USER_ROLES } = require('../users/user.model.js');

const TASK_STATUS = [
    'Pending',
    'In Progress',
    'Completed',
    'Rejected',
    'Needs Rework',
    'Escalated',
    'Cancelled',
    'IssueReported'
];

const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent']; 

const taskSchema = new Schema({
    workflowInstanceId: {
        type: Schema.Types.ObjectId,
        ref: 'WorkflowInstance',
        required: true,
    },
    workflowDefinitionId: {
        type: Schema.Types.ObjectId,
        ref: 'Workflow',
        required: true,
    },
    nodeId: {
        type: String,
        required: true,
    },
    nodeType: {
        type: String,
        required: true,
    },
    taskType: {
        type: String,
        enum: ['GenericTask', 'ApprovalTask', 'FileUploadPrompt', 'FileReviewTask'],
        default: 'GenericTask',
    },
    taskData: {
        type: mongoose.Schema.Types.Mixed,
    },
    approvalDecision: {
        type: String,
        enum: ['Approved', 'Rejected', 'ChangesRequested'],
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    status: {
        type: String,
        required: true,
        enum: TASK_STATUS,
        default: 'Pending',
    },
    assignedToType: {
        type: String,
        enum: ['User', 'Role'],
        required: true,
    },
    assignedUserId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        sparse: true,
    },
        assignedRoleName: {
        type: String,
        index: true,
        sparse: true,
    },
    actionedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    actionedAt: {
        type: Date,
    },
    comments: {
        type: String,
    },
    submittedFiles: [{
        type: Schema.Types.ObjectId,
        ref: 'File',
    }],
    hasOpenIssue: {
        type: Boolean,
        default: false,
        index: true,
    },
    dueDate: {
        type: Date,
        index: true,
    },
    priority: {
        type: String,
        enum: TASK_PRIORITIES,
        default: 'Medium',
        index: true,
    },

}, {
    timestamps: true,
});


taskSchema.index({ assignedUserId: 1, status: 1 });
taskSchema.index({ assignedRoleName: 1, status: 1 });
taskSchema.index({ workflowInstanceId: 1 });
taskSchema.index({ status: 1, priority: 1 });
taskSchema.index({ dueDate: 1, status: 1 });

taskSchema.path('assignedUserId').validate(function(value) {
    if (this.assignedToType === 'User' && !value) {
        this.invalidate('assignedUserId', 'assignedUserId is required when assignedToType is User.', value);
        return false;
    }
    if (this.assignedToType === 'Role' && value) {
    }
    return true;
});

taskSchema.path('assignedRoleName').validate(function(value) {
    if (this.assignedToType === 'Role') {
        if (!value || value.trim() === '') {
            this.invalidate('assignedRoleName', 'assignedRoleName is required when assignedToType is Role.', value);
            return false;
        }
        if (!USER_ROLES.includes(value)) {
            const validRolesString = USER_ROLES.join(', ');
            this.invalidate('assignedRoleName', `Invalid role '${value}'. Must be one of: ${validRolesString}`, value);
            return false;
        }
    } else if (this.assignedToType === 'User') {
    }
    return true;
});


const Task = mongoose.model('Task', taskSchema);

module.exports = Task;