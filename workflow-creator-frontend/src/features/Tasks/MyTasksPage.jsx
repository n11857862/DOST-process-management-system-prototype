import React, { useState, useEffect, useCallback } from 'react';
import {
    ListChecks, AlertTriangle, Loader2, RefreshCw, Filter, User, Eye,
    FileText as GenerateDocIcon,
    CheckCircle2,
    FileIcon,
    Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
    Type, ListOrdered, List, Link2, Heading1, Heading2, Image
} from 'lucide-react';
import { Link } from 'react-router-dom';
import workflowService from '../../lib/workflowService';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../../components/Modal';
import { TaskActionModal } from '../../components/TaskActionModal';
import { Pagination } from '../../components/Pagination';

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch { return 'Invalid Date'; }
};

const getTaskStatusColor = (status) => {
    switch (status) {
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Needs Rework': return 'bg-orange-100 text-orange-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Rejected': case 'Cancelled': case 'Failed': case 'Terminated': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
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

const DEFAULT_MY_TASKS_STATUS_FILTER = 'In Progress,Needs Rework,IssueReported';
const CLAIMED_TASK_STATUSES_FILTER = ['Pending', 'In Progress', 'Needs Rework', 'IssueReported', 'Completed', 'Rejected', 'Cancelled', 'Failed', 'Terminated'];
const HUMAN_TASK_TYPES_FOR_DOC_GEN = ['GenericTask', 'ApprovalTask', 'FileUploadPrompt'];

const formatTypes = [
    { id: 'paragraph', label: 'Paragraph', icon: <Type size={16} />, group: 'block' },
    { id: 'heading1', label: 'Heading 1', icon: <Heading1 size={16} />, group: 'block' },
    { id: 'heading2', label: 'Heading 2', icon: <Heading2 size={16} />, group: 'block' },
    { id: 'bold', label: 'Bold', icon: <Bold size={16} />, group: 'inline' },
    { id: 'italic', label: 'Italic', icon: <Italic size={16} />, group: 'inline' },
    { id: 'underline', label: 'Underline', icon: <Underline size={16} />, group: 'inline' },
    { id: 'ul', label: 'Bullet List', icon: <List size={16} />, group: 'list' },
    { id: 'ol', label: 'Numbered List', icon: <ListOrdered size={16} />, group: 'list' },
];

const availableVariables = [
    { key: 'instanceId', description: 'Workflow instance ID' },
    { key: 'workflowName', description: 'Name of the workflow' },
    { key: 'taskTitle', description: 'Title of the current task' },
    { key: 'taskStatus', description: 'Current status of the task' },
    { key: 'taskAssignee', description: 'Person assigned to the task' },
    { key: 'context.orderId', description: 'Order ID from context (if available)' },
    { key: 'context.customerName', description: 'Customer name from context (if available)' },
    { key: 'context.productDetails', description: 'Product details from context (if available)' },
    { key: 'context.requestType', description: 'Type of request from context (if available)' },
    { key: 'context.priority', description: 'Priority from context (if available)' },
];

export const MyTasksPage = () => {
    const { user: currentUser, isLoading: isAuthLoading } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [tasksError, setTasksError] = useState(null);
    const [pagination, setPagination] = useState({
        currentPage: 1, totalPages: 1, totalTasks: 0, limit: 10
    });
    const [statusFilter, setStatusFilter] = useState(localStorage.getItem('myTasksPageStatusFilter') || DEFAULT_MY_TASKS_STATUS_FILTER);

    const [isGenerateDocModalOpen, setIsGenerateDocModalOpen] = useState(false);
    const [taskForDocGen, setTaskForDocGen] = useState(null);
    const [docTemplateString, setDocTemplateString] = useState('');
    const [docGenStatus, setDocGenStatus] = useState({
        loading: false, error: null, successMessage: null
    });
    
    const [isMainTaskModalOpen, setIsMainTaskModalOpen] = useState(false);
    const [selectedTaskForMainModal, setSelectedTaskForMainModal] = useState(null);
    const [pageActionFeedback, setPageActionFeedback] = useState({ type: '', message: '' });
    
    const [docFormat, setDocFormat] = useState('txt');
    const [showPreview, setShowPreview] = useState(false);
    const [previewContent, setPreviewContent] = useState('');
    const [showVariableMenu, setShowVariableMenu] = useState(false);
    const [templateEditorRef, setTemplateEditorRef] = useState(null);
    
    const [generatedFilesToPreStage, setGeneratedFilesToPreStage] = useState([]);

    const fetchTasks = useCallback(async (page = 1, currentStatusFilter = statusFilter) => {
        if (!currentUser) {
             setIsLoadingTasks(false);
             setTasks([]);
             return;
        }
        setIsLoadingTasks(true);
        setTasksError(null);
        try {
            const params = {
                status: currentStatusFilter || CLAIMED_TASK_STATUSES_FILTER.join(','),
                limit: pagination.limit,
                page,
                sortBy: 'dueDate',
                sortOrder: 'asc',
                assignedToType: 'User',
                assignedUserId: currentUser.id
            };
            const response = await workflowService.listMyTasks(params);
            if (response.success) {
                setTasks(response.data || []);
                setPagination(prev => ({
                    ...prev,
                    currentPage: response.currentPage || 1,
                    totalPages: response.totalPages || 1,
                    totalTasks: response.totalTasks || 0,
                }));
            } else {
                throw new Error(response.message || "Failed to fetch tasks.");
            }
        } catch (err) {
            setTasksError(err.message || "An error occurred while fetching tasks.");
            setTasks([]);
        } finally {
            setIsLoadingTasks(false);
        }
    }, [currentUser, pagination.limit, statusFilter]);

    useEffect(() => {
        if (currentUser && !isAuthLoading) {
            fetchTasks(pagination.currentPage, statusFilter);
        }
    }, [currentUser, isAuthLoading, statusFilter, pagination.currentPage, fetchTasks]);

    const handleStatusFilterChange = (e) => {
        const newFilter = e.target.value;
        setStatusFilter(newFilter);
        localStorage.setItem('myTasksPageStatusFilter', newFilter);
        fetchTasks(1, newFilter);
    };

    const openMainTaskModal = (task) => {
        setSelectedTaskForMainModal(task);
        
        console.log('[MyTasksPage] Opening task modal for task:', task._id);
        console.log('[MyTasksPage] All generatedFilesToPreStage:', generatedFilesToPreStage);
        const filteredFiles = generatedFilesToPreStage.filter(f => f.forTaskId === task._id);
        console.log('[MyTasksPage] Filtered files for this task:', filteredFiles);
        
        setIsMainTaskModalOpen(true);
        setPageActionFeedback({ type: '', message: '' });
    };

    const closeMainTaskModal = () => {
        setIsMainTaskModalOpen(false);
        if (selectedTaskForMainModal) {
            setGeneratedFilesToPreStage(prev => prev.filter(f => f.forTaskId !== selectedTaskForMainModal._id));
        }
        setSelectedTaskForMainModal(null);
    };

    const handleModalTaskActionSubmit = async (actionType, taskId, payload) => {
        setPageActionFeedback({ type: 'loading', message: `Processing ${actionType}...` });
        console.log(`[MyTasksPage] Submitting task ${taskId} (action: ${actionType}) with payload from modal:`, JSON.stringify(payload, null, 2));

        let outcome = { success: false, message: `Failed to ${actionType} task.` };
        try {
            let response;
            let successMsg = '';

            if (actionType === 'complete') {    
                response = await workflowService.completeTask(taskId, payload); successMsg = 'Task completed!';    
            } else if (actionType === 'reject') {
                response = await workflowService.rejectTask(taskId, payload); successMsg = 'Task rejected!';
            } else if (actionType === 'approve') {
                response = await workflowService.approveTask(taskId, payload); successMsg = 'Task approved!';
            } else if (actionType === 'deny') {
                response = await workflowService.denyTask(taskId, payload); successMsg = 'Task denied!';
            } else if (actionType === 'markAsReviewed') {
                response = await workflowService.completeTask(taskId, payload); successMsg = 'Task marked reviewed & completed!';
            } else {
                console.error(`[MyTasksPage] Unknown task action from modal: ${actionType}`);
                throw new Error('Unknown task action from modal');
            }

            console.log(`[MyTasksPage] Raw response from workflowService.${actionType}:`, response);

            if (response && typeof response === 'object' && (response.success === true || response._id)) {
                setPageActionFeedback({ type: 'success', message: successMsg });
                outcome = { success: true, message: successMsg, data: response.data || response };
            } else if (response && response.success === false) {
                 throw new Error(response.message || `Failed to ${actionType} task.`);
            } else {
                console.warn(`[MyTasksPage] Unexpected response structure from workflowService.${actionType} for task ${taskId}`, response);
                const unexpectedMsg = `The ${actionType} action returned an unexpected response.`;
                setPageActionFeedback({ type: 'error', message: unexpectedMsg});
                outcome = { success: false, message: unexpectedMsg};
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || `An unexpected error occurred while trying to ${actionType} the task.`;
            console.error(`[MyTasksPage] Error during ${actionType} task ${taskId}:`, err);
            setPageActionFeedback({ type: 'error', message: errorMsg });
            outcome = { success: false, message: errorMsg };
        } finally {
            fetchTasks(pagination.currentPage, statusFilter);
            setTimeout(() => setPageActionFeedback({ type: '', message: '' }), 4000);
        }
        return outcome;
    };
    
    const handleModalReportIssueSubmit = async (taskId, description) => {
        setPageActionFeedback({ type: 'loading', message: 'Reporting issue...' });
        let success = false;
        try {
            const response = await workflowService.reportTaskIssue(taskId, { description });
            if (response.success) {
                setPageActionFeedback({ type: 'success', message: 'Issue reported successfully!' });
                success = true;
            } else {
                throw new Error(response.message || 'Failed to report issue.');
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Error reporting issue.';
            setPageActionFeedback({ type: 'error', message: errorMsg });
            success = false;
        } finally {
            fetchTasks(pagination.currentPage, statusFilter);
            setTimeout(() => setPageActionFeedback({ type: '', message: '' }), 4000);
        }
        return success;
    };
    
    const openGenerateDocModal = (task) => {
        setTaskForDocGen(task);
        setDocTemplateString(
`<h1>Task Details: {{taskTitle}}</h1>
<p><strong>Workflow:</strong> ${task.workflowDefinitionId?.name || 'N/A'}</p>
<p><strong>Instance ID:</strong> {{instanceId}}</p>
<p><strong>Status:</strong> {{taskStatus}}</p>
<p><strong>Assigned To:</strong> ${currentUser?.firstName || 'Me'}</p>

<h2>Additional Information</h2>
<p>Please include any relevant details below:</p>
<ul>
  <li>Order ID: {{context.orderId}}</li>
  <li>Customer: {{context.customerName}}</li>
</ul>

<p>Generated on ${new Date().toLocaleString()}</p>`
        );
        setDocGenStatus({ loading: false, error: null, successMessage: null });
        setShowPreview(false);
        setDocFormat('html');
        setIsGenerateDocModalOpen(true);
    };

    const handleFormatting = (formatType) => {
        if (!templateEditorRef) return;
        
        const editor = templateEditorRef;
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selectedText = docTemplateString.substring(start, end);
        let formattedText = '';
        
        switch(formatType) {
            case 'bold':
                formattedText = `<strong>${selectedText}</strong>`;
                break;
            case 'italic':
                formattedText = `<em>${selectedText}</em>`;
                break;
            case 'underline':
                formattedText = `<u>${selectedText}</u>`;
                break;
            case 'heading1':
                formattedText = `<h1>${selectedText}</h1>`;
                break;
            case 'heading2':
                formattedText = `<h2>${selectedText}</h2>`;
                break;
            case 'ul':
                formattedText = `<ul>\n  <li>${selectedText}</li>\n</ul>`;
                break;
            case 'ol':
                formattedText = `<ol>\n  <li>${selectedText}</li>\n</ol>`;
                break;
            case 'paragraph':
                formattedText = `<p>${selectedText}</p>`;
                break;
            default:
                formattedText = selectedText;
        }
        
        const newTemplate = docTemplateString.substring(0, start) + formattedText + docTemplateString.substring(end);
        setDocTemplateString(newTemplate);
        
        setTimeout(() => {
            editor.focus();
            editor.selectionStart = start + formattedText.length;
            editor.selectionEnd = start + formattedText.length;
        }, 0);
    };

    const insertVariable = (variable) => {
        if (!templateEditorRef) return;
        
        const editor = templateEditorRef;
        const start = editor.selectionStart;
        
        const newTemplate = 
            docTemplateString.substring(0, start) + 
            `{{${variable.key}}}` + 
            docTemplateString.substring(start);
            
        setDocTemplateString(newTemplate);
        setShowVariableMenu(false);
        
        setTimeout(() => {
            editor.focus();
            const newPosition = start + variable.key.length + 4;
            editor.selectionStart = newPosition;
            editor.selectionEnd = newPosition;
        }, 0);
    };

    const generatePreview = async () => {
        if (!taskForDocGen || !docTemplateString.trim()) return;
        
        try {
            setPreviewContent('Generating preview...');
            const genResponse = await workflowService.generateDocumentForTask(
                taskForDocGen._id, 
                docTemplateString,
                { format: docFormat }
            );
            
            if (!genResponse.success || genResponse.data?.renderedDocument === undefined) {
                throw new Error(genResponse.message || "Failed to generate preview.");
            }
            
            setPreviewContent(genResponse.data.renderedDocument);
        } catch (err) {
            setPreviewContent(`Error generating preview: ${err.message || "Unknown error"}`);
        }
    };

    const handleGeneratedFileReadyToStage = async (e) => {
        e.preventDefault();
        if (!taskForDocGen || !docTemplateString.trim()) {
            setDocGenStatus({ loading: false, error: "Template cannot be empty.", successMessage: null });
            return;
        }
        
        setDocGenStatus({ loading: true, error: null, successMessage: "Generating document..." });
        
        try {
            const genResponse = await workflowService.generateDocumentForTask(
                taskForDocGen._id, 
                docTemplateString,
                { format: docFormat }
            );
            
            if (!genResponse.success || genResponse.data?.renderedDocument === undefined) {
                throw new Error(genResponse.message || "Failed to generate document.");
            }
            
            const generatedContent = genResponse.data.renderedDocument;
            const safeTitle = taskForDocGen.title.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
            
            let fileName = '';
            let fileType = '';
            let fileContent = generatedContent;
            
            switch(docFormat) {
                case 'html':
                    fileName = `document_${safeTitle}_${Date.now()}.html`;
                    fileType = "text/html;charset=utf-8";
                    break;
                case 'pdf':
                    fileName = `document_${safeTitle}_${Date.now()}.pdf`;
                    fileType = "application/pdf";
                    break;
                case 'txt':
                default:
                    fileName = `document_${safeTitle}_${Date.now()}.txt`;
                    fileType = "text/plain;charset=utf-8";
                    break;
            }
            
            const generatedFileObject = new File([fileContent], fileName, { type: fileType });
            generatedFileObject.forTaskId = taskForDocGen._id; 

            console.log('[MyTasksPage] Generated file object:', {
                name: generatedFileObject.name,
                size: generatedFileObject.size,
                type: generatedFileObject.type,
                forTaskId: generatedFileObject.forTaskId
            });

            setGeneratedFilesToPreStage(prevFiles => {
                const otherFiles = prevFiles.filter(f => f.forTaskId !== taskForDocGen._id);
                const newFiles = [...otherFiles, generatedFileObject];
                console.log('[MyTasksPage] Updated generatedFilesToPreStage:', newFiles);
                return newFiles;
            });

            setDocGenStatus({ 
                loading: false, 
                error: null, 
                successMessage: `Document "${fileName}" generated and staged for submission.` 
            });
            
            setTimeout(() => {
                closeGenerateDocModal();
                setDocGenStatus({ loading: false, error: null, successMessage: null });
            }, 2500);

        } catch (err) {
            setDocGenStatus({
                loading: false,
                error: err.response?.data?.message || err.message || "Error generating document.",
                successMessage: null
            });
        }
    };

    useEffect(() => {
        if (showPreview) {
            const timer = setTimeout(() => {
                generatePreview();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [docTemplateString, showPreview, docFormat]);

    const closeGenerateDocModal = () => {
        setIsGenerateDocModalOpen(false);
        setTaskForDocGen(null);
        setDocTemplateString('');
    };

    if (isAuthLoading) {
        return <div className="p-8 text-center"><Loader2 className="h-8 w-8 animate-spin inline-block" /> Loading...</div>;
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                <div className="flex items-center">
                    <ListChecks className="mr-3 h-7 w-7 text-indigo-600" />
                    <h1 className="text-2xl font-semibold text-gray-800">My Claimed Tasks</h1>
                </div>
                <button
                    onClick={() => fetchTasks(pagination.currentPage, statusFilter)}
                    disabled={isLoadingTasks}
                    className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md transition-colors mt-2 sm:mt-0 disabled:opacity-50"
                    title="Refresh Tasks List"
                >
                    {isLoadingTasks ? <Loader2 size={20} className="animate-spin"/> : <RefreshCw size={20} />}
                </button>
            </div>

            <div className="mb-4 p-4 bg-white rounded-lg shadow border flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                    <Filter size={18} className="text-gray-500" />
                    <label htmlFor="myTasksStatusFilter" className="text-sm font-medium text-gray-700">Filter by Status:</label>
                    <select
                        id="myTasksStatusFilter"
                        name="statusFilter"
                        value={statusFilter}
                        onChange={handleStatusFilterChange}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                        <option value="In Progress,Needs Rework,IssueReported, Pending">My Active Work</option>
                        <option value={CLAIMED_TASK_STATUSES_FILTER.join(',')}>All My Claimed Tasks</option>
                        {CLAIMED_TASK_STATUSES_FILTER.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                {isLoadingTasks && ( <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /><p className="ml-3 text-gray-500">Loading tasks...</p></div> )}
                {tasksError && ( <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-center"><AlertTriangle className="h-5 w-5 mr-2" /> <p>Error: {tasksError}</p></div> )}
                {!isLoadingTasks && !tasksError && tasks.length === 0 && (
                    <p className="text-gray-500 text-center py-6">You have no tasks matching the current criteria.</p>
                )}
                {!isLoadingTasks && !tasksError && tasks.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Title</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Due Date</th>
                                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {tasks.map((task) => {
                                    const assignedToDisplay = "Me";
                                    const canGenerateDoc = task.taskData?.allowFileSubmission === true &&
                                                           HUMAN_TASK_TYPES_FOR_DOC_GEN.includes(task.taskType) &&
                                                           !['Completed', 'Failed', 'Cancelled', 'Terminated'].includes(task.status);
                                    return (
                                        <tr key={task._id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm font-medium text-gray-900 truncate max-w-xs" title={task.title}>{task.title}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{task.workflowDefinitionId?.name || 'N/A'}</td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(task.priority)}`}>{task.priority}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <User size={14} className="mr-1.5 text-gray-400"/>
                                                    {assignedToDisplay}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(task.createdAt, true)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(task.dueDate)}</td>
                                            <td className="px-4 py-3 text-sm text-center">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTaskStatusColor(task.status)}`}>{task.status}</span>
                                            </td>
                                            <td className="px-4 py-3 text-sm font-medium text-right space-x-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => openMainTaskModal(task)}
                                                    className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                                                    title="View & Action Task"
                                                >
                                                    <Eye size={16} className="mr-1" /> View/Action
                                                </button>
                                                {canGenerateDoc && (
                                                    <button
                                                        onClick={() => openGenerateDocModal(task)}
                                                        className="text-green-600 hover:text-green-900 inline-flex items-center"
                                                        title="Generate & Stage Document"
                                                    >
                                                        <GenerateDocIcon size={16} className="mr-1" /> Gen & Stage
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
                <Pagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.totalTasks}
                    itemsPerPage={pagination.limit}
                    onPageChange={(page) => fetchTasks(page, statusFilter)}
                    loading={isLoadingTasks}
                    itemLabel="tasks"
                    size="sm"
                />
            </div>

            {selectedTaskForMainModal && currentUser && (
                <TaskActionModal
                    isOpen={isMainTaskModalOpen}
                    onClose={closeMainTaskModal}
                    task={selectedTaskForMainModal}
                    currentUser={currentUser}
                    onTaskActionSubmit={handleModalTaskActionSubmit}
                    onReportIssueSubmit={handleModalReportIssueSubmit}
                    onAfterAction={async () => {
                        console.log("MyTasksPage: TaskActionModal onAfterAction called, refreshing tasks...");
                        await fetchTasks(pagination.currentPage, statusFilter);
                    }}
                    initialFilesToStage={generatedFilesToPreStage.filter(f => f.forTaskId === selectedTaskForMainModal._id)}
                />
            )}
            
            {isGenerateDocModalOpen && taskForDocGen && (
                <Modal
                    isOpen={isGenerateDocModalOpen}
                    onClose={!docGenStatus.loading ? closeGenerateDocModal : () => {}}
                    title={`Create Document: ${taskForDocGen.title}`}
                    size="6xl"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeGenerateDocModal}
                                disabled={docGenStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="generate-doc-form"
                                disabled={docGenStatus.loading || !docTemplateString.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {docGenStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <FileIcon size={16} className="mr-2"/>}
                                {docGenStatus.loading ? 'Generating...' : 'Generate & Stage for Submission'}
                            </button>
                        </>
                    }
                >
                    <form id="generate-doc-form" onSubmit={handleGeneratedFileReadyToStage} className="space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-sm font-medium text-gray-700">Document Format: </span>
                                <select 
                                    value={docFormat} 
                                    onChange={(e) => setDocFormat(e.target.value)}
                                    className="ml-2 p-1 text-sm border border-gray-300 rounded"
                                >
                                    <option value="txt">Plain Text (.txt)</option>
                                    <option value="html">HTML Document (.html)</option>
                                    <option value="pdf">PDF Document (.pdf)</option>
                                </select>
                            </div>
                            
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowPreview(!showPreview)}
                                    className="text-sm text-indigo-600 hover:text-indigo-800"
                                >
                                    {showPreview ? 'Hide Preview' : 'Show Preview'}
                                </button>
                            </div>
                        </div>
                        
                        <div className={`grid ${showPreview ? 'grid-cols-2 gap-4' : 'grid-cols-1'}`}>
                            <div className="space-y-3">
                                <div className="bg-white border border-gray-300 rounded-md shadow-sm p-2">
                                    <div className="text-xs font-medium text-gray-500 mb-1 pl-1">Formatting Options</div>
                                    <div className="flex flex-wrap gap-2">
                                        <div className="flex items-center border-r border-gray-300 pr-2">
                                            <span className="text-xs text-gray-500 mr-2 hidden md:inline">Block:</span>
                                            {formatTypes.filter(type => type.group === 'block').map(type => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => handleFormatting(type.id)}
                                                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors flex items-center text-gray-700"
                                                    title={type.label}
                                                >
                                                    {type.icon}
                                                    <span className="ml-1 text-xs hidden md:inline">{type.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="flex items-center border-r border-gray-300 pr-2">
                                            <span className="text-xs text-gray-500 mr-2 hidden md:inline">Style:</span>
                                            {formatTypes.filter(type => type.group === 'inline').map(type => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => handleFormatting(type.id)}
                                                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors flex items-center text-gray-700"
                                                    title={type.label}
                                                >
                                                    {type.icon}
                                                    <span className="ml-1 text-xs hidden md:inline">{type.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="flex items-center border-r border-gray-300 pr-2">
                                            <span className="text-xs text-gray-500 mr-2 hidden md:inline">List:</span>
                                            {formatTypes.filter(type => type.group === 'list').map(type => (
                                                <button
                                                    key={type.id}
                                                    type="button"
                                                    onClick={() => handleFormatting(type.id)}
                                                    className="p-1.5 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors flex items-center text-gray-700"
                                                    title={type.label}
                                                >
                                                    {type.icon}
                                                    <span className="ml-1 text-xs hidden md:inline">{type.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                        
                                        <div className="flex items-center ml-auto relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowVariableMenu(!showVariableMenu)}
                                                className={`p-2 flex items-center rounded-md border transition-colors ${
                                                    showVariableMenu 
                                                    ? 'bg-indigo-100 text-indigo-700 border-indigo-300' 
                                                    : 'bg-gray-50 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 border-gray-300'
                                                }`}
                                            >
                                                <span className="text-xs font-medium">{"{{}"} Insert Variable</span>
                                            </button>
                                            
                                            {showVariableMenu && (
                                                <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-300 rounded-md shadow-lg z-30 py-1 max-h-60 overflow-y-auto">
                                                    <div className="px-3 py-1 bg-gray-50 border-b border-gray-200 font-medium text-xs text-gray-700">
                                                        Available Variables
                                                    </div>
                                                    {availableVariables.map(variable => (
                                                        <button
                                                            key={variable.key}
                                                            type="button"
                                                            onClick={() => insertVariable(variable)}
                                                            className="flex justify-between items-center w-full text-left px-3 py-1.5 hover:bg-indigo-50 text-sm"
                                                        >
                                                            <span className="font-mono text-indigo-600">{"{{" + variable.key + "}}"}</span>
                                                            <span className="text-xs text-gray-500">{variable.description}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <textarea
                                    ref={setTemplateEditorRef}
                                    id="docTemplateString"
                                    name="docTemplateString"
                                    rows={showPreview ? 25 : 30}
                                    value={docTemplateString}
                                    onChange={(e) => setDocTemplateString(e.target.value)}
                                    onFocus={() => {}}
                                    onKeyUp={() => {}}
                                    onClick={() => {}}
                                    placeholder={docFormat === 'html' ? "<p>Enter your document content here...</p>" : "Enter your document content here..."}
                                    disabled={docGenStatus.loading}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono resize-none"
                                />
                            </div>
                            
                            {showPreview && (
                                <div className="border border-gray-300 rounded-md p-4 bg-white shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-gray-700">Document Preview</h3>
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">(Estimated)</span>
                                    </div>
                                    <div className="preview-container overflow-auto max-h-[600px] p-4 bg-white rounded border-2 border-gray-300 shadow-inner">
                                        {docFormat === 'html' ? (
                                            <div 
                                                dangerouslySetInnerHTML={{ __html: previewContent }} 
                                                className="prose prose-sm max-w-none text-gray-900 leading-relaxed"
                                                style={{ color: '#1f2937' }}
                                            />
                                        ) : (
                                            <pre className="text-sm whitespace-pre-wrap text-gray-900 font-mono leading-relaxed">{previewContent}</pre>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {docGenStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center mt-2">
                                <AlertTriangle size={18} className="mr-2"/> {docGenStatus.error}
                            </div>
                        )}
                        {docGenStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center mt-2">
                                <CheckCircle2 size={18} className="mr-2"/> {docGenStatus.successMessage}
                            </div>
                        )}
                    </form>
                </Modal>
            )}

            {pageActionFeedback.message && (
                <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg text-sm z-[100]
                    ${pageActionFeedback.type === 'success' ? 'bg-green-500 text-white' : ''}
                    ${pageActionFeedback.type === 'error' ? 'bg-red-500 text-white' : ''}
                    ${pageActionFeedback.type === 'loading' ? 'bg-blue-500 text-white' : ''}
                `}>
                    {pageActionFeedback.type === 'loading' && <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />}
                    {pageActionFeedback.message}
                </div>
            )}

            {generatedFilesToPreStage.length > 0 && (
                <div className="fixed bottom-4 left-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md shadow-lg text-xs z-[100] max-w-sm">
                    <div className="font-semibold text-yellow-800 mb-1">Debug: Staged Files ({generatedFilesToPreStage.length})</div>
                    {generatedFilesToPreStage.map((file, index) => (
                        <div key={index} className="text-yellow-700">
                            {file.name} (Task: {file.forTaskId?.substring(0, 8)}...)
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};