import React, { useState, useEffect, useCallback } from 'react';
import { ListFilter, AlertTriangle, Loader2, RefreshCw, MessageSquare, Edit, Eye, CheckCircle2, Filter, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import workflowService from '../../lib/workflowService';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/Modal';

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
        }
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) { return 'Invalid Date'; }
};

const MANAGEABLE_ISSUE_STATUSES = ['Open', 'Under Review', 'Pending Information', 'Escalated', 'Resolved', 'Closed'];

const getIssueStatusColor = (status) => {
    switch (status) {
        case 'Open': return 'bg-red-100 text-red-800';
        case 'Under Review': return 'bg-yellow-100 text-yellow-800';
        case 'Pending Information': return 'bg-blue-100 text-blue-800';
        case 'Resolved': return 'bg-green-100 text-green-800';
        case 'Escalated': return 'bg-purple-100 text-purple-800';
        case 'Closed': return 'bg-gray-300 text-gray-700';
        default: return 'bg-gray-100 text-gray-800';
    }
};

export const IssueManagementPage = () => {
    const { user: currentUser } = useAuth();
    const [issues, setIssues] = useState([]);
    const [isLoadingIssues, setIsLoadingIssues] = useState(true);
    const [issuesError, setIssuesError] = useState(null);
    const [issuePagination, setIssuePagination] = useState({
        currentPage: 1, totalPages: 1, totalIssues: 0, limit: 10
    });
    const [issueFilters, setIssueFilters] = useState({ status: 'Open,Under Review,Pending Information,Escalated' });
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [isViewIssueModalOpen, setIsViewIssueModalOpen] = useState(false);
    const [selectedIssueDetails, setSelectedIssueDetails] = useState(null);
    const [isLoadingIssueDetail, setIsLoadingIssueDetail] = useState(false);
    const [issueDetailError, setIssueDetailError] = useState(null);
    
    const [newComment, setNewComment] = useState('');
    const [newIssueStatus, setNewIssueStatus] = useState('');
    const [resolutionText, setResolutionText] = useState('');

    const [manageIssueActionStatus, setManageIssueActionStatus] = useState({ 
        action: null, loading: false, error: null, successMessage: null 
    });

    const fetchIssues = useCallback(async (page = 1, filters = issueFilters) => {
        setIsLoadingIssues(true);
        setIssuesError(null);
        try {
            const params = { ...filters, page, limit: issuePagination.limit, sortBy: 'createdAt', sortOrder: 'desc' };
            const response = await workflowService.listAllIssues(params);
            
            if (response && response.success) {
                setIssues(response.data || []);
                setIssuePagination(prev => ({
                    ...prev,
                    currentPage: response.currentPage || 1,
                    totalPages: response.totalPages || 1,
                    totalIssues: response.totalIssues || 0,
                }));
            } else {
                throw new Error(response?.message || "Failed to fetch issue reports.");
            }
        } catch (err) {
            setIssuesError(err.message || "An error occurred while fetching issues.");
            setIssues([]);
            setIssuePagination(prev => ({ ...prev, currentPage: 1, totalPages: 1, totalIssues: 0 }));
        } finally {
            setIsLoadingIssues(false);
        }
    }, [issuePagination.limit, issueFilters]);

    useEffect(() => {
        if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'manager')) {
            fetchIssues(1, issueFilters);
        } else {
            setIsLoadingIssues(false);
            setIssuesError("You are not authorized to view this page.");
        }
    }, [currentUser, fetchIssues, issueFilters]);

    const fetchIssueDetailsAndOpenModal = async (issueId) => {
        setIsLoadingIssueDetail(true);
        setIssueDetailError(null);
        setSelectedIssueDetails({ _id: issueId });
        setNewComment('');
        setResolutionText('');
        setManageIssueActionStatus({ action: null, loading: false, error: null, successMessage: null });

        try {
            const response = await workflowService.getIssueDetails(issueId);
            if (response.success && response.data) {
                setSelectedIssueDetails(response.data);
                setNewIssueStatus(response.data.status); 
                setIsViewIssueModalOpen(true);
            } else {
                throw new Error(response.message || "Failed to fetch issue details.");
            }
        } catch (err) {
            setIssueDetailError(err.response?.data?.message || err.message || "Error loading issue details.");
        } finally {
            setIsLoadingIssueDetail(false);
        }
    };

    const closeViewIssueModal = () => {
        setIsViewIssueModalOpen(false);
        setSelectedIssueDetails(null);
        setIssueDetailError(null);
        setManageIssueActionStatus({ action: null, loading: false, error: null, successMessage: null });
    };

    const handleAddManagerComment = async (e) => {
        e.preventDefault();
        if (!selectedIssueDetails || !newComment.trim()) {
            setManageIssueActionStatus({ action: 'comment', loading: false, error: "Comment cannot be empty.", successMessage: null });
            return;
        }
        setManageIssueActionStatus({ action: 'comment', loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.addManagerCommentToIssue(selectedIssueDetails._id, newComment);
            if (response.success && response.data) {
                setSelectedIssueDetails(response.data); 
                setNewComment(''); 
                setManageIssueActionStatus({ action: 'comment', loading: false, error: null, successMessage: "Comment added!" });
                setTimeout(() => setManageIssueActionStatus(prev => ({ ...prev, successMessage: null})), 3000);
            } else {
                throw new Error(response.message || "Failed to add comment.");
            }
        } catch (err) {
            setManageIssueActionStatus({ 
                action: 'comment', 
                loading: false, 
                error: err.response?.data?.message || err.message || "Error adding comment.",
                successMessage: null
            });
        }
    };

    const handleUpdateIssueStatus = async (e) => {
        e.preventDefault();
        if (!selectedIssueDetails || !newIssueStatus) return;

        if (newIssueStatus === 'Resolved' && !resolutionText.trim()) {
             setManageIssueActionStatus({ action: 'statusUpdate', loading: false, error: "Resolution details are required when resolving.", successMessage: null });
            return;
        }

        setManageIssueActionStatus({ action: 'statusUpdate', loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.updateIssueStatus(selectedIssueDetails._id, newIssueStatus, resolutionText);
            if (response.success && response.data) {
                setSelectedIssueDetails(response.data); 
                if (newIssueStatus === 'Resolved') setResolutionText('');
                setManageIssueActionStatus({ action: 'statusUpdate', loading: false, error: null, successMessage: "Status updated!" });
                fetchIssues(issuePagination.currentPage, issueFilters); 
                setTimeout(() => setManageIssueActionStatus(prev => ({ ...prev, successMessage: null})), 3000);
            } else {
                throw new Error(response.message || "Failed to update status.");
            }
        } catch (err) {
             setManageIssueActionStatus({ 
                action: 'statusUpdate', 
                loading: false, 
                error: err.response?.data?.message || err.message || "Error updating status.",
                successMessage: null
            });
        }
    };

    const handleFilterStatusChange = (status) => {
        const currentStatuses = issueFilters.status ? issueFilters.status.split(',') : [];
        let newStatuses;
        
        if (currentStatuses.includes(status)) {
            newStatuses = currentStatuses.filter(s => s !== status);
        } else {
            newStatuses = [...currentStatuses, status];
        }
        
        setIssueFilters({
            ...issueFilters,
            status: newStatuses.join(',')
        });
    };

    const applyFilters = () => {
        fetchIssues(1, issueFilters);
        setIsFilterOpen(false);
    };

 return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-50 min-h-full text-gray-900"> 
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                    <div className="flex items-center">
                        <AlertTriangle className="mr-3 h-7 w-7 text-orange-600" />
                        <h1 className="text-2xl font-semibold text-gray-800">Issue Reports Management</h1>
                    </div>
                    <div className="flex space-x-2 mt-3 sm:mt-0">
                        <button
                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                            className="px-3 py-2 bg-white text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-md shadow-sm transition-colors flex items-center"
                            title="Filter Issues"
                        >
                            <Filter size={16} className="mr-1.5" />
                            <span>Filter</span>
                        </button>
                        <button
                            onClick={() => fetchIssues(1, issueFilters)}
                            className="p-2 bg-white text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-300 rounded-md shadow-sm transition-colors"
                            title="Refresh Issues List"
                            disabled={isLoadingIssues}
                        >
                            <RefreshCw size={18} className={isLoadingIssues ? "animate-spin" : ""} />
                        </button>
                    </div>
                </div>

                {isFilterOpen && (
                    <div className="bg-white p-4 md:p-5 rounded-lg shadow-md mb-6 animate-fadeIn border border-gray-200">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-medium text-gray-800">Filter Issues</h3>
                            <button 
                                onClick={() => setIsFilterOpen(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                        <div className="mb-4">
                            <label className="block mb-2 text-sm font-medium text-gray-700">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {MANAGEABLE_ISSUE_STATUSES.map((status) => {
                                    const isSelected = issueFilters.status?.includes(status);
                                    return (
                                        <button
                                            key={status}
                                            onClick={() => handleFilterStatusChange(status)}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                                isSelected 
                                                    ? `${getIssueStatusColor(status)} border border-current` 
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                        >
                                            {status}
                                            {isSelected && (
                                                <span className="ml-1.5">✓</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button 
                                onClick={() => {
                                    setIssueFilters({ status: 'Open,Under Review,Pending Information,Escalated' });
                                }}
                                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded"
                            >
                                Reset
                            </button>
                            <button 
                                onClick={applyFilters}
                                className="px-4 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                    <div className="p-4 sm:p-6 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-800">Issue Reports</h2>
                        <p className="mt-1 text-sm text-gray-500">Manage and respond to workflow issues reported by users.</p>
                    </div>

                    {isLoadingIssues && (
                        <div className="flex justify-center items-center py-16">
                            <div className="flex flex-col items-center">
                                <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-3" />
                                <p className="text-gray-500 font-medium">Loading issues...</p>
                            </div>
                        </div>
                    )}
                    
                    {issuesError && (
                        <div className="m-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center">
                            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" /> 
                            <p>Error: {issuesError}</p>
                        </div>
                    )}
                    
                    {!isLoadingIssues && !issuesError && issues.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                            <Inbox className="h-12 w-12 text-gray-400 mb-3" />
                            <h3 className="text-lg font-medium text-gray-800 mb-1">No issues found</h3>
                            <p className="text-gray-500 max-w-md">No issue reports match your current criteria. Try adjusting your filters or check back later.</p>
                        </div>
                    )}
                    
                    {!isLoadingIssues && !issuesError && issues.length > 0 && (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Title</th>
                                            <th className="px-4 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                                            <th className="px-4 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported By</th>
                                            <th className="px-4 py-3.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reported At</th>
                                            <th className="px-4 py-3.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {issues.map((issue) => (
                                            <tr key={issue._id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs" title={issue.taskId?.title}>
                                                    {issue.taskId?.title || 'N/A'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {issue.workflowInstanceId?.workflowDefinitionId?.name || 'N/A'}
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{issue.reportedBy?.name || issue.reportedBy?.username || 'Unknown'}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                                                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getIssueStatusColor(issue.status)}`}>
                                                        {issue.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(issue.createdAt, true)}</td>
                                                <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                                                    <button 
                                                        onClick={() => fetchIssueDetailsAndOpenModal(issue._id)}
                                                        className="inline-flex items-center px-3 py-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                                                        title="View & Manage Issue"
                                                        disabled={isLoadingIssueDetail && selectedIssueDetails?._id === issue._id}
                                                    >
                                                        {isLoadingIssueDetail && selectedIssueDetails?._id === issue._id ? 
                                                            <Loader2 size={16} className="mr-1.5 animate-spin"/> : 
                                                            <Eye size={16} className="mr-1.5" />
                                                        }
                                                        View/Manage
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {issuePagination.totalPages > 1 && (
                                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                                    <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm text-gray-700">
                                                Showing <span className="font-medium">{Math.min((issuePagination.currentPage - 1) * issuePagination.limit + 1, issuePagination.totalIssues)}</span> to{' '}
                                                <span className="font-medium">{Math.min(issuePagination.currentPage * issuePagination.limit, issuePagination.totalIssues)}</span> of{' '}
                                                <span className="font-medium">{issuePagination.totalIssues}</span> issues
                                            </p>
                                        </div>
                                        <div>
                                            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                                <button
                                                    onClick={() => fetchIssues(issuePagination.currentPage - 1, issueFilters)}
                                                    disabled={issuePagination.currentPage <= 1 || isLoadingIssues}
                                                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:hover:bg-white"
                                                >
                                                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                                <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                                                    {issuePagination.currentPage} of {issuePagination.totalPages}
                                                </span>
                                                <button
                                                    onClick={() => fetchIssues(issuePagination.currentPage + 1, issueFilters)}
                                                    disabled={issuePagination.currentPage >= issuePagination.totalPages || isLoadingIssues}
                                                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:hover:bg-white"
                                                >
                                                    <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                            </nav>
                                        </div>
                                    </div>
                                    <div className="flex sm:hidden justify-between w-full">
                                        <button
                                            onClick={() => fetchIssues(issuePagination.currentPage - 1, issueFilters)}
                                            disabled={issuePagination.currentPage <= 1 || isLoadingIssues}
                                            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Previous
                                        </button>
                                        <span className="text-sm text-gray-700">
                                            Page {issuePagination.currentPage} of {issuePagination.totalPages}
                                        </span>
                                        <button
                                            onClick={() => fetchIssues(issuePagination.currentPage + 1, issueFilters)}
                                            disabled={issuePagination.currentPage >= issuePagination.totalPages || isLoadingIssues}
                                            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {isViewIssueModalOpen && (
                    <Modal
                        isOpen={isViewIssueModalOpen}
                        onClose={!manageIssueActionStatus.loading ? closeViewIssueModal : () => {}}
                        title={isLoadingIssueDetail && !selectedIssueDetails?.taskId ? "Loading Issue Details..." : `Manage Issue: ${selectedIssueDetails?.taskId?.title || selectedIssueDetails?._id || ''}`}
                        size="2xl"
                        footer={
                            <button
                                type="button"
                                onClick={closeViewIssueModal}
                                disabled={manageIssueActionStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                            >
                                Close
                            </button>
                        }
                    >
                        {isLoadingIssueDetail && !selectedIssueDetails?.taskId && (
                            <div className="flex justify-center items-center p-12 text-gray-700">
                                <div className="flex flex-col items-center">
                                    <Loader2 className="animate-spin h-10 w-10 text-indigo-600 mb-3"/>
                                    <p className="font-medium">Loading issue details...</p>
                                </div>
                            </div>
                        )}
                        
                        {issueDetailError && !isLoadingIssueDetail && (
                            <div className="p-4 m-4 bg-red-50 text-red-700 rounded-md border border-red-200 shadow-sm flex items-center">
                                <AlertTriangle className="h-6 w-6 mr-3 flex-shrink-0"/>
                                <p className="font-medium">{issueDetailError}</p>
                            </div>
                        )}
                        
                        {selectedIssueDetails && !isLoadingIssueDetail && selectedIssueDetails.taskId && (
                            <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto divide-y divide-gray-200 space-y-6"> 
                                <section className="pb-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900">Issue Details</h3>
                                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getIssueStatusColor(selectedIssueDetails.status)}`}>
                                            {selectedIssueDetails.status}
                                        </span>
                                    </div>
                                    
                                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Reported By</h4>
                                            <p className="text-gray-900">{selectedIssueDetails.reportedBy?.name || selectedIssueDetails.reportedBy?.username || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Reported At</h4>
                                            <p className="text-gray-900">{formatDate(selectedIssueDetails.createdAt, true)}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Task</h4>
                                            <p className="text-gray-900 font-medium">{selectedIssueDetails.taskId?.title || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-gray-500 mb-1">Workflow</h4>
                                            <p className="text-gray-900">{selectedIssueDetails.workflowInstanceId?.workflowDefinitionId?.name || 'N/A'}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5">
                                        <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                                        <div className="p-4 bg-white border border-gray-200 rounded-md whitespace-pre-wrap text-gray-800 shadow-sm min-h-[100px]">
                                            {selectedIssueDetails.description || 'No description provided.'}
                                        </div>
                                    </div>
                                </section>

                                <section className="pt-6 pb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <MessageSquare size={18} className="mr-2 text-gray-600"/>
                                            Manager Comments
                                        </h3>
                                        <span className="text-sm text-gray-500">{selectedIssueDetails.managerComments?.length || 0} comment(s)</span>
                                    </div>
                                    
                                    {selectedIssueDetails.managerComments && selectedIssueDetails.managerComments.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                            {selectedIssueDetails.managerComments.slice().reverse().map(comment => (
                                                <div key={comment._id} className="p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                                                    <p className="text-gray-800 whitespace-pre-wrap">{comment.comment}</p>
                                                    <div className="flex items-center mt-2 text-xs text-blue-600">
                                                        <span className="font-medium">{comment.commenter?.name || comment.commenter?.username || 'Admin/Manager'}</span>
                                                        <span className="mx-1.5">•</span>
                                                        <time>{formatDate(comment.createdAt, true)}</time>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                                            <p className="text-gray-500">No manager comments yet.</p>
                                        </div>
                                    )}
                                    
                                    {selectedIssueDetails.status !== 'Resolved' && selectedIssueDetails.status !== 'Closed' && (
                                      <form onSubmit={handleAddManagerComment} className="mt-5 space-y-3">
                                          <label htmlFor="newManagerComment" className="block text-sm font-medium text-gray-700">Add New Comment</label>
                                          <textarea
                                            id="newManagerComment"
                                            value={newComment}
                                            onChange={(e) => setNewComment(e.target.value)}
                                            rows="4"
                                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 resize-none"
                                            placeholder="Enter your comment here..."
                                            disabled={manageIssueActionStatus.loading && manageIssueActionStatus.action === 'comment'}
                                          />
                                          <button 
                                            type="submit" 
                                            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 shadow-sm transition-colors" 
                                            disabled={manageIssueActionStatus.loading && manageIssueActionStatus.action === 'comment'}
                                          >
                                            {manageIssueActionStatus.loading && manageIssueActionStatus.action === 'comment' ? (
                                                <>
                                                    <Loader2 size={16} className="animate-spin mr-2 flex-shrink-0"/> 
                                                    Adding Comment...
                                                </>
                                            ) : (
                                                <>
                                                    <MessageSquare size={16} className="mr-2 flex-shrink-0"/>
                                                    Add Comment
                                                </>
                                            )}
                                          </button>
                                      </form>
                                    )}
                                </section>
                                
                                {selectedIssueDetails.status !== 'Resolved' && selectedIssueDetails.status !== 'Closed' && (
                                    <form onSubmit={handleUpdateIssueStatus} className="pt-6 pb-3">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <Edit size={18} className="mr-2 text-gray-600"/>
                                            Update Issue Status
                                        </h3>
                                        
                                        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                                            <div className="mb-4">
                                                <label htmlFor="issueStatusUpdate" className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                                                <select
                                                    id="issueStatusUpdate"
                                                    value={newIssueStatus}
                                                    onChange={(e) => setNewIssueStatus(e.target.value)}
                                                    className="block w-full pl-3 pr-10 py-2 text-gray-900 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm bg-white"
                                                    disabled={manageIssueActionStatus.loading && manageIssueActionStatus.action === 'statusUpdate'}
                                                >
                                                    {MANAGEABLE_ISSUE_STATUSES.map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            
                                            {newIssueStatus === 'Resolved' && (
                                                <div className="transition-all duration-200 ease-in-out">
                                                    <label htmlFor="resolutionDetails" className="block text-sm font-medium text-gray-700 mb-1">
                                                        Resolution Details <span className="text-red-500">*</span>
                                                    </label>
                                                    <textarea
                                                        id="resolutionDetails"
                                                        value={resolutionText}
                                                        onChange={(e) => setResolutionText(e.target.value)}
                                                        rows="4" 
                                                        className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white text-gray-900 resize-none"
                                                        placeholder="Please describe how this issue was resolved..."
                                                        disabled={manageIssueActionStatus.loading && manageIssueActionStatus.action === 'statusUpdate'}
                                                    />
                                                    <p className="mt-1 text-xs text-gray-500">Required when marking an issue as resolved.</p>
                                                </div>
                                            )}
                                            
                                            <button 
                                                type="submit" 
                                                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-60 shadow-sm transition-colors" 
                                                disabled={manageIssueActionStatus.loading && manageIssueActionStatus.action === 'statusUpdate'}
                                            >
                                                {manageIssueActionStatus.loading && manageIssueActionStatus.action === 'statusUpdate' ? (
                                                    <>
                                                        <Loader2 size={16} className="animate-spin mr-2 flex-shrink-0"/> 
                                                        Updating Status...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Edit size={16} className="mr-2 flex-shrink-0"/>
                                                        Update Status
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {selectedIssueDetails.status === 'Resolved' && selectedIssueDetails.resolutionDetails && (
                                    <section className="pt-6 pb-3">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <CheckCircle2 size={18} className="mr-2 text-green-600"/>
                                            Resolution Details
                                        </h3>
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm">
                                            <div className="whitespace-pre-wrap text-gray-800">{selectedIssueDetails.resolutionDetails}</div>
                                            {selectedIssueDetails.resolvedBy && (
                                                <div className="flex items-center mt-3 text-xs text-green-600">
                                                    <span className="font-medium">Resolved by: {selectedIssueDetails.resolvedBy.name || selectedIssueDetails.resolvedBy.username}</span>
                                                    <span className="mx-1.5">•</span>
                                                    <time>{formatDate(selectedIssueDetails.resolvedAt, true)}</time>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                )}
                                
                                {selectedIssueDetails.status === 'Closed' && (
                                    <section className="pt-6 pb-3">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                            <CheckCircle2 size={18} className="mr-2 text-gray-600"/>
                                            Issue Closed
                                        </h3>
                                        <div className="p-4 bg-gray-100 border border-gray-200 rounded-lg shadow-sm flex items-center">
                                            <div className="mr-3 bg-gray-200 p-2 rounded-full">
                                                <CheckCircle2 size={24} className="text-gray-600"/>
                                            </div>
                                            <div>
                                                <p className="text-gray-700 font-medium">This issue has been closed and no further action is required.</p>
                                                {selectedIssueDetails.closedBy && (
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Closed by {selectedIssueDetails.closedBy.name || selectedIssueDetails.closedBy.username} on {formatDate(selectedIssueDetails.closedAt, true)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {(manageIssueActionStatus.action) && (manageIssueActionStatus.error || manageIssueActionStatus.successMessage) && (
                                    <div className={`mt-4 p-3 rounded-md shadow-sm flex items-center
                                        ${manageIssueActionStatus.error 
                                            ? 'text-red-700 bg-red-50 border border-red-200' 
                                            : 'text-green-700 bg-green-50 border border-green-200'}`}
                                    >
                                        {manageIssueActionStatus.error 
                                            ? <AlertTriangle size={18} className="mr-2 flex-shrink-0"/> 
                                            : <CheckCircle2 size={18} className="mr-2 flex-shrink-0"/>}
                                        <span className="font-medium">{manageIssueActionStatus.error || manageIssueActionStatus.successMessage}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>
                )}
            </div>
        </div>
    );
};