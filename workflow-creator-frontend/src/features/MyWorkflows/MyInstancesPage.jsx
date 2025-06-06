import React, { useState, useEffect, useCallback } from 'react';
import { ListChecks, AlertTriangle, Loader2, RefreshCw, Filter, FileText, DownloadCloud, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import workflowService from '../../lib/workflowService';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { Pagination } from '../../components/Pagination';

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (_e) { return 'Invalid Date'; }
};

const getInstanceStatusColor = (status) => {
    switch (status) {
        case 'Not Started': return 'bg-gray-100 text-gray-800';
        case 'Running': return 'bg-blue-100 text-blue-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Failed': return 'bg-red-100 text-red-800';
        case 'Suspended': case 'WaitingForTimer': case 'AwaitingFileUpload': case 'WaitingForSubWorkflow': return 'bg-yellow-100 text-yellow-800';
        case 'Terminated': return 'bg-pink-100 text-pink-800';
        case 'Archived': return 'bg-neutral-100 text-neutral-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const getStatusColor = (status) => {
    switch (status) {
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Failed': return 'bg-red-100 text-red-800';
        case 'Running': return 'bg-blue-100 text-blue-800';
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        case 'Skipped': return 'bg-gray-100 text-gray-800';
        case 'Waiting': return 'bg-purple-100 text-purple-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Rejected': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

const ALL_INSTANCE_STATUSES = [
    'Not Started', 'Running', 'Completed', 'Failed', 'Suspended', 
    'WaitingForTimer', 'AwaitingFileUpload', 'WaitingForSubWorkflow', 'Terminated'
];

export const MyInstancesPage = () => {
    const { user } = useAuth();
    const [myInstances, setMyInstances] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1, totalPages: 1, totalItems: 0, limit: 10
    });
    const [selectedInstanceTasks, setSelectedInstanceTasks] = useState([]);
    const [isLoadingInstanceTasks, setIsLoadingInstanceTasks] = useState(false);
    const [expandedInstanceId, setExpandedInstanceId] = useState(null);

    const [statusFilter, setStatusFilter] = useState(localStorage.getItem('myInstancesStatusFilter') || '');

    const isStaffUser = user?.role === 'staff';

    const fetchTasksForInstance = useCallback(async (instanceId) => {
        if (expandedInstanceId === instanceId) {
            setExpandedInstanceId(null);
            setSelectedInstanceTasks([]);
            return;
        }
        setExpandedInstanceId(instanceId);
        setIsLoadingInstanceTasks(true);
        setSelectedInstanceTasks([]);
        try {
            const response = await workflowService.listTasksForInstance(instanceId, {
            });
            if (response.success) {
                console.log(`Tasks for instance ${instanceId}:`, response.data);
                setSelectedInstanceTasks(response.data || []);
            } else {
                console.error("Failed to fetch tasks for instance:", response.message);
                setSelectedInstanceTasks([]);
            }
        } catch (err) {
            console.error("Error fetching tasks for instance:", err);
            setSelectedInstanceTasks([]);
        } finally {
            setIsLoadingInstanceTasks(false);
        }
    }, [expandedInstanceId]);

    const fetchMyInstances = useCallback(async (page = 1, currentStatusFilter = statusFilter) => {
        setIsLoading(true);
        setError(null);
        try {
            const params = {
                page,
                limit: pagination.limit,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
            };
            
            if (currentStatusFilter) {
                params.status = currentStatusFilter;
            }
            
            let response;
            
            if (isStaffUser) {
                response = await workflowService.listWorkflowInstances({
                    ...params,
                    staffTaskView: true
                });
            } else {
                response = await workflowService.listWorkflowInstances(params);
            }
            
            if (response.success) {
                setMyInstances(response.data || []);
                setPagination(prev => ({
                    ...prev,
                    currentPage: response.pagination.currentPage || 1,
                    totalPages: response.pagination.totalPages || 1,
                    totalItems: response.pagination.totalItems || 0,
                }));
            } else {
                throw new Error(response.message || `Failed to fetch ${isStaffUser ? 'workflow instances with your tasks' : 'your workflow instances'}.`);
            }
        } catch (err) {
            setError(err.message || "An error occurred.");
            setMyInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit, statusFilter, user, isStaffUser]);

    useEffect(() => {
        if (user) {
             fetchMyInstances(1, statusFilter);
        }
    }, [user, fetchMyInstances, statusFilter]);

    const handleStatusFilterChange = (e) => {
        const newFilter = e.target.value;
        setStatusFilter(newFilter);
        localStorage.setItem('myInstancesStatusFilter', newFilter);
        fetchMyInstances(1, newFilter);
    };
    
    if (!user) {
        return <div className="p-8 text-center">Please log in to view your instances.</div>;
    }

    const getPageTitle = () => {
        if (isStaffUser) {
            return "Workflow Instances - My Tasks";
        }
        return "My Workflow Instances";
    };

    const getPageDescription = () => {
        if (isStaffUser) {
            return "Workflow instances where you have tasks assigned or have worked on tasks";
        }
        return "Workflow instances you have started";
    };

    const getEmptyMessage = () => {
        if (isStaffUser) {
            return "You haven't been assigned any tasks in workflow instances yet, or none match your filter.";
        }
        return "You have not started any workflow instances yet, or none match your filter.";
    };

  return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center">
                    {isStaffUser ? (
                        <Briefcase className="mr-3 h-7 w-7 text-indigo-600" />
                    ) : (
                        <ListChecks className="mr-3 h-7 w-7 text-indigo-600" />
                    )}
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-800">{getPageTitle()}</h1>
                        <p className="text-sm text-gray-600 mt-1">{getPageDescription()}</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchMyInstances(1, statusFilter)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md transition-colors mt-2 sm:mt-0"
                    title="Refresh List"
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            <div className="mb-4 p-4 bg-white rounded-lg shadow border flex items-center space-x-3">
                <Filter size={18} className="text-gray-500" />
                <label htmlFor="statusFilter" className="text-sm font-medium text-gray-700">Filter by Status:</label>
                <select
                    id="statusFilter"
                    name="statusFilter"
                    value={statusFilter}
                    onChange={handleStatusFilterChange}
                    className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                >
                    <option value="">All Statuses</option>
                    {ALL_INSTANCE_STATUSES.map(status => (
                        <option key={status} value={status}>{status}</option>
                    ))}
                </select>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                {isLoading && (
                    <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                        <p className="ml-3 text-gray-500">Loading instances...</p>
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0" />
                        <p>Error: {error}</p>
                    </div>
                )}
                {!isLoading && !error && myInstances.length === 0 && (
                    <p className="text-gray-500 text-center py-6">{getEmptyMessage()}</p>
                )}
                {!isLoading && !error && myInstances.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-1 py-3"></th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow Name</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started By</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                    {isStaffUser && (
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">My Tasks</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {myInstances.map((instance) => (
                                    <React.Fragment key={instance._id}>
                                        <tr 
                                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                                            onClick={() => fetchTasksForInstance(instance._id)}
                                        >
                                            <td className="px-1 py-3 whitespace-nowrap text-sm">
                                                {expandedInstanceId === instance._id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs" title={instance.workflowDefinitionId?.name}>
                                                {instance.workflowDefinitionId?.name || 'N/A'}
                                                <span className="text-xs text-gray-400 ml-1">(v{instance.workflowDefinitionId?.version || 'N/A'})</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getInstanceStatusColor(instance.status)}`}>
                                                    {instance.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{instance.startedBy?.name || 'System'}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(instance.createdAt, true)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(instance.updatedAt, true)}</td>
                                            {isStaffUser && (
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {instance.taskCount || 0} tasks
                                                    </span>
                                                </td>
                                            )}
                                        </tr>
                                        {expandedInstanceId === instance._id && (
                                            <tr>
                                                <td colSpan={isStaffUser ? 7 : 6} className="p-0 bg-gray-50">
                                                    <div className="p-4 border-l-4 border-indigo-500">
                                                        {isLoadingInstanceTasks && (
                                                            <div className="flex items-center text-sm text-gray-500">
                                                                <Loader2 className="animate-spin mr-2 h-4 w-4" /> Loading tasks...
                                                            </div>
                                                        )}
                                                        {!isLoadingInstanceTasks && selectedInstanceTasks.length === 0 && (
                                                            <p className="text-sm text-gray-500">No tasks found for this instance or tasks are not yet loaded.</p>
                                                        )}
                                                        {!isLoadingInstanceTasks && selectedInstanceTasks.length > 0 && (
                                                            <div className="space-y-3">
                                                                <h4 className="text-sm font-semibold text-gray-700">
                                                                    {isStaffUser ? "Tasks in this Instance:" : "Tasks for this Instance:"}
                                                                </h4>
                                                                {selectedInstanceTasks.map(task => (
                                                                    <div key={task._id} className="p-3 border rounded-md bg-white shadow-sm">
                                                                        <div className="flex items-start justify-between">
                                                                            <div className="flex-1">
                                                                                <p className="text-sm font-medium text-gray-800">
                                                                                    {task.title} 
                                                                                    <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                                                                                        {task.status}
                                                                                    </span>
                                                                                </p>
                                                                                <p className="text-xs text-gray-500">Type: {task.taskType} (Node: {task.nodeType})</p>
                                                                                {task.description && <p className="mt-1 text-xs text-gray-600 italic">"{task.description}"</p>}
                                                                                
                                                                                {isStaffUser && (
                                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                                        Assigned to: {
                                                                                            task.assignedToType === 'User' && task.assignedUserId 
                                                                                                ? task.assignedUserId.name || task.assignedUserId.username || 'Unknown User'
                                                                                                : task.assignedRoleName || 'Unknown Role'
                                                                                        }
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {task.submittedFiles && task.submittedFiles.length > 0 && (
                                                                            <div className="mt-2 pt-2 border-t">
                                                                                <p className="text-xs font-medium text-gray-600 mb-1">Submitted Files:</p>
                                                                                <ul className="list-none space-y-1">
                                                                                    {task.submittedFiles.map(file => (
                                                                                        <li key={file._id} className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                                                                                            <FileText size={14} className="inline mr-1.5 flex-shrink-0" />
                                                                                            <button
                                                                                                onClick={async () => {
                                                                                                    console.log(`Attempting download for fileId: ${file._id}, filename: ${file.filename || file.originalname}`);
                                                                                                    try {
                                                                                                        await workflowService.downloadAuthFile(file._id, file.filename || file.originalname || 'download');
                                                                                                    } catch (downloadError) {
                                                                                                        console.error("Download failed:", downloadError.message);
                                                                                                    }
                                                                                                }}
                                                                                                className="underline text-blue-600 hover:text-blue-800 cursor-pointer"
                                                                                                title={`Download ${file.filename || file.originalname}`}
                                                                                            >
                                                                                                {file.filename || file.originalname || file._id}
                                                                                            </button>
                                                                                            {file.size && <span className="ml-2 text-gray-400 text-xxs">({(file.size / 1024).toFixed(1)} KB)</span>}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!isLoading && !error && pagination.totalPages > 1 && (
                    <Pagination
                        currentPage={pagination.currentPage}
                        totalPages={pagination.totalPages}
                        totalItems={pagination.totalItems}
                        itemsPerPage={pagination.limit}
                        onPageChange={(page) => fetchMyInstances(page, statusFilter)}
                        loading={isLoading}
                        itemLabel="instances"
                        size="sm"
                    />
                )}
            </div>
        </div>
    );
};