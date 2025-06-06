const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mongoosePaginate = require('mongoose-paginate-v2');


const INSTANCE_STATUS = [
    'Not Started', 'Running', 'Suspended', 
    'AwaitingFileUpload',
    'WaitingForTimer',
    'WaitingForSubWorkflow',
    'Completed', 'Failed', 'Terminated'
];

const workflowInstanceSchema = new Schema({
    workflowDefinitionId: {
        type: Schema.Types.ObjectId,
        ref: 'Workflow',
        required: true,
        index: true,
    },
    status: {
        type: String,
        required: true,
        enum: INSTANCE_STATUS,
        default: 'Not Started',
    },
    startedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    startedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
    currentState: {
        activeNodeIds: [{ type: String }],
    },
    parentInstanceId: {
        type: Schema.Types.ObjectId,
        ref: 'WorkflowInstance',
        index: true,
        optional: true,
    },
    parentNodeIdInParent: {
        type: String,
        optional: true,
    },
    pendingSubWorkflows: [{
        _id: false,
        nodeId: { type: String, required: true },
        subInstanceId: { type: Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true }
    }],
    executionHistory: [{
        _id: false,
        nodeId: { type: String, index: true },
        nodeLabel: { type: String },
        nodeType: { type: String },
        eventType: { type: String, required: true, index: true },
        timestamp: { type: Date, default: Date.now, required: true },
        statusAtEvent: { type: String },
        message: { type: String },
        details: { type: Schema.Types.Mixed }
    }],
    context: {
        type: Schema.Types.Mixed,
        default: {},
    },
    pendingActionDetails: {
        nodeId: { type: String },
        nodeType: { type: String },
        message: { type: String },
        configSnapshot: { type: Schema.Types.Mixed }
    },
    errorInfo: {
        message: { type: String },
        nodeId: { type: String },
        timestamp: { type: Date },
        details: { type: Schema.Types.Mixed }
    },
    terminationInfo: {
        reason: { type: String },
        terminatedBy: { 
            type: Schema.Types.ObjectId, 
            ref: 'User'
        },
        terminatedAt: { type: Date },
        previousStatus: { type: String }
    }, 
    joinStates: {
        type: Map,
        of: new Schema({
            _id: false,
            arrivedEdgeIds: {
                type: [String],
                default: []
            }
        }, { _id: false }),
        default: {}
    },
    timerResumeDetails: {

        resumeAt: { type: Date },
        edgeToFollowId: { type: String, required: false },
        nextNodeAfterTimer: { type: String },
        timerNodeId: { type: String }
    }     

}, {
    timestamps: true,
});

workflowInstanceSchema.plugin(mongoosePaginate);
workflowInstanceSchema.index({ status: 1 });
workflowInstanceSchema.index({ workflowDefinitionId: 1, status: 1 });
workflowInstanceSchema.index({ "timerResumeDetails.resumeAt": 1, status: 1 });

const WorkflowInstance = mongoose.model('WorkflowInstance', workflowInstanceSchema);

module.exports = {
    WorkflowInstance,
    INSTANCE_STATUS 
};