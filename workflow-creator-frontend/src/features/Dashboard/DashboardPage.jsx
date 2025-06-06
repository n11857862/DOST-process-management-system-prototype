import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    LayoutDashboard, FileText, Edit3, PlusCircle, AlertTriangle, Loader2, Play,
    Clock, AlertOctagon, Activity, Settings, Download, Edit, CheckCircle2,
    ListChecks, Eye, RefreshCw, User, Users, MessageSquare, ThumbsUp, ThumbsDown, DownloadCloud,
    UploadCloud, XCircle, Megaphone, ExternalLink, ArrowRight, TrendingUp, Calendar
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import workflowService from '../../lib/workflowService';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { TaskActionModal } from '../../components/TaskActionModal'; 

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (includeTime) {
            return date.toLocaleString();
        }
        return date.toLocaleDateString();
    } catch {
        return 'Invalid Date';
    }
};

const getTaskStatusColor = (status) => {
    switch (status) {
        case 'Active': return 'bg-green-100 text-green-800';
        case 'Draft': return 'bg-yellow-100 text-yellow-800';
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Needs Rework': return 'bg-orange-100 text-orange-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Rejected': case 'Cancelled': case 'Failed': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const formatRelativeTime = (dateInput) => {
    if (!dateInput) return 'N/A';
    const date = new Date(dateInput);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} sec ago`;
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

const getPriorityColor = (priority) => {
    switch (priority) {
        case 'Urgent': return 'bg-pink-100 text-pink-800';
        case 'High': return 'bg-red-100 text-red-800';
        case 'Medium': return 'bg-yellow-100 text-yellow-800';
        case 'Low': return 'bg-blue-100 text-blue-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getInstanceStatusColor = (status) => {
    switch (status) {
        case 'Running': return 'bg-blue-100 text-blue-800';
        case 'Suspended':
        case 'WaitingForTimer':
        case 'WaitingForSubWorkflow':
        case 'AwaitingFileUpload':
            return 'bg-yellow-100 text-yellow-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Failed':
        case 'Terminated':
            return 'bg-red-100 text-red-800';
        case 'Not Started':
        default: return 'bg-gray-100 text-gray-800';
    }
};


export const DashboardPage = () => {
    const [claimStatus, setClaimStatus] = useState({ taskId: null, loading: false, error: null, success: null });
    const [unclaimStatus, setUnclaimStatus] = useState({ taskId: null, loading: false, error: null, success: null });
    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
    const [taskToReassign, setTaskToReassign] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [reassignFormData, setReassignFormData] = useState({
        assigneeType: 'User',
        selectedUserId: '',
        selectedRoleName: '',
        comment: ''
    });
    const [reassignStatus, setReassignStatus] = useState({ loading: false, error: null, success: null });
    const AVAILABLE_ROLES_FOR_ASSIGN = ['staff', 'manager', 'admin'];

    const { user: currentUser, isLoading: isAuthLoading } = useAuth();
    const [workflows, setWorkflows] = useState([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
    const [workflowsError, setWorkflowsError] = useState(null);

    const [myTasks, setMyTasks] = useState([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState(null);
    const [taskPagination, setTaskPagination] = useState({ currentPage: 1, totalPages: 1, totalTasks: 0, limit: 5 });

    const navigate = useNavigate();

    const [isStartInstanceModalOpen, setIsStartInstanceModalOpen] = useState(false);
    const [selectedWorkflowForInstance, setSelectedWorkflowForInstance] = useState(null);
    const [dynamicContextValues, setDynamicContextValues] = useState({});
    const [rawInitialContext, setRawInitialContext] = useState('{}');
    const [startInstanceStatus, setStartInstanceStatus] = useState({
        loading: false,
        error: null,
        successMessage: null,
    });

    const [dashboardStats, setDashboardStats] = useState(null);
    const [recentActivities, setRecentActivities] = useState(null);
    const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);
    const [combinedActivities, setCombinedActivities] = useState([]);

    const [isTaskActionModalOpen, setIsTaskActionModalOpen] = useState(false);
    const [selectedTaskForAction, setSelectedTaskForAction] = useState(null);
    const [pageActionFeedback, setPageActionFeedback] = useState({ type: '', message: ''});

    const [dashboardRefreshing, setDashboardRefreshing] = useState(false);
    const [autoRefreshing, setAutoRefreshing] = useState(false);
    const [activityFilter, setActivityFilter] = useState('all');

    const [isActivityDetailModalOpen, setIsActivityDetailModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);

    const handleClaimTask = async (taskIdToClaim) => {
        setClaimStatus({ taskId: taskIdToClaim, loading: true, error: null, success: null });
        try {
            const response = await workflowService.claimTask(taskIdToClaim);
            if (response.success) {
                setClaimStatus({ taskId: taskIdToClaim, loading: false, error: null, success: 'Task claimed!' });
                fetchMyTasks(taskPagination.currentPage);
                setTimeout(() => setClaimStatus({ taskId: null, loading: false, error: null, success: null }), 3000);
            } else {
                throw new Error(response.message || 'Failed to claim task.');
            }
        } catch (err) {
            setClaimStatus({
                taskId: taskIdToClaim,
                loading: false,
                error: err.response?.data?.message || err.message || 'Error claiming task.',
                success: null
            });
            setTimeout(() => setClaimStatus({ taskId: null, loading: false, error: null, success: null }), 5000);
        }
    };

    const handleUnclaimTask = async (taskIdToUnclaim) => {
        setUnclaimStatus({ taskId: taskIdToUnclaim, loading: true, error: null, success: null });
        try {
            const response = await workflowService.unclaimTask(taskIdToUnclaim);
            if (response.success) {
                setUnclaimStatus({ taskId: taskIdToUnclaim, loading: false, error: null, success: 'Task unclaimed!' });
                fetchMyTasks(taskPagination.currentPage);
                setTimeout(() => setUnclaimStatus({ taskId: null, loading: false, error: null, success: null }), 3000);
            } else {
                throw new Error(response.message || 'Failed to unclaim task.');
            }
        } catch (err) {
            setUnclaimStatus({
                taskId: taskIdToUnclaim,
                loading: false,
                error: err.response?.data?.message || err.message || 'Error unclaiming task.',
                success: null
            });
            setTimeout(() => setUnclaimStatus(prev => ({ ...prev, taskId: taskIdToUnclaim, error: null })), 5000);
        }
    };

    const fetchAllUsersForSelection = useCallback(async () => {
        if (currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin')) {
            setIsLoadingUsers(true);
            try {
                const response = await workflowService.listAllUsersForAdmin({ limit: 500 });
                if (response.success) {
                    setAllUsers(response.data || []);
                } else {
                    console.error("Failed to fetch users for reassignment:", response.message);
                    setAllUsers([]);
                }
            } catch (err) {
                console.error("Error fetching users for reassignment:", err);
                setAllUsers([]);
            } finally {
                setIsLoadingUsers(false);
            }
        }
    }, [currentUser]);

    useEffect(() => {
        fetchAllUsersForSelection();
    }, [fetchAllUsersForSelection]);

    const openReassignModal = (task) => {
        setTaskToReassign(task);
        setReassignFormData({
            assigneeType: 'User',
            selectedUserId: '',
            selectedRoleName: '',
            comment: ''
        });
        setReassignStatus({ loading: false, error: null, success: null });
        setIsReassignModalOpen(true);
        if (allUsers.length === 0) {
            fetchAllUsersForSelection();
        }
    };

    const closeReassignModal = () => {
        setIsReassignModalOpen(false);
        setTaskToReassign(null);
    };

    const handleReassignFormInputChange = (e) => {
        const { name, value } = e.target;
        setReassignFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleReassignSubmit = async (e) => {
        e.preventDefault();
        if (!taskToReassign) return;

        let newAssignedToId;
        if (reassignFormData.assigneeType === 'User') {
            if (!reassignFormData.selectedUserId) {
                setReassignStatus({ loading: false, error: 'Please select a user.', success: null });
                return;
            }
            newAssignedToId = reassignFormData.selectedUserId;
        } else {
            if (!reassignFormData.selectedRoleName) {
                setReassignStatus({ loading: false, error: 'Please select a role.', success: null });
                return;
            }
            newAssignedToId = reassignFormData.selectedRoleName;
        }

        setReassignStatus({ loading: true, error: null, success: null });
        try {
            const payload = {
                newAssignedToType: reassignFormData.assigneeType,
                newAssignedToId: newAssignedToId,
                reassignComment: reassignFormData.comment
            };
            const response = await workflowService.reassignTask(taskToReassign._id, payload);
            if (response.success) {
                setReassignStatus({ loading: false, error: null, success: 'Task reassigned successfully!' });
                fetchMyTasks(taskPagination.currentPage);
                setTimeout(() => {
                    closeReassignModal();
                }, 1500);
            } else {
                throw new Error(response.message || 'Failed to reassign task');
            }
        } catch (err) {
            setReassignStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'Error reassigning task.',
                success: null
            });
            setTimeout(() => setReassignStatus(prev => ({ ...prev, error: null })), 5000);
        }
    };

    const fetchDashboardData = useCallback(async () => {
        if (!currentUser) {
            setIsLoadingDashboardData(false);
            setDashboardStats(null);
            setRecentActivities(null);
            return;
        }
        setIsLoadingDashboardData(true);
        setDashboardError(null);
        try {
            console.log("[DASHBOARD] Fetching dashboard overview stats and recent activities...");
            const statsPromise = workflowService.getDashboardOverviewStats();
            const activitiesPromise = workflowService.getDashboardRecentActivities(5);

            const [statsResult, activitiesResult] = await Promise.all([
                statsPromise,
                activitiesPromise
            ]);

            setDashboardStats(statsResult);
            setRecentActivities(activitiesResult);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            setDashboardError(error.message || "Could not load dashboard summary.");
            setDashboardStats(null);
            setRecentActivities(null);
        } finally {
            setIsLoadingDashboardData(false);
        }
    }, [currentUser]);

    const fetchWorkflows = useCallback(async () => {
        if (!currentUser || !(currentUser.role === 'manager' || currentUser.role === 'admin')) {
            setIsLoadingWorkflows(false);
            setWorkflows([]);
            return;
        }

        setIsLoadingWorkflows(true);
        setWorkflowsError(null);
        try {
            const fetchedWorkflowsData = await workflowService.listWorkflows({ status: 'Draft,Active' });
            const workflowMap = new Map();
            if (Array.isArray(fetchedWorkflowsData)) {
                fetchedWorkflowsData.forEach(wf => {
                    const existing = workflowMap.get(wf.originalDefinitionId);
                    if (!existing || new Date(wf.createdAt) > new Date(existing.createdAt)) {
                        workflowMap.set(wf.originalDefinitionId || wf._id, wf);
                    }
                });
                setWorkflows(Array.from(workflowMap.values()));
            } else {
                setWorkflows([]);
            }
        } catch (err) {
            setWorkflowsError(err.message || 'Failed to fetch workflows.');
        } finally {
            setIsLoadingWorkflows(false);
        }
    }, [currentUser]);

    const fetchMyTasks = useCallback(async (page = 1) => {
        if (!currentUser) {
            setIsLoadingTasks(false);
            setMyTasks([]);
            return;
        }
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            const params = { status: 'Pending,In Progress,Needs Rework', limit: taskPagination.limit, page, sortBy: 'dueDate', sortOrder: 'asc' };
            const tasksDataResponse = await workflowService.listMyTasks(params);

            const tasksArray = tasksDataResponse.data || [];
            setMyTasks(tasksArray);

            setTaskPagination(prev => ({
                ...prev,
                currentPage: tasksDataResponse.currentPage || 1,
                totalPages: tasksDataResponse.totalPages || 1,
                totalTasks: tasksDataResponse.totalTasks || 0,
            }));
        } catch (err) {
            setTasksError(err.message || 'Failed to fetch tasks.');
            setMyTasks([]);
        } finally {
            setIsLoadingTasks(false);
        }
    }, [currentUser, taskPagination.limit]);
    


    useEffect(() => {
        if (!isAuthLoading && currentUser) {
            console.log("DASHBOARD: Auth resolved, user present. Fetching data.");
            fetchWorkflows();
            fetchMyTasks(1);
            fetchDashboardData();
        } else if (!isAuthLoading && !currentUser) {
            console.log("DASHBOARD: Auth resolved, no user. Clearing data and stopping loaders.");
            setIsLoadingWorkflows(false); setWorkflows([]);
            setIsLoadingTasks(false); setMyTasks([]);
            setIsLoadingDashboardData(false); setDashboardStats(null); setRecentActivities(null);
        }
    }, [isAuthLoading, currentUser, fetchWorkflows, fetchMyTasks, fetchDashboardData]);

    useEffect(() => {
        if (recentActivities) {
            const mappedInstances = (recentActivities.myRecentInstancesStarted || []).map(act => ({
                id: `inst-${act.instanceId}`,
                type: 'instanceStart',
                timestamp: new Date(act.startedAt),
                data: act
            }));

            const mappedTasks = (recentActivities.myRecentTasksCompleted || []).map(act => ({
                id: `task-${act.taskId}`,
                type: 'taskComplete',
                timestamp: new Date(act.completedAt),
                data: act
            }));

            const allActivities = [...mappedInstances, ...mappedTasks];
            allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
            setCombinedActivities(allActivities.slice(0, 7));
        } else {
            setCombinedActivities([]);
        }
    }, [recentActivities]);

    useEffect(() => {
        if (!isAuthLoading && currentUser) {
            const pollInterval = 30000;
            console.log(`[DASHBOARD] Setting up dashboard data polling every ${pollInterval / 1000} seconds.`);
            const intervalId = setInterval(async () => {
                console.log("[DASHBOARD] Polling for dashboard updates (activities, stats, tasks)...");
                setAutoRefreshing(true);
                try {
                    await Promise.all([
                        fetchDashboardData(),
                        fetchMyTasks(taskPagination.currentPage || 1)
                    ]);
                } catch (err) {
                    console.warn("[DASHBOARD] Error during periodic refresh:", err);
                } finally {
                    setAutoRefreshing(false);
                }
            }, pollInterval);
            return () => {
                console.log("[DASHBOARD] Clearing dashboard polling interval.");
                clearInterval(intervalId);
            };
        }
    }, [isAuthLoading, currentUser, fetchDashboardData, fetchMyTasks, taskPagination.currentPage]);

    useEffect(() => {
        let timer;
        if (isStartInstanceModalOpen && startInstanceStatus.successMessage) {
            timer = setTimeout(() => {
                closeStartInstanceModal();
            }, 1500);
        } else if (isStartInstanceModalOpen && startInstanceStatus.error) {
            timer = setTimeout(() => {
                setStartInstanceStatus(prev => ({ ...prev, error: null }));
            }, 4000);
        }
        return () => clearTimeout(timer);
    }, [startInstanceStatus.successMessage, startInstanceStatus.error, isStartInstanceModalOpen]);

    const filteredActivities = useMemo(() => {
        if (activityFilter === 'all') return combinedActivities;
        return combinedActivities.filter(activity => activity.type === activityFilter);
    }, [combinedActivities, activityFilter]);

    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center h-full p-6">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent" role="status"></div>
                <p className="ml-3 text-gray-600">Loading dashboard data...</p>
            </div>
        );
    }

    const canUserDesignWorkflows = currentUser && (currentUser.role === 'manager' || currentUser.role === 'admin');

    const handleCreateNewWorkflow = () => navigate('/designer');

    const openStartInstanceModal = (workflow) => {
        setSelectedWorkflowForInstance(workflow);
        setStartInstanceStatus({ loading: false, error: null, successMessage: null });
        if (workflow.expectedContextFields && workflow.expectedContextFields.length > 0) {
            const initialValues = {};
            workflow.expectedContextFields.forEach(field => {
                initialValues[field.key] = field.defaultValue || '';
            });
            setDynamicContextValues(initialValues);
        } else {
            setDynamicContextValues({});
            setRawInitialContext('{}');
        }
        setIsStartInstanceModalOpen(true);
    };

    const closeStartInstanceModal = () => {
        setIsStartInstanceModalOpen(false);
        setSelectedWorkflowForInstance(null);
        setDynamicContextValues({});
        setRawInitialContext('{}');
    };

    const handleDynamicContextChange = (key, value) => {
        setDynamicContextValues(prev => ({ ...prev, [key]: value }));
    };

    const handleStartInstance = async () => {
        if (!selectedWorkflowForInstance) return;
        let contextToSend = {};
        const hasDefinedFields = selectedWorkflowForInstance.expectedContextFields &&
            selectedWorkflowForInstance.expectedContextFields.length > 0;

        if (hasDefinedFields) {
            contextToSend = { ...dynamicContextValues };
        } else {
            try {
                contextToSend = JSON.parse(rawInitialContext);
            } catch {
                setStartInstanceStatus({
                    loading: false,
                    error: 'Invalid JSON in Initial Context. Please provide a valid JSON object.',
                    successMessage: null
                });
                return;
            }
        }

        setStartInstanceStatus({ loading: true, error: null, successMessage: null });
        try {
            const newInstance = await workflowService.startWorkflowInstance(selectedWorkflowForInstance._id, contextToSend);
            setStartInstanceStatus({
                loading: false,
                error: null,
                successMessage: `Instance started successfully! ID: ${newInstance?._id || 'N/A'}`
            });
            
            await Promise.all([
                fetchDashboardData(),
                fetchMyTasks(1)
            ]);
            
            setTimeout(() => {
                closeStartInstanceModal();
            }, 1500);
            
        } catch (err) {
            setStartInstanceStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'Failed to start instance.',
                successMessage: null
            });
        }
    };


    const closeTaskActionModal = () => {
        setIsTaskActionModalOpen(false);
        setSelectedTaskForAction(null);
    };
    

    const handleModalTaskActionSubmit = async (actionType, taskId, payload) => {
        setPageActionFeedback({ type: 'loading', message: `Processing ${actionType}...` });
        try {
            let response;
            let successMsg = '';
            if (actionType === 'complete') { 
                response = await workflowService.completeTask(taskId, payload); successMsg = 'Task completed!'; 
            }
            else if (actionType === 'reject') { 
                response = await workflowService.rejectTask(taskId, payload); successMsg = 'Task rejected!'; 
            }
            else if (actionType === 'approve') { 
                response = await workflowService.approveTask(taskId, payload); successMsg = 'Task approved!'; 
            }
            else if (actionType === 'deny') { 
                response = await workflowService.denyTask(taskId, payload); successMsg = 'Task denied!'; 
            }
            else if (actionType === 'markAsReviewed') { 
                response = await workflowService.completeTask(taskId, payload); successMsg = 'Task marked reviewed & completed!';
            }
            else { throw new Error('Unknown task action'); }

            if (response && response.success !== undefined) {
                 if (response.success) {
                    setPageActionFeedback({ type: 'success', message: successMsg });
                    
                    await Promise.all([
                        fetchDashboardData(),
                        fetchMyTasks(taskPagination.currentPage)
                    ]);
                    
                    return { success: true, message: successMsg };
                } else {
                    throw new Error(response.message || `Failed to ${actionType} task.`);
                }
            } else {
                console.warn("Task action response did not have an explicit 'success' field:", response);
                setPageActionFeedback({ type: 'success', message: successMsg });
                
                await Promise.all([
                    fetchDashboardData(),
                    fetchMyTasks(taskPagination.currentPage)
                ]);
                
                return { success: true, message: successMsg };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || `Error ${actionType}ing task.`;
            setPageActionFeedback({ type: 'error', message: errorMsg });
            return { success: false, message: errorMsg };
        } finally {
            setTimeout(() => setPageActionFeedback({type:'', message:''}), 4000);
        }
    };

    const openActivityDetailModal = (activity) => {
        setSelectedActivity(activity);
        setIsActivityDetailModalOpen(true);
    };

    const closeActivityDetailModal = () => {
        setIsActivityDetailModalOpen(false);
        setSelectedActivity(null);
    };

    const refreshDashboardData = () => {
        setDashboardRefreshing(true);
        Promise.all([
            fetchWorkflows(),
            fetchMyTasks(taskPagination.currentPage),
            fetchDashboardData()
        ]).finally(() => {
            setTimeout(() => setDashboardRefreshing(false), 500);
        });
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center mb-4 sm:mb-0">
                    <LayoutDashboard className="mr-3 h-7 w-7 text-indigo-600" />
                    <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={refreshDashboardData}
                        className={`p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all duration-200 ${dashboardRefreshing ? 'animate-pulse bg-indigo-50' : ''}`}
                        title="Refresh Data"
                        disabled={dashboardRefreshing}
                    >
                        <RefreshCw size={20} className={`${dashboardRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                    {canUserDesignWorkflows && (
                        <button
                            onClick={handleCreateNewWorkflow}
                            className="flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md shadow-sm transition-all duration-200 text-sm font-medium"
                        >
                            <PlusCircle size={18} className="mr-2" />
                            Create New Workflow
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className={`space-y-6 ${canUserDesignWorkflows ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    {canUserDesignWorkflows && (
                        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                                <FileText className="mr-2 h-6 w-6 text-gray-500" />
                                Workflow Definitions
                            </h2>
                            {isLoadingWorkflows && (
                                <div className="flex justify-center items-center py-10">
                                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                    <p className="ml-3 text-gray-500">Loading workflows...</p>
                                </div>
                            )}
                            {workflowsError && (
                                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
                                    <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                                    <p>Error: {workflowsError}</p>
                                </div>
                            )}
                            {!isLoadingWorkflows && !workflowsError && workflows.length === 0 && (
                                <p className="text-gray-500 text-center py-6">No workflow definitions found. Get started by creating one!</p>
                            )}
                            {!isLoadingWorkflows && !workflowsError && workflows.length > 0 && (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {workflows.map((workflow) => (
                                                <tr key={workflow._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{workflow.name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate whitespace-normal">{workflow.description || '-'}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTaskStatusColor(workflow.status)}`}>
                                                            {workflow.status || 'Draft'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(workflow.updatedAt || workflow.createdAt)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium space-x-3">
                                                        <Link
                                                            to={`/designer/${workflow._id}`}
                                                            className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                                                            title="Edit Workflow"
                                                        >
                                                            <Edit3 size={16} className="mr-1" /> Edit
                                                        </Link>
                                                        <button
                                                            onClick={() => openStartInstanceModal(workflow)}
                                                            title="Start Instance"
                                                            disabled={workflow.status !== 'Active'}
                                                            className={`text-green-600 hover:text-green-900 inline-flex items-center ${workflow.status !== 'Active' ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        >
                                                            <Play size={16} className="mr-1" /> Start
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                            <ListChecks className="mr-2 h-6 w-6 text-gray-500" />
                            My Active Tasks
                        </h2>
                        {isLoadingTasks && (
                            <div className="flex justify-center items-center py-10">
                                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                                <p className="ml-3 text-gray-500">Loading tasks...</p>
                            </div>
                        )}
                        {tasksError && (
                            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
                                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                                <p>Error: {tasksError}</p>
                            </div>
                        )}
                        {!isLoadingTasks && !tasksError && myTasks.length === 0 && (
                            <p className="text-gray-500 text-center py-6">You have no active tasks.</p>
                        )}
                        {!isLoadingTasks && !tasksError && myTasks.length > 0 && (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Title</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                                                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                            </tr>
                                        </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {myTasks.map((task) => {
                                        let assignedToDisplay = 'N/A';

                                        if (task.assignedToType === 'User' && task.assignedUserId) {
                                            if (currentUser && task.assignedUserId._id === currentUser.id) {
                                                assignedToDisplay = 'Me';
                                            } else {
                                                assignedToDisplay = task.assignedUserId.name || 'User';
                                            }
                                        } else if (task.assignedToType === 'Role' && task.assignedRoleName) {
                                            assignedToDisplay = `${task.assignedRoleName} (Role)`;
                                        }

                                        const isTaskClaimableByMe = currentUser &&
                                            task.assignedToType === 'Role' &&
                                            task.assignedRoleName === currentUser.role &&
                                            task.status === 'Pending';

                                        const isTaskClaimedByMe = currentUser &&
                                            task.assignedToType === 'User' &&
                                            task.assignedUserId?._id === currentUser.id &&
                                            (task.status === 'In Progress' || task.status === 'Pending' || task.status === 'Needs Rework');

                                        const canCurrentUserReassignTask = currentUser &&
                                            (currentUser.role === 'manager' || currentUser.role === 'admin') &&
                                            ['Pending', 'In Progress', 'Needs Rework'].includes(task.status);

                                        return (
                                            <tr key={task._id} className={`hover:bg-gray-50 transition-colors ${isTaskClaimedByMe ? 'bg-green-50' : ''}`}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.title}</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{task.workflowDefinitionId?.name || 'N/A'}</td>
                                                <td className="px-4 py-3 text-sm text-center">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                                                        {task.priority}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        {task.assignedToType === 'User' ? <User size={14} className="mr-1.5 text-gray-400" /> : <Users size={14} className="mr-1.5 text-gray-400" />}
                                                        {assignedToDisplay}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(task.dueDate)}</td>
                                                <td className="px-4 py-3 text-sm text-center">
                                                    <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getTaskStatusColor(task.status)}`}>
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-right space-x-2 flex items-center justify-end flex-wrap">
                                                    {isTaskClaimableByMe && (
                                                        <button
                                                            onClick={() => handleClaimTask(task._id)}
                                                            disabled={claimStatus.loading && claimStatus.taskId === task._id}
                                                            className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                                                            title="Claim this task"
                                                        >
                                                            {claimStatus.loading && claimStatus.taskId === task._id ? (
                                                                <Loader2 className="animate-spin h-4 w-4" />
                                                            ) : (
                                                                'Claim'
                                                            )}
                                                        </button>
                                                    )}

                                                    {isTaskClaimedByMe && (
                                                        <button
                                                            onClick={() => handleUnclaimTask(task._id)}
                                                            disabled={unclaimStatus.loading && unclaimStatus.taskId === task._id}
                                                            className="px-2.5 py-1 text-xs font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                                                            title="Unclaim this task (return to queue)"
                                                        >
                                                            {unclaimStatus.loading && unclaimStatus.taskId === task._id ? (
                                                                <Loader2 className="animate-spin h-4 w-4" />
                                                            ) : (
                                                                'Unclaim'
                                                            )}
                                                        </button>
                                                    )}
                                                    
                                                    {canCurrentUserReassignTask && (
                                                         <button
                                                            onClick={() => openReassignModal(task)}
                                                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                                                            title="Reassign this task"
                                                        >
                                                            Reassign
                                                        </button>
                                                    )}

                                                    
                                                    {claimStatus.taskId === task._id && claimStatus.error && (
                                                        <span className="text-xs text-red-500 whitespace-nowrap w-full text-right mt-1">{claimStatus.error}</span>
                                                    )}
                                                    {claimStatus.taskId === task._id && claimStatus.success && (
                                                        <span className="text-xs text-green-500 whitespace-nowrap w-full text-right mt-1">{claimStatus.success}</span>
                                                    )}
                                                    {unclaimStatus.taskId === task._id && unclaimStatus.error && (
                                                        <span className="text-xs text-red-500 whitespace-nowrap w-full text-right mt-1">{unclaimStatus.error}</span>
                                                    )}
                                                    {unclaimStatus.taskId === task._id && unclaimStatus.success && (
                                                        <span className="text-xs text-green-500 whitespace-nowrap w-full text-right mt-1">{unclaimStatus.success}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                    </table>
                                    
                                    <Pagination
                                        currentPage={taskPagination.currentPage}
                                        totalPages={taskPagination.totalPages}
                                        totalItems={taskPagination.totalTasks}
                                        itemsPerPage={taskPagination.limit}
                                        onPageChange={(page) => fetchMyTasks(page)}
                                        loading={isLoadingTasks}
                                        itemLabel="tasks"
                                        size="sm"
                                        showFirstLast={false}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    {currentUser?.role === 'staff' && (
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-purple-200">
                            <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
                                <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mr-3">
                                    <Settings className="h-6 w-6 text-purple-600" />
                                </div>
                                Quick Actions
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Link
                                    to="/my-tasks"
                                    className="group flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                                >
                                    <div className="p-3 bg-blue-100 rounded-lg mr-4 group-hover:bg-blue-200 transition-colors">
                                        <ListChecks className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">View All My Tasks</h3>
                                        <p className="text-xs text-gray-500 mt-1">Complete task management</p>
                                    </div>
                                </Link>
                                
                                <Link
                                    to="/settings"
                                    className="group flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                                >
                                    <div className="p-3 bg-gray-100 rounded-lg mr-4 group-hover:bg-gray-200 transition-colors">
                                        <User className="h-6 w-6 text-gray-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">My Profile</h3>
                                        <p className="text-xs text-gray-500 mt-1">Update personal information</p>
                                    </div>
                                </Link>

                                <div className="group flex items-center p-4 bg-white rounded-lg border border-gray-200">
                                    <div className="p-3 bg-green-100 rounded-lg mr-4">
                                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">Tasks Available</h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {myTasks.filter(t => t.assignedToType === 'Role' && t.status === 'Pending').length} tasks to claim
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className={`space-y-6 ${!canUserDesignWorkflows ? 'lg:col-span-2' : ''}`}>
                    <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                                <div className="p-2 bg-gradient-to-br from-indigo-100 to-blue-100 rounded-lg mr-3">
                                    {currentUser?.role === 'staff' ? <ListChecks className="h-6 w-6 text-indigo-600" /> : <TrendingUp className="h-6 w-6 text-indigo-600" />}
                                </div>
                                {currentUser?.role === 'staff' ? 'My Work Overview' : 'My Overview'}
                            </h2>
                            <div className="text-xs text-white bg-red-400 px-2 py-1 rounded-full">
                                Live Data
                        </div>
                        </div>
                        
                        {isLoadingDashboardData && (
                            <div className="flex justify-center items-center py-12">
                                <div className="relative">
                                    <div className="h-12 w-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Activity className="h-5 w-5 text-indigo-600" />
                                    </div>
                                </div>
                                <p className="ml-4 text-gray-600 font-medium">Loading insights...</p>
                            </div>
                        )}
                        
                        {dashboardError && !isLoadingDashboardData && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                                <div className="flex items-center">
                                    <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Unable to load overview</p>
                                        <p className="text-xs text-red-600 mt-1">{dashboardError}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!isLoadingDashboardData && !dashboardError && dashboardStats && (
                            <div className="grid grid-cols-2 gap-4">
                                {currentUser?.role === 'staff' ? (
                                    <>
                                        <div className="col-span-2 group relative">
                                            <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-5 rounded-xl border border-green-200 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl shadow-lg">
                                                        <CheckCircle2 className="h-6 w-6 text-white" />
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold bg-green-200 text-green-800 px-3 py-1 rounded-full">
                                                            MY WORK
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-3xl font-bold text-green-900 leading-none">
                                                        {(dashboardStats.myCompletedInstancesToday ?? 0) + (dashboardStats.myCompletedTasksToday ?? 0)}
                                                    </p>
                                                    <p className="text-sm font-semibold text-green-700">
                                                        Tasks Completed Today
                                                    </p>
                                                    <p className="text-xs text-green-600 opacity-75">
                                                        Work accomplished in the last 24 hours
                                                    </p>
                                                </div>
                                                
                                                <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                                    Tasks and workflow steps you've completed today
                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Total Processes Started - For Non-Staff */}
                                        <div className="col-span-2 group relative">
                                            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-5 rounded-xl border border-blue-200 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                                                        <Activity className="h-6 w-6 text-white" />
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs font-bold bg-blue-200 text-blue-800 px-3 py-1 rounded-full">
                                                            TOTAL
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-3xl font-bold text-blue-900 leading-none">
                                                        {dashboardStats.myTotalInstancesStarted ?? '0'}
                                                    </p>
                                                    <p className="text-sm font-semibold text-blue-700">
                                                        My Processes Started
                                                    </p>
                                                    <p className="text-xs text-blue-600 opacity-75">
                                                        Lifetime workflow initiations
                                                    </p>
                                                </div>
                                                
                                                {/* Tooltip */}
                                                <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                                    Total workflow instances you've initiated
                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                
                                <div className="group relative">
                                    <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-4 rounded-xl border border-emerald-200 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg">
                                                {currentUser?.role === 'staff' ? <ListChecks className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white" />}
                                    </div>
                                            <span className="text-xs font-bold bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full">
                                                ACTIVE
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-emerald-900 leading-none">
                                            {currentUser?.role === 'staff' ? (myTasks.length || '0') : (dashboardStats.myActiveInstances ?? '0')}
                                        </p>
                                        <p className="text-xs font-medium text-emerald-700 mt-1">
                                            {currentUser?.role === 'staff' ? 'Active Tasks' : 'Active Instances'}
                                        </p>
                                        
                                        <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                            {currentUser?.role === 'staff' ? 'Tasks you are currently working on' : 'Currently running workflows'}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="group relative">
                                    <div className="bg-gradient-to-br from-amber-50 to-yellow-100 p-4 rounded-xl border border-amber-200 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg">
                                                <Clock className="h-5 w-5 text-white" />
                                    </div>
                                            <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                                                WAITING
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-amber-900 leading-none">
                                            {dashboardStats.myPendingTasks ?? '0'}
                                        </p>
                                        <p className="text-xs font-medium text-amber-700 mt-1">
                                            Pending Tasks
                                        </p>
                                        
                                        <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                            Tasks awaiting your action
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="group relative">
                                    <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-4 rounded-xl border border-green-200 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                                                {currentUser?.role === 'staff' ? <TrendingUp className="h-5 w-5 text-white" /> : <CheckCircle2 className="h-5 w-5 text-white" />}
                                    </div>
                                            <span className="text-xs font-bold bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                                                {currentUser?.role === 'staff' ? 'EFFICIENCY' : '24H'}
                                            </span>
                                        </div>
                                        <p className="text-2xl font-bold text-green-900 leading-none">
                                            {currentUser?.role === 'staff' ? 
                                                ((myTasks.filter(t => t.status === 'Completed').length / Math.max(myTasks.length, 1)) * 100).toFixed(0) + '%' :
                                                (dashboardStats.myCompletedInstancesToday ?? '0')
                                            }
                                        </p>
                                        <p className="text-xs font-medium text-green-700 mt-1">
                                            {currentUser?.role === 'staff' ? 'Task Completion Rate' : 'Completed Today'}
                                        </p>
                                        
                                        <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                            {currentUser?.role === 'staff' ? 'Percentage of your tasks completed' : 'Instances completed in last 24h'}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="group relative">
                                    <div className={`bg-gradient-to-br p-4 rounded-xl border transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-help ${
                                        currentUser?.role === 'staff' ? 
                                        'from-blue-50 to-sky-100 border-blue-200' : 
                                        'from-red-50 to-pink-100 border-red-200'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className={`p-2 bg-gradient-to-br rounded-lg ${
                                                currentUser?.role === 'staff' ? 
                                                'from-blue-500 to-sky-600' : 
                                                'from-red-500 to-pink-600'
                                            }`}>
                                                {currentUser?.role === 'staff' ? <Clock className="h-5 w-5 text-white" /> : <AlertOctagon className="h-5 w-5 text-white" />}
                                            </div>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                currentUser?.role === 'staff' ? 
                                                'bg-blue-200 text-blue-800' : 
                                                'bg-red-200 text-red-800'
                                            }`}>
                                                {currentUser?.role === 'staff' ? 'AVAILABLE' : 'ISSUES'}
                                            </span>
                                        </div>
                                        <p className={`text-2xl font-bold leading-none ${
                                            currentUser?.role === 'staff' ? 'text-blue-900' : 'text-red-900'
                                        }`}>
                                            {currentUser?.role === 'staff' ? 
                                                (myTasks.filter(t => t.status === 'Pending' && t.assignedToType === 'Role').length || '0') :
                                                (dashboardStats.myFailedInstancesToday ?? '0')
                                            }
                                        </p>
                                        <p className={`text-xs font-medium mt-1 ${
                                            currentUser?.role === 'staff' ? 'text-blue-700' : 'text-red-700'
                                        }`}>
                                            {currentUser?.role === 'staff' ? 'Tasks to Claim' : 'Failed (24h)'}
                                        </p>
                                        
                                        <div className="absolute invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gray-900 text-white text-xs rounded-lg py-2 px-3 -top-12 left-1/2 transform -translate-x-1/2 z-10 whitespace-nowrap">
                                            {currentUser?.role === 'staff' ? 'Tasks available for you to claim' : 'Instances that failed in last 24h'}
                                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!isLoadingDashboardData && !dashboardError && !dashboardStats && (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Activity className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500 font-medium">Overview data not available</p>
                                <button 
                                    onClick={refreshDashboardData}
                                    className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    Try refreshing
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-gradient-to-br from-white to-gray-50 p-6 rounded-xl shadow-lg border border-gray-100 transition-all duration-300 hover:shadow-xl">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center mb-3 sm:mb-0">
                                <div className="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-lg mr-3">
                                    <MessageSquare className="h-6 w-6 text-purple-600" />
                                </div>
                                My Recent Activities
                                {autoRefreshing && (
                                    <div className="ml-3 flex items-center text-xs text-gray-500">
                                        <Loader2 size={14} className="animate-spin mr-1" />
                                        Updating...
                                    </div>
                                )}
                            </h2>
                            
                            <div className="flex bg-gray-100 rounded-lg p-1 text-sm shadow-inner">
                                <button 
                                    onClick={() => setActivityFilter('all')} 
                                    className={`px-3 py-1.5 rounded-md transition-all duration-200 font-medium ${
                                        activityFilter === 'all' 
                                            ? 'bg-white shadow-sm text-indigo-700 border border-gray-200' 
                                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    All
                                </button>
                                {currentUser?.role !== 'staff' && (
                                    <button 
                                        onClick={() => setActivityFilter('instanceStart')} 
                                        className={`px-3 py-1.5 rounded-md transition-all duration-200 font-medium ${
                                            activityFilter === 'instanceStart' 
                                                ? 'bg-white shadow-sm text-indigo-700 border border-gray-200' 
                                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                        }`}
                                    >
                                        Started
                                    </button>
                                )}
                                <button 
                                    onClick={() => setActivityFilter('taskComplete')} 
                                    className={`px-3 py-1.5 rounded-md transition-all duration-200 font-medium ${
                                        activityFilter === 'taskComplete' 
                                            ? 'bg-white shadow-sm text-indigo-700 border border-gray-200' 
                                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                    }`}
                                >
                                    {currentUser?.role === 'staff' ? 'My Tasks' : 'Completed'}
                                </button>
                            </div>
                        </div>
                        
                        {isLoadingDashboardData && (
                            <div className="flex justify-center items-center py-8">
                                <div className="relative">
                                    <div className="h-8 w-8 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin"></div>
                                </div>
                                <p className="ml-3 text-sm text-gray-600">Loading activities...</p>
                            </div>
                        )}
                        
                        {dashboardError && !isLoadingDashboardData && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
                                <div className="flex items-center">
                                    <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                                    <div>
                                        <p className="text-sm font-medium text-red-800">Unable to load activities</p>
                                        <p className="text-xs text-red-600 mt-1">{dashboardError}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {!isLoadingDashboardData && !dashboardError && filteredActivities.length > 0 && (
                            <div className="space-y-3">
                                {filteredActivities.map((activity, index) => (
                                    <div 
                                        key={activity.id} 
                                        className={`group relative p-4 border border-gray-200 rounded-xl transition-all duration-200 hover:shadow-md hover:border-indigo-200 bg-gradient-to-r ${
                                            activity.type === 'instanceStart' 
                                                ? 'from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100' 
                                                : 'from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100'
                                        }`}
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4 flex-1 min-w-0">
                                                <div className={`flex-shrink-0 p-3 rounded-xl shadow-sm ${
                                                    activity.type === 'instanceStart' 
                                                        ? 'bg-gradient-to-br from-blue-500 to-indigo-600' 
                                                        : 'bg-gradient-to-br from-green-500 to-emerald-600'
                                                }`}>
                                                    {activity.type === 'instanceStart' ? (
                                                        <Play size={20} className="text-white" />
                                                    ) : (
                                                        <CheckCircle2 size={20} className="text-white" />
                                            )}
                                        </div>
                                                
                                                <div className="flex-1 min-w-0">
                                            {activity.type === 'instanceStart' && (
                                                <div>
                                                            <p className="font-semibold text-gray-900 truncate">
                                                                Started: <span className="text-blue-700">{activity.data.workflowName || 'Unknown Workflow'}</span>
                                                    </p>
                                                            <div className="flex items-center mt-1 space-x-2">
                                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getInstanceStatusColor(activity.data.status)}`}>
                                                            {activity.data.status}
                                                        </span>
                                                                <span className="text-xs text-gray-500">•</span>
                                                                <span className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
                                                                    {activity.data.instanceId.substring(0, 8)}...
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            {activity.type === 'taskComplete' && (
                                                <div>
                                                            <p className="font-semibold text-gray-900 truncate">
                                                                Completed: <span className="text-green-700">{activity.data.taskTitle}</span>
                                                    </p>
                                                            {activity.data.workflowName && activity.data.workflowName !== 'N/A' && (
                                                                <p className="text-xs text-gray-600 mt-1 truncate">
                                                                    in <span className="italic">{activity.data.workflowName}</span>
                                                </p>
                                            )}
                                        </div>
                                            )}
                                        </div>
                                            </div>
                                            
                                            <div className="flex flex-col items-end space-y-2">
                                                <span className="text-xs text-gray-500 font-medium whitespace-nowrap">
                                                    {formatRelativeTime(activity.timestamp)}
                                                </span>
                                                <button 
                                                    onClick={() => openActivityDetailModal(activity)}
                                                    className="opacity-0 group-hover:opacity-100 transition-all duration-200 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-md flex items-center space-x-1"
                                                >
                                                    <Eye size={12} />
                                                    <span>View details</span>
                                                    <ArrowRight size={10} />
                                            </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                        {!isLoadingDashboardData && !dashboardError && recentActivities && filteredActivities.length === 0 && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Calendar className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 mb-2">
                                    No {activityFilter !== 'all' ? 
                                        (activityFilter === 'instanceStart' ? 'started workflows' : 'completed tasks') : 
                                        'recent activities'} to display
                                </p>
                                {activityFilter !== 'all' && (
                                <button 
                                    onClick={() => setActivityFilter('all')} 
                                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                        Show all activities instead
                                </button>
                                )}
                    </div>
                        )}
                        
                        {!isLoadingDashboardData && !dashboardError && !recentActivities && (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertOctagon className="h-8 w-8 text-gray-400" />
                                </div>
                                <p className="text-sm font-medium text-gray-600 mb-3">Recent activities not available</p>
                                <button 
                                    onClick={refreshDashboardData} 
                                    className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
                                >
                                    <RefreshCw size={12} className="mr-2" /> 
                                    Try refreshing data
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {taskToReassign && (
                <Modal
                    isOpen={isReassignModalOpen}
                    onClose={!reassignStatus.loading ? closeReassignModal : () => { }}
                    title={`Reassign Task: ${taskToReassign.title}`}
                    footer={
                        <>
                            <button type="button" onClick={closeReassignModal} disabled={reassignStatus.loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300">Cancel</button>
                            <button type="button" onClick={handleReassignSubmit} disabled={reassignStatus.loading || (reassignFormData.assigneeType === 'User' && !reassignFormData.selectedUserId) || (reassignFormData.assigneeType === 'Role' && !reassignFormData.selectedRoleName)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                {reassignStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Users size={16} className="mr-2" />} Confirm Reassignment
                            </button>
                        </>
                    }
                >
                    <form onSubmit={handleReassignSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="reassignAssigneeType" className="block text-sm font-medium text-gray-700">Reassign To:</label>
                            <select id="reassignAssigneeType" name="assigneeType" value={reassignFormData.assigneeType} onChange={handleReassignFormInputChange} disabled={reassignStatus.loading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                <option value="User">Specific User</option>
                                <option value="Role">Specific Role</option>
                            </select>
                        </div>
                        {reassignFormData.assigneeType === 'User' && (
                            <div>
                                <label htmlFor="reassignSelectedUserId" className="block text-sm font-medium text-gray-700">Select User:</label>
                                {isLoadingUsers ? <p className="text-xs text-gray-500">Loading users...</p> : (
                                    <select id="reassignSelectedUserId" name="selectedUserId" value={reassignFormData.selectedUserId} onChange={handleReassignFormInputChange} disabled={reassignStatus.loading || isLoadingUsers} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                        <option value="">-- Select User --</option>
                                        {allUsers.map(user => (<option key={user._id} value={user._id}>{user.name || user.username} ({user.email})</option>))}
                                    </select>
                                )}
                            </div>
                        )}
                        {reassignFormData.assigneeType === 'Role' && (
                            <div>
                                <label htmlFor="reassignSelectedRoleName" className="block text-sm font-medium text-gray-700">Select Role:</label>
                                <select id="reassignSelectedRoleName" name="selectedRoleName" value={reassignFormData.selectedRoleName} onChange={handleReassignFormInputChange} disabled={reassignStatus.loading} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                                    <option value="">-- Select Role --</option>
                                    {AVAILABLE_ROLES_FOR_ASSIGN.map(role => (<option key={role} value={role} className="capitalize">{role}</option>))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label htmlFor="reassignComment" className="block text-sm font-medium text-gray-700">Comment (Optional):</label>
                            <textarea id="reassignComment" name="comment" rows={3} value={reassignFormData.comment} onChange={handleReassignFormInputChange} disabled={reassignStatus.loading} className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="Reason for reassignment..."/>
                        </div>
                        {reassignStatus.error && (<div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center"><AlertTriangle size={18} className="mr-2" /> {reassignStatus.error}</div>)}
                        {reassignStatus.success && (<div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center"><CheckCircle2 size={18} className="mr-2" /> {reassignStatus.success}</div>)}
                    </form>
                </Modal>
            )}

            <Modal
                isOpen={isStartInstanceModalOpen}
                onClose={closeStartInstanceModal}
                title={`Start Instance: ${selectedWorkflowForInstance?.name || ''}`}
                footer={
                    <>
                        <button type="button" onClick={closeStartInstanceModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300" disabled={startInstanceStatus.loading}>Cancel</button>
                        <button type="button" onClick={handleStartInstance} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 flex items-center" disabled={startInstanceStatus.loading}>
                            {startInstanceStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Play size={16} className="mr-2" />} Confirm Start
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {selectedWorkflowForInstance?.expectedContextFields && selectedWorkflowForInstance.expectedContextFields.length > 0 ? (
                        <>
                            <p className="text-sm text-gray-600">Please provide the initial context variables for this workflow:</p>
                            {selectedWorkflowForInstance.expectedContextFields.map((field, index) => (
                                <div key={field.key || index}>
                                    <label htmlFor={`dynCtx-${field.key}`} className="block text-xs font-medium text-gray-700 mb-1">{field.label}:</label>
                                    <input type="text" id={`dynCtx-${field.key}`} name={field.key} value={dynamicContextValues[field.key] || ''} onChange={(e) => handleDynamicContextChange(field.key, e.target.value)} placeholder={field.defaultValue || `Enter ${field.label.toLowerCase()}`} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900" disabled={startInstanceStatus.loading} />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-600">Provide the initial context for this workflow instance as a JSON object (or leave as {'{}'} for empty context).</p>
                            <textarea id="initialContext" name="initialContext" rows={6} value={rawInitialContext} onChange={(e) => setRawInitialContext(e.target.value)} placeholder={'{\n  "key": "value",\n  "anotherKey": 123\n}'} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white text-gray-900" disabled={startInstanceStatus.loading} />
                        </>
                    )}
                    {startInstanceStatus.successMessage && (<div className="mt-2 flex items-center text-xs text-green-700 bg-green-100 p-2 rounded-md"><CheckCircle2 className="h-4 w-4 mr-1.5 flex-shrink-0" /> {startInstanceStatus.successMessage}</div>)}
                    {startInstanceStatus.error && (<div className="mt-2 flex items-center text-xs text-red-700 bg-red-100 p-2 rounded-md"><AlertTriangle className="h-4 w-4 mr-1.5 flex-shrink-0" /> {startInstanceStatus.error}</div>)}
                </div>
            </Modal>

            {selectedActivity && (
                <Modal
                    isOpen={isActivityDetailModalOpen}
                    onClose={closeActivityDetailModal}
                    title={`Activity Details - ${selectedActivity.type === 'instanceStart' ? 'Workflow Started' : 'Task Completed'}`}
                    size="lg"
                    footer={
                        <button
                            onClick={closeActivityDetailModal}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
                        >
                            Close
                        </button>
                    }
                >
                    <div className="space-y-6">
                        {selectedActivity.type === 'instanceStart' && (
                            <>
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center mb-3">
                                        <Play className="h-6 w-6 text-blue-600 mr-3" />
                                        <h3 className="text-lg font-semibold text-blue-900">Workflow Instance Started</h3>
                                    </div>
                                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Workflow Name</dt>
                                            <dd className="mt-1 text-sm text-gray-900 font-semibold">{selectedActivity.data.workflowName || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Instance ID</dt>
                                            <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                                                {selectedActivity.data.instanceId}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Current Status</dt>
                                            <dd className="mt-1">
                                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getInstanceStatusColor(selectedActivity.data.status)}`}>
                                                    {selectedActivity.data.status}
                                                </span>
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Started At</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedActivity.data.startedAt, true)}</dd>
                                        </div>
                                    </dl>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Actions</h4>
                                    <div className="flex space-x-2">
                                        <Link
                                            to={`/my-workflows/${selectedActivity.data.instanceId}`}
                                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                        >
                                            <ExternalLink className="h-4 w-4 mr-2" />
                                            View Instance
                                        </Link>
                                    </div>
                                </div>
                            </>
                        )}
                        
                        {selectedActivity.type === 'taskComplete' && (
                            <>
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <div className="flex items-center mb-3">
                                        <CheckCircle2 className="h-6 w-6 text-green-600 mr-3" />
                                        <h3 className="text-lg font-semibold text-green-900">Task Completed</h3>
                                    </div>
                                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Task Title</dt>
                                            <dd className="mt-1 text-sm text-gray-900 font-semibold">{selectedActivity.data.taskTitle}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Task ID</dt>
                                            <dd className="mt-1 text-sm text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded">
                                                {selectedActivity.data.taskId}
                                            </dd>
                                        </div>
                                        {selectedActivity.data.workflowName && selectedActivity.data.workflowName !== 'N/A' && (
                                            <div className="sm:col-span-2">
                                                <dt className="text-sm font-medium text-gray-500">Workflow</dt>
                                                <dd className="mt-1 text-sm text-gray-900">{selectedActivity.data.workflowName}</dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-sm font-medium text-gray-500">Completed At</dt>
                                            <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedActivity.data.completedAt, true)}</dd>
                                        </div>
                                    </dl>
                                </div>
                                
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-gray-900 mb-2">Task History</h4>
                                    <p className="text-xs text-gray-600">This task was successfully completed and the workflow has continued to the next step.</p>
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}

            {selectedTaskForAction && currentUser && (
                <TaskActionModal
                    isOpen={isTaskActionModalOpen}
                    onClose={closeTaskActionModal}
                    task={selectedTaskForAction}
                    currentUser={currentUser}
                    onTaskActionSubmit={handleModalTaskActionSubmit}
                    onAfterAction={() => {
                        console.log("TaskActionModal's onAfterAction called from DashboardPage. Refreshing data.");
                        fetchMyTasks(taskPagination.currentPage);
                        fetchDashboardData();
                    }}
                />
            )}
            
            {pageActionFeedback.message && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-sm z-[100] max-w-sm animate-in slide-in-from-bottom-2 duration-300 ${
                    pageActionFeedback.type === 'success' ? 'bg-green-500 text-white' : ''
                }${pageActionFeedback.type === 'error' ? 'bg-red-500 text-white' : ''}${
                    pageActionFeedback.type === 'loading' ? 'bg-blue-500 text-white' : ''
                }`}>
                    <div className="flex items-center">
                    {pageActionFeedback.type === 'loading' && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
                        {pageActionFeedback.type === 'success' && <CheckCircle2 className="inline mr-2 h-4 w-4" />}
                        {pageActionFeedback.type === 'error' && <AlertTriangle className="inline mr-2 h-4 w-4" />}
                        <span>{pageActionFeedback.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};