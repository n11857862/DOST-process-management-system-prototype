const issueService = require('./issue.service.js');

const reportTaskIssue = async (req, res, next) => {
    try {
        const { taskId, description } = req.body;
        const reportedByUserId = req.user.id;

        if (!description) {
            return res.status(400).json({ success: false, message: 'Issue description is required.' });
        }

        console.log(`[ISSUE_CONTROLLER] User ${reportedByUserId} reporting issue for task ${taskId}`);
        const issueReport = await issueService.createIssueReport(taskId, reportedByUserId, description);

        res.status(201).json({
            success: true,
            message: 'Issue reported successfully.',
            data: issueReport,
        });
    } catch (error) {
        console.error(`[ISSUE_CONTROLLER] Error reporting issue for task ${req.body.taskId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const listIssues = async (req, res, next) => {
    try {
        const managerUser = req.user;
        const { status, reportedByUserId, taskId, workflowInstanceId, page, limit, sortBy, sortOrder } = req.query;
        const filters = { status, reportedByUserId, taskId, workflowInstanceId };
        Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
        const options = { page, limit, sortBy, sortOrder };
        Object.keys(options).forEach(key => options[key] === undefined && delete options[key]);

        console.log(`[ISSUE_CONTROLLER] Manager ${managerUser.id} listing issues with filters:`, filters);
        const result = await issueService.listIssuesForManager(filters, managerUser, options);
        
        res.status(200).json({
            success: true,
            count: result.issues.length,
            totalIssues: result.totalIssues,
            totalPages: result.totalPages,
            currentPage: result.currentPage,
            data: result.issues,
        });
    } catch (error) {
        console.error('[ISSUE_CONTROLLER] Error listing issues:', error.message);
        next(error);
    }
};


const getIssueDetails = async (req, res, next) => {
    try {
        const { issueId } = req.params;
        const managerUser = req.user;
        console.log(`[ISSUE_CONTROLLER] Manager ${managerUser.id} requesting details for issue ${issueId}`);
        const issue = await issueService.getIssueByIdForManager(issueId, managerUser);

        if (!issue) return res.status(404).json({ success: false, message: 'Issue report not found.' });
        if (issue.unauthorized) return res.status(403).json({ success: false, message: 'Not authorized to view this issue report.' });
        
        res.status(200).json({ success: true, data: issue });
    } catch (error) {
        console.error(`[ISSUE_CONTROLLER] Error getting issue details for ${req.params.issueId}:`, error.message);
        next(error);
    }
};


const addManagerComment = async (req, res, next) => {
    try {
        const { issueId } = req.params;
        const { comment } = req.body;
        const managerId = req.user.id;

        if (!comment) return res.status(400).json({ success: false, message: 'Comment text is required.' });
        
        console.log(`[ISSUE_CONTROLLER] Manager ${managerId} adding comment to issue ${issueId}`);
        const updatedIssue = await issueService.addManagerCommentToIssue(issueId, managerId, comment);
        res.status(200).json({ success: true, message: 'Comment added.', data: updatedIssue });
    } catch (error) {
        console.error(`[ISSUE_CONTROLLER] Error adding manager comment to issue ${req.params.issueId}:`, error.message);
        if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};


const updateIssueStatusAction = async (req, res, next) => {
    try {
        const { issueId } = req.params;
        const { status, resolutionDetails } = req.body;
        const managerId = req.user.id;

        if (!status) return res.status(400).json({ success: false, message: 'New status is required.' });
        
        console.log(`[ISSUE_CONTROLLER] Manager ${managerId} updating status of issue ${issueId} to ${status}`);
        const updatedIssue = await issueService.updateIssueStatus(issueId, managerId, status, resolutionDetails);
        res.status(200).json({ success: true, message: `Issue status updated to ${status}.`, data: updatedIssue });
    } catch (error) {
        console.error(`[ISSUE_CONTROLLER] Error updating status for issue ${req.params.issueId}:`, error.message);
         if (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('required')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};


module.exports = {
    reportTaskIssue,
    listIssues,
    getIssueDetails,
    addManagerComment,
    updateIssueStatusAction,
};