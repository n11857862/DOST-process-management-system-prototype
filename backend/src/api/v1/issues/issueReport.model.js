const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ISSUE_STATUSES = ['Open', 'Under Review', 'Pending Information', 'Resolved', 'Escalated'];

const issueReportSchema = new Schema({
    taskId: {
        type: Schema.Types.ObjectId,
        ref: 'Task',
        required: true,
        index: true,
    },
    workflowInstanceId: {
        type: Schema.Types.ObjectId,
        ref: 'WorkflowInstance',
        required: true,
        index: true,
    },
    nodeId: {
        type: String,
        required: true,
    },
    reportedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    description: {
        type: String,
        required: [true, 'Issue description is required.'],
        trim: true,
    },
    status: {
        type: String,
        enum: ISSUE_STATUSES,
        default: 'Open',
        required: true,
        index: true,
    },
    managerComments: [{
        _id: false,
        comment: { type: String, required: true },
        commentedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        commentedAt: { type: Date, default: Date.now },
    }],
    resolutionDetails: {
        type: String,
    },
    resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    resolvedAt: {
        type: Date,
    },
}, {
    timestamps: true,
});

issueReportSchema.index({ reportedBy: 1, status: 1 });
issueReportSchema.index({ status: 1, createdAt: -1 });

const IssueReport = mongoose.model('IssueReport', issueReportSchema);

module.exports = IssueReport;