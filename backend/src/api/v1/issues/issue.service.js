const mongoose = require('mongoose');
const IssueReport = require('./issueReport.model.js');
const Task = require('../tasks/task.model.js');
const User = require('../users/user.model.js');


const createIssueReport = async (taskId, reportedByUserId, description) => {
    if (!mongoose.Types.ObjectId.isValid(taskId) || !mongoose.Types.ObjectId.isValid(reportedByUserId)) {
        throw new Error('Invalid Task ID or User ID format.');
    }
    if (!description || description.trim() === '') {
        throw new Error('Issue description is required.');
    }

    const task = await Task.findById(taskId);
    if (!task) {
        throw new Error('Task not found.');
    }

    const issueReport = await IssueReport.create({
        taskId: task._id,
        workflowInstanceId: task.workflowInstanceId,
        nodeId: task.nodeId,
        reportedBy: reportedByUserId,
        description: description,
        status: 'Open',
    });

    task.status = 'IssueReported';
    task.hasOpenIssue = true;
    await task.save();

    console.log(`[ISSUE_SERVICE] New issue ${issueReport._id} reported for task ${taskId} by user ${reportedByUserId}. Task status updated to IssueReported.`);

    return issueReport;
};

const listIssuesForManager = async (filters = {}, managerUser, options = {}) => {
    try {
        const query = {};

        if (managerUser.role !== 'admin' && managerUser.role !== 'manager') {
             throw new Error('User does not have sufficient permissions to list all issues.');
        }
        
        if (filters.status) {
            const statuses = filters.status.split(',').map(s => s.trim());
            query.status = { $in: statuses };
        }
        if (filters.reportedByUserId && mongoose.Types.ObjectId.isValid(filters.reportedByUserId)) {
            query.reportedBy = filters.reportedByUserId;
        }
        if (filters.taskId && mongoose.Types.ObjectId.isValid(filters.taskId)) {
            query.taskId = filters.taskId;
        }
        if (filters.workflowInstanceId && mongoose.Types.ObjectId.isValid(filters.workflowInstanceId)) {
            query.workflowInstanceId = filters.workflowInstanceId;
        }

        const page = parseInt(options.page, 10) || 1;
        const limit = parseInt(options.limit, 10) || 10;
        const skip = (page - 1) * limit;
        let sort = {};
        if (options.sortBy) {
            sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
        } else {
            sort.createdAt = -1;
        }

        console.log('[ISSUE_SERVICE] Listing issues for manager with query:', JSON.stringify(query));
        const issues = await IssueReport.find(query)
            .populate('taskId', 'title status nodeId')
            .populate('workflowInstanceId', 'status workflowDefinitionId')
            .populate({ 
                path: 'workflowInstanceId', 
                populate: { path: 'workflowDefinitionId', select: 'name' }
            })
            .populate('reportedBy', 'name email role')
            .populate('resolvedBy', 'name email')
            .populate('managerComments.commentedBy', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();
        
        const totalIssues = await IssueReport.countDocuments(query);

        return {
            issues,
            currentPage: page,
            totalPages: Math.ceil(totalIssues / limit),
            totalIssues,
        };
    } catch (error) {
        console.error(`[ISSUE_SERVICE] Error listing issues for manager ${managerUser.id}:`, error);
        throw new Error('Failed to retrieve issues.');
    }
};


const getIssueByIdForManager = async (issueId, managerUser) => {
    if (!mongoose.Types.ObjectId.isValid(issueId)) return null;

    try {
        const issue = await IssueReport.findById(issueId)
            .populate('taskId')
            .populate({
                path: 'taskId',
                populate: { path: 'assignedUserId assignedRoleName' }
            })
            .populate('workflowInstanceId', 'status context workflowDefinitionId')
            .populate({ 
                path: 'workflowInstanceId', 
                populate: { path: 'workflowDefinitionId', select: 'name' }
            })
            .populate('reportedBy', 'name email role')
            .populate('resolvedBy', 'name email')
            .populate('managerComments.commentedBy', 'name email')
            .lean();

        if (!issue) return null;

        if (managerUser.role !== 'admin' && managerUser.role !== 'manager') {
            return { unauthorized: true };
        }

        return issue;
    } catch (error) {
        console.error(`[ISSUE_SERVICE] Error retrieving issue ${issueId}:`, error);
        throw new Error('Failed to retrieve issue report.');
    }
};


const addManagerCommentToIssue = async (issueId, managerId, commentText) => {
    if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(managerId)) {
        throw new Error('Invalid Issue ID or Manager ID format.');
    }
    if (!commentText || commentText.trim() === '') {
        throw new Error('Comment text is required.');
    }

    const issue = await IssueReport.findById(issueId);
    if (!issue) throw new Error('Issue report not found.');

    if (issue.status === 'Open') {
        issue.status = 'Under Review';
    }

    issue.managerComments.push({
        comment: commentText,
        commentedBy: managerId,
        commentedAt: new Date(),
    });

    await issue.save();
    console.log(`[ISSUE_SERVICE] Manager comment added to issue ${issueId} by user ${managerId}`);
    return issue.populate('managerComments.commentedBy', 'name email');
};


const updateIssueStatus = async (issueId, managerId, newStatus, resolutionDetails = '') => {
    if (!mongoose.Types.ObjectId.isValid(issueId) || !mongoose.Types.ObjectId.isValid(managerId)) {
        throw new Error('Invalid Issue ID or Manager ID format.');
    }

    const issue = await IssueReport.findById(issueId);
    if (!issue) throw new Error('Issue report not found.');

    const oldStatus = issue.status;
    issue.status = newStatus;

    if (newStatus === 'Resolved') {
        issue.resolutionDetails = resolutionDetails || 'Issue marked as resolved.';
        issue.resolvedBy = managerId;
        issue.resolvedAt = new Date();
        
        const task = await Task.findById(issue.taskId);
        if (task) {
            task.hasOpenIssue = false;
            if (task.status === 'IssueReported') {
                task.status = 'Pending';
            }
            await task.save();
            console.log(`[ISSUE_SERVICE] Task ${task._id} status updated due to issue ${issueId} resolution.`);
        }
    } else if (oldStatus === 'Resolved' && newStatus !== 'Resolved') {
        issue.resolvedBy = undefined;
        issue.resolvedAt = undefined;
        issue.resolutionDetails = undefined;
        const task = await Task.findById(issue.taskId);
        if (task) {
            task.hasOpenIssue = true;
            task.status = 'IssueReported';
            await task.save();
        }
    }
    
    issue.managerComments.push({
        comment: `Status changed to ${newStatus}.${resolutionDetails ? ' Resolution: ' + resolutionDetails : ''}`,
        commentedBy: managerId,
        commentedAt: new Date(),
    });


    await issue.save();
    console.log(`[ISSUE_SERVICE] Issue ${issueId} status updated to ${newStatus} by manager ${managerId}`);
    return issue.populate('managerComments.commentedBy resolvedBy', 'name email');
};


module.exports = {
    createIssueReport,
    listIssuesForManager,
    getIssueByIdForManager,
    addManagerCommentToIssue,
    updateIssueStatus,
};