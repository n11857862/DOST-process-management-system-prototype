
const mongoose = require('mongoose');
const { WorkflowInstance } = require('../instances/workflowInstance.model');
const Task = require('../tasks/task.model');
const Workflow = require('../workflows/workflow.model');

const getOverviewStats = async (userId) => {
    if (!userId) {
        throw new Error('User ID is required to fetch dashboard stats.');
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const myTotalInstancesStarted = await WorkflowInstance.countDocuments({
            startedBy: userObjectId
        });

        const myActiveInstances = await WorkflowInstance.countDocuments({
            startedBy: userObjectId,
            status: { $in: ['Running', 'Suspended', 'Paused', 'Not Started'] }
        });

        const myCompletedInstancesToday = await WorkflowInstance.countDocuments({
            startedBy: userObjectId,
            status: 'Completed',
            updatedAt: { $gte: twentyFourHoursAgo }
        });

        const myFailedInstancesToday = await WorkflowInstance.countDocuments({
            startedBy: userObjectId,
            status: 'Failed',
            updatedAt: { $gte: twentyFourHoursAgo }
        });

        const myPendingTasks = await Task.countDocuments({
            assignedToType: 'User',
            assignedUserId: userObjectId,
            status: { $in: ['Pending', 'In Progress', 'Needs Rework'] }
        });

        return {
            myTotalInstancesStarted,
            myActiveInstances,
            myCompletedInstancesToday,
            myFailedInstancesToday,
            myPendingTasks
        };
    } catch (error) {
        console.error(`Error fetching overview stats for user ${userId}:`, error);
        throw new Error('Could not retrieve overview statistics.');
    }
};

const getRecentActivities = async (userId, limit = 5) => {
    if (!userId) {
        throw new Error('User ID is required to fetch recent activities.');
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);

    try {
        const myRecentInstancesStarted = await WorkflowInstance.find({
            startedBy: userObjectId
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({
            path: 'workflowDefinitionId',
            select: 'name'
        })
        .select('status createdAt workflowDefinitionId')
        .lean();

        const myRecentTasksCompleted = await Task.find({
            actionedBy: userObjectId,
            status: 'Completed'
        })
        .sort({ actionedAt: -1 })
        .limit(limit)
        .populate({
            path: 'workflowDefinitionId',
            select: 'name'
        })
        .select('title status actionedAt workflowDefinitionId')
        .lean();

        const formattedInstances = myRecentInstancesStarted.map(inst => ({
            instanceId: inst._id,
            workflowName: inst.workflowDefinitionId?.name || 'N/A',
            status: inst.status,
            startedAt: inst.createdAt
        }));

        const formattedTasks = myRecentTasksCompleted.map(task => ({
            taskId: task._id,
            taskTitle: task.title,
            status: task.status,
            completedAt: task.actionedAt,
            workflowName: task.workflowDefinitionId?.name || 'N/A'
        }));

        return {
            myRecentInstancesStarted: formattedInstances,
            myRecentTasksCompleted: formattedTasks
        };
    } catch (error) {
        console.error(`Error fetching recent activities for user ${userId}:`, error);
        throw new Error('Could not retrieve recent activities.');
    }
};

module.exports = {
    getOverviewStats,
    getRecentActivities
};