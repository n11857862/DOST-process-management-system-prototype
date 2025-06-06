import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ListChecks, AlertTriangle, Loader2, RefreshCw, Filter, Eye, Briefcase, Users } from 'lucide-react';
import workflowService from '../../../lib/workflowService';
import { useAuth } from '../../../context/AuthContext';
import { Pagination } from '../../../components/Pagination';

const formatDate = (dateString, includeTime = true) => {
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
        default: return 'bg-gray-100 text-gray-800';
    }
};

const ALL_INSTANCE_STATUSES = [
    'Not Started', 'Running', 'Completed', 'Failed', 'Suspended',
    'WaitingForTimer', 'AwaitingFileUpload', 'WaitingForSubWorkflow', 'Terminated'
];

const AdminInstancesListPage = () => {
    const { user } = useAuth();
    const [instances, setInstances] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1, totalPages: 1, totalItems: 0, limit: 10
    });
    const [filters, setFilters] = useState({
        status: localStorage.getItem('adminInstancesStatusFilter') || '',
        workflowDefinitionId: localStorage.getItem('adminInstancesDefFilter') || '',
        startedBy: '',
    });

    const [workflowDefinitions, setWorkflowDefinitions] = useState([]);

    const fetchInstances = useCallback(async (page = 1, filtersToUse = null) => {
        setIsLoading(true);
        setError(null);
        const currentFilters = filtersToUse || filters;
        try {
            const params = {
                page,
                limit: pagination.limit,
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                status: currentFilters.status || undefined,
                workflowDefinitionId: currentFilters.workflowDefinitionId || undefined,
                startedBy: currentFilters.startedBy || undefined,
            };
            
            const response = await workflowService.adminListAllInstances(params);

            console.log("[AdminInstancesListPage] Raw response from service:", response);

            setInstances(response.data || []);
            setPagination(prev => ({
                ...prev,
                currentPage: response.currentPage || 1,
                totalPages: response.totalPages || 1,
                totalItems: response.totalInstances || 0,
            }));

            console.log("[AdminInstancesListPage] Instances set to state:", response.data || []);
            console.log("[AdminInstancesListPage] Pagination set to state:", {
                currentPage: response.currentPage || 1,
                totalPages: response.totalPages || 1,
                totalItems: response.totalInstances || 0,
            });

        } catch (err) {
            setError(err.message || "An error occurred while fetching instances.");
            setInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, [pagination.limit, filters]);

    const fetchWorkflowDefinitionsForFilter = useCallback(async () => {
        try {
            const response = await workflowService.listWorkflows({ limit: 200, sortBy: 'name', sortOrder: 'asc' });
            if (response.success) {
                setWorkflowDefinitions(response.data || []);
            }
        } catch (defError) {
            console.warn("Failed to load workflow definitions for filter dropdown:", defError.message);
        }
    }, []);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchInstances(1);
            fetchWorkflowDefinitionsForFilter();
        }
    }, [user, fetchInstances, fetchWorkflowDefinitionsForFilter]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => {
            const newFilters = { ...prev, [name]: value };
            if (name === 'status') localStorage.setItem('adminInstancesStatusFilter', value);
            if (name === 'workflowDefinitionId') localStorage.setItem('adminInstancesDefFilter', value);
            return newFilters;
        });
    };

    const applyFiltersAndRefresh = () => {
        fetchInstances(1);
    };
    
    const clearFilters = () => {
        const clearedFiltersState = { status: '', workflowDefinitionId: '', startedBy: '' };
        setFilters(clearedFiltersState);
        localStorage.removeItem('adminInstancesStatusFilter');
        localStorage.removeItem('adminInstancesDefFilter');
        fetchInstances(1, clearedFiltersState);
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchInstances(1);
        }, 500);
        return () => clearTimeout(handler);
    }, [filters.status, filters.workflowDefinitionId, filters.startedBy, fetchInstances]);


    if (!user || user.role !== 'admin') {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-semibold text-red-700">Access Denied</h2>
                <p className="text-gray-600">You do not have permission to view this page.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center">
                    <Briefcase className="mr-3 h-7 w-7 text-indigo-600" />
                    <h1 className="text-2xl font-semibold text-gray-800">All Workflow Instances</h1>
                </div>
                <button
                    onClick={() => fetchInstances(pagination.currentPage)}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md transition-colors mt-2 sm:mt-0"
                    title="Refresh List"
                    disabled={isLoading}
                >
                    <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="mb-4 p-4 bg-white rounded-lg shadow border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div>
                    <label htmlFor="statusFilter" className="block text-sm font-medium text-gray-700 mb-1">Status:</label>
                    <select
                        id="statusFilter"
                        name="status"
                        value={filters.status}
                        onChange={handleFilterChange}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                        <option value="">All Statuses</option>
                        {ALL_INSTANCE_STATUSES.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="workflowDefinitionIdFilter" className="block text-sm font-medium text-gray-700 mb-1">Workflow Definition:</label>
                    <select
                        id="workflowDefinitionIdFilter"
                        name="workflowDefinitionId"
                        value={filters.workflowDefinitionId}
                        onChange={handleFilterChange}
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                        <option value="">All Definitions</option>
                        {workflowDefinitions.map(def => (
                            <option key={def._id} value={def._id}>{def.name} (v{def.version})</option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="startedByFilter" className="block text-sm font-medium text-gray-700 mb-1">Started By (User ID):</label>
                    <input 
                        type="text"
                        id="startedByFilter"
                        name="startedBy"
                        value={filters.startedBy}
                        onChange={handleFilterChange}
                        placeholder="Enter User ID..."
                        className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>
                <div className="flex space-x-2">
                    <button 
                        onClick={applyFiltersAndRefresh} 
                        className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 text-sm flex items-center justify-center"
                        disabled={isLoading}
                    >
                        <Filter size={16} className="mr-2" /> Apply
                    </button>
                     <button 
                        onClick={clearFilters} 
                        className="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 text-sm"
                        disabled={isLoading}
                    >
                        Clear
                    </button>
                </div>
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
                {!isLoading && !error && instances.length === 0 && (
                    <p className="text-gray-500 text-center py-6">No workflow instances found matching your criteria.</p>
                )}
                {!isLoading && !error && instances.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow Name</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started By</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {instances.map((instance) => (
                                    <tr key={instance._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs" title={instance.workflowDefinitionId?.name}>
                                            {instance.workflowDefinitionId?.name || 'N/A'}
                                            <span className="text-xs text-gray-400 ml-1">(v{instance.workflowDefinitionId?.version || 'N/A'})</span>
                                            <p className="text-xxs text-gray-400 mt-0.5">ID: {instance._id}</p>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getInstanceStatusColor(instance.status)}`}>
                                                {instance.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{instance.startedBy?.name || instance.startedBy?.username || 'System'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(instance.createdAt, true)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDate(instance.updatedAt, true)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                                            <Link 
                                                to={`/admin/instances/${instance._id}`}
                                                className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 p-1 rounded-md inline-flex items-center text-xs"
                                                title="View Instance Details"
                                            >
                                                <Eye size={14} className="mr-1" /> View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.totalItems}
                    itemsPerPage={pagination.limit}
                    onPageChange={(page) => fetchInstances(page)}
                    loading={isLoading}
                    itemLabel="instances"
                    size="sm"
                />
            </div>
        </div>
    );
};

export default AdminInstancesListPage; 