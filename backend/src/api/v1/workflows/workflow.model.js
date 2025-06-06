
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NODE_TYPES = [
    'Task', 'Decision', 'Approval', 'AutomatedTask',
    'FileUpload', 'SubWorkflow', 'Start', 'End', 'Notification', 'ParallelSplit', 'ParallelJoin', 'Timer'
];

const nodeSchema = new Schema({
    id: { type: String, required: true },
    type: { type: String, required: true },
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
    },
    data: {
        label: { type: String, required: true },
        type: {
            type: String,
            required: true,
            enum: NODE_TYPES
        },
        description: { type: String },
        reactFlowType: { type: String },
        config: { type: Schema.Types.Mixed, default: {} },
        fileAttachmentId: { type: Schema.Types.ObjectId, ref: 'File' }
    },
    width: { type: Number },
    height: { type: Number },
}, { _id: false });

const edgeSchema = new Schema({
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
    type: { type: String },
    label: { type: String },
    animated: { type: Boolean },
    data: {
        conditionType: { type: String },
        conditionExpression: { type: String }
    },
}, { _id: false });

const expectedContextFieldSchema = new Schema({
    key: { type: String, required: [true, 'Context field key is required.'] , trim: true },
    label: { type: String, required: [true, 'Context field label is required.'], trim: true },
    defaultValue: { type: String, trim: true, default: '' },
}, { _id: false });


const workflowSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Workflow name is required.'],
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  flow: {
      nodes: {
          type: [nodeSchema],
          default: [],
          validate: [val => val.length > 0, 'Workflow must have at least one node.']
      },
      edges: {
          type: [edgeSchema],
          default: []
      },
  },

    status: {
      type: String,
      enum: ['Draft', 'Active', 'Archived'],
      default: 'Draft',
      index: true,
  },
    version: {
        type: Number,
        default: 1,
        required: true,
    },
    originalDefinitionId: {
        type: Schema.Types.ObjectId,
        ref: 'Workflow',
        index: true,
    },
    isLatestVersion: {
        type: Boolean,
        default: true,
        index: true,
    },
    expectedContextFields: {
        type: [expectedContextFieldSchema],
        default: []
    },

}, {
  timestamps: true,
});
workflowSchema.pre('save', function(next) {
    if (this.isNew && !this.originalDefinitionId) {
        this.originalDefinitionId = this._id;
    }
    next();
});

workflowSchema.index({ originalDefinitionId: 1, isLatestVersion: 1 });
workflowSchema.index({ name: 1, isLatestVersion: 1 });

const Workflow = mongoose.model('Workflow', workflowSchema);

module.exports = Workflow;