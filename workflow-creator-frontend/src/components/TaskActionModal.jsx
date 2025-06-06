import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/Modal';
import FileInput from '../features/Workflows/components/properties-panel/FileInput';
import workflowService from '../lib/workflowService';

import {
    Loader2, AlertTriangle, CheckCircle2, MessageSquare, ThumbsUp, ThumbsDown,
    Megaphone, FileText as FileIcon, XCircle, Paperclip, UploadCloud, DownloadCloud
} from 'lucide-react';

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) { options.hour = '2-digit'; options.minute = '2-digit'; }
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch {
        return 'Invalid Date';
    }
};

const getTaskStatusColor = (status) => {
    switch (status) {
        case 'Pending': return 'bg-yellow-100 text-yellow-800';
        case 'In Progress': return 'bg-blue-100 text-blue-800';
        case 'Needs Rework': return 'bg-orange-100 text-orange-800';
        case 'Completed': return 'bg-green-100 text-green-800';
        case 'Rejected': case 'Cancelled': case 'Failed': return 'bg-red-100 text-red-800';
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

export const TaskActionModal = ({
    isOpen,
    onClose,
    task,
    onTaskActionSubmit,
    onAfterAction,
    initialFilesToStage = [],
}) => {
    const [taskActionComment, setTaskActionComment] = useState('');
    const [taskFormData, setTaskFormData] = useState({});
    const [taskFormValidationErrors, setTaskFormValidationErrors] = useState({});
    const [stagedFiles, setStagedFiles] = useState([]);

    const [actionStatus, setActionStatus] = useState({
        loading: false, error: null, successMessage: null, actionInProgress: null
    });

    const [isReportIssueModalOpen, setIsReportIssueModalOpen] = useState(false);
    const [issueDescription, setIssueDescription] = useState('');
    const [reportIssueStatus, setReportIssueStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    useEffect(() => {
        if (isOpen && task) {
            console.log('[TaskActionModal] Modal opened for task:', task._id);
            console.log('[TaskActionModal] Received initialFilesToStage:', initialFilesToStage);
            
            setTaskActionComment('');
            
            setStagedFiles(initialFilesToStage && initialFilesToStage.length > 0 ? [...initialFilesToStage] : []);
            
            setActionStatus({ loading: false, error: null, successMessage: null, actionInProgress: null });
            
            const formFieldsDefinition = task?.taskData?.formFields || [];
            const initialFormData = {};
            if (formFieldsDefinition.length > 0) {
                formFieldsDefinition.forEach(field => {
                    initialFormData[field.key] = field.defaultValue !== undefined 
                        ? field.defaultValue 
                        : field.type === 'boolean' ? false : '';
                });
            }
            setTaskFormData(initialFormData);
            setTaskFormValidationErrors({});
        }
        if (!isOpen) {
            setIsReportIssueModalOpen(false);
            setIssueDescription('');
            setReportIssueStatus({ loading: false, error: null, successMessage: null });
        }
    }, [isOpen, task, initialFilesToStage]);

    useEffect(() => {
        let timer;
        if (actionStatus.successMessage || actionStatus.error) {
            timer = setTimeout(() => setActionStatus(prev => ({ ...prev, successMessage: null, error: null })), 4000);
        }
        return () => clearTimeout(timer);
    }, [actionStatus.successMessage, actionStatus.error]);

    useEffect(() => {
        let timer;
        if (reportIssueStatus.successMessage || reportIssueStatus.error) {
            timer = setTimeout(() => setReportIssueStatus(prev => ({ ...prev, successMessage: null, error: null })), 4000);
        }
        return () => clearTimeout(timer);
    }, [reportIssueStatus.successMessage, reportIssueStatus.error]);

    const handleTaskFormInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setTaskFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (taskFormValidationErrors[name]) {
            setTaskFormValidationErrors(prevErrors => ({ ...prevErrors, [name]: null }));
        }
    };
    
    const handleFileSelectedByInput = useCallback((fileObjectFromInput) => {
        setStagedFiles(prevFiles => {
            if (prevFiles.some(f => f.name === fileObjectFromInput.name && f.size === fileObjectFromInput.size)) {
                return prevFiles;
            }
            return [...prevFiles, fileObjectFromInput];
        });
    }, []);

    const handleRemoveStagedFile = useCallback((fileNameToRemove) => {
        setStagedFiles(prevFiles => prevFiles.filter(file => file.name !== fileNameToRemove));
    }, []);
    
    const validateDynamicForm = () => {
        if (task?.taskData?.formFields?.length > 0) {
            const newValidationErrors = {};
            let formIsValid = true;
            task.taskData.formFields.forEach(field => {
                if (field.required) {
                    const value = taskFormData[field.key];
                    if (field.type === 'boolean') {
                        if (value !== true) {
                            newValidationErrors[field.key] = `${field.label} is required to be checked.`;
                            formIsValid = false;
                        }
                    } else if (value === undefined || String(value).trim() === '') {
                        newValidationErrors[field.key] = `${field.label} is required.`;
                        formIsValid = false;
                    }
                }
            });
            setTaskFormValidationErrors(newValidationErrors);
            return formIsValid;
        }
        return true;
    };

    const handleMainAction = async (actionType) => {
        if (!task) return;

        if (actionType === 'complete' && typeof validateDynamicForm === 'function' && !validateDynamicForm()) {
            setActionStatus({ loading: false, error: 'Please fill out all required form fields.', successMessage: null, actionInProgress: null });
            return;
        }

        setActionStatus({ loading: true, error: null, successMessage: null, actionInProgress: actionType });
        
        const payload = { comments: taskActionComment };
        let finalSubmittedFileIds = [];

        if (stagedFiles.length > 0 && task?.taskData?.allowFileSubmission) {
            console.log("[TaskActionModal] Uploading staged files:", stagedFiles.map(f => f.name));
            try {
                for (const fileObj of stagedFiles) {
                    const formData = new FormData();
                    formData.append('file', fileObj);
                    const uploadResponse = await workflowService.uploadFile(formData);
                    if (uploadResponse.success && uploadResponse.data?.fileId) {
                        finalSubmittedFileIds.push(uploadResponse.data.fileId);
                    } else {
                        throw new Error(uploadResponse.message || `Failed to upload file: ${fileObj.name}`);
                    }
                }
                payload.submittedFileIds = finalSubmittedFileIds;
                console.log("[TaskActionModal] Files uploaded successfully, IDs:", finalSubmittedFileIds);
            } catch (uploadError) {
                console.error("[TaskActionModal] Error during file upload:", uploadError);
                setActionStatus({
                    loading: false,
                    error: `File upload failed: ${uploadError.message}. Please try again.`,
                    successMessage: null, actionInProgress: null
                });
                return;
            }
        }
        
        if (actionType === 'complete' && task?.taskData?.formFields?.length > 0) {
            payload.outputs = { ...taskFormData };
        }

        try {
            console.log(`[TaskActionModal] Calling onTaskActionSubmit for ${actionType}, payload:`, JSON.stringify(payload, null, 2));
            const result = await onTaskActionSubmit(actionType, task._id, payload); 
            if (result && result.success) {
                setActionStatus({ 
                    loading: false, 
                    successMessage: result.message || `Task action '${actionType}' successful!`,
                    error: null, actionInProgress: null 
                });
                if (onAfterAction) onAfterAction();
                setTimeout(() => { if (typeof onClose === 'function') onClose(); }, 1500);
            } else {
                setActionStatus({
                    loading: false,
                    error: result?.message || `Failed to ${actionType} task. Please check details.`, 
                    successMessage: null, actionInProgress: null
                });
            }
        } catch (err) {
            setActionStatus({
                loading: false,
                error: err.message || `Unexpected error in modal while ${actionType}ing.`,
                successMessage: null, actionInProgress: null
            });
        }
    };

    const openReportIssueModal = () => {
        setIssueDescription('');
        setReportIssueStatus({ loading: false, error: null, successMessage: null });
        setIsReportIssueModalOpen(true);
    };
    const closeReportIssueModal = () => setIsReportIssueModalOpen(false);

    const handleReportIssueSubmit = async (e) => {
        e.preventDefault();
        if (!task || !issueDescription.trim()) {
            setReportIssueStatus({ loading: false, error: 'Issue description cannot be empty.', successMessage: null });
            return;
        }
        setReportIssueStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.reportTaskIssue(task._id, issueDescription);
            if (response.success) {
                setReportIssueStatus({ loading: false, error: null, successMessage: response.message || 'Issue reported!' });
                if (onAfterAction) onAfterAction(); 
                setTimeout(() => {
                    closeReportIssueModal();
                }, 2000);
            } else { 
                throw new Error(response.message || 'Failed to report issue.');
            }
        } catch (err) {
            setReportIssueStatus({
                loading: false,
                error: err.message || 'Error reporting issue.',
                successMessage: null
            });
        }
    };

    if (!isOpen || !task) return null;

    const isApprovalTask = task?.nodeType === 'Approval' || task?.taskType === 'ApprovalTask';
    const isFileUploadPromptTaskType = task?.taskType === 'FileUploadPrompt' || task?.nodeType === 'FileUpload';
    const isFileReviewTask = task?.taskType === 'FileReviewTask';
    const genericTaskAllowsFileSubmission = task?.taskType === 'GenericTask' && task?.taskData?.allowFileSubmission === true;
    const canActionTask = ['Pending', 'In Progress', 'Needs Rework'].includes(task.status);

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={!actionStatus.loading ? onClose : () => {}}
                title={
                    isApprovalTask ? `Review Approval: ${task.title}` :
                    isFileUploadPromptTaskType ? `Review Attached File: ${task.title}` :
                    `Action Task: ${task.title}`
                }
                size="xl"
                footer={
                    <>
                        {canActionTask && (
                            <button
                                type="button"
                                onClick={openReportIssueModal}
                                className="mr-auto px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-md border border-yellow-300 shadow-sm disabled:opacity-50 inline-flex items-center"
                                disabled={actionStatus.loading}
                                title="Report an issue with this task"
                            >
                                <Megaphone size={16} className="mr-2"/> Report Issue
                            </button>
                        )}
                        <button type="button" onClick={onClose} disabled={actionStatus.loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm">Cancel</button>
                        {isApprovalTask ? (
                            <>
                                <button type="button" onClick={() => handleMainAction('deny')} disabled={actionStatus.loading || !canActionTask} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                    {actionStatus.loading && actionStatus.actionInProgress === 'deny' ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ThumbsDown size={16} className="mr-2"/>} Deny
                                </button>
                                <button type="button" onClick={() => handleMainAction('approve')} disabled={actionStatus.loading || !canActionTask} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                    {actionStatus.loading && actionStatus.actionInProgress === 'approve' ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ThumbsUp size={16} className="mr-2"/>} Approve
                                </button>
                            </>
                        ) : (isFileUploadPromptTaskType || isFileReviewTask) ? (
                                <button type="button" onClick={() => handleMainAction('markAsReviewed')} disabled={actionStatus.loading || !canActionTask} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                    {actionStatus.loading && actionStatus.actionInProgress === 'markAsReviewed' ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <CheckCircle2 size={16} className="mr-2"/>} Mark Reviewed & Complete
                                </button>
                        ) : (
                            <>
                                {!(genericTaskAllowsFileSubmission) && (
                                        <button type="button" onClick={() => handleMainAction('reject')} disabled={actionStatus.loading || !canActionTask} className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                            {actionStatus.loading && actionStatus.actionInProgress === 'reject' ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ThumbsDown size={16} className="mr-2"/>} Reject Task
                                        </button>
                                )}
                                <button type="button" onClick={() => handleMainAction('complete')} disabled={actionStatus.loading || !canActionTask} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                    {actionStatus.loading && actionStatus.actionInProgress === 'complete' ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <ThumbsUp size={16} className="mr-2"/>} Complete Task
                                </button>
                            </>
                        )}
                    </>
                }
            >
                <div className="space-y-4 max-h-[70vh] overflow-y-auto p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                        <div><span className="font-semibold text-gray-600">Status:</span> <span className={`font-medium px-1.5 py-0.5 rounded-full text-xs ${getTaskStatusColor(task.status)}`}>{task.status}</span></div>
                        <div><span className="font-semibold text-gray-600">Priority:</span> <span className={`font-medium px-1.5 py-0.5 rounded-full text-xs ${getPriorityColor(task.priority)}`}>{task.priority}</span></div>
                        <div><span className="font-semibold text-gray-600">Due:</span> {formatDate(task.dueDate)}</div>
                        <div><span className="font-semibold text-gray-600">Workflow:</span> {task.workflowDefinitionId?.name || 'N/A'}</div>
                         {task?.assignedToType === 'User' && task.assignedUserId && (
                            <div><span className="font-semibold text-gray-600">Assigned To:</span> {task.assignedUserId.name || 'N/A'}</div>
                        )}
                        {task?.assignedToType === 'Role' && (
                            <div><span className="font-semibold text-gray-600">Assigned Role:</span> {task.assignedRoleName || 'N/A'}</div>
                        )}
                    </div>
                    <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-600">Description:</p>
                        <p className="text-sm text-gray-700 mt-1 p-2 bg-gray-50 rounded border whitespace-pre-wrap min-h-[40px]">{task.description || "No description."}</p>
                    </div>

                    {task?.taskData?.formFields && task.taskData.formFields.length > 0 && (
                        <div className="pt-4 border-t mt-4 space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Complete Form:</h4>
                            {task.taskData.formFields.map((field) => (
                                <div key={field.key}>
                                    <label htmlFor={`form-field-${field.key}`} className="block text-xs font-medium text-gray-700 mb-1">
                                        {field.label}
                                        {field.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            id={`form-field-${field.key}`} name={field.key} rows={3}
                                            value={taskFormData[field.key] || ''} onChange={handleTaskFormInputChange}
                                            placeholder={field.placeholder || ''} disabled={actionStatus.loading}
                                            className={`w-full px-3 py-1.5 border rounded-md text-sm ${taskFormValidationErrors[field.key] ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            id={`form-field-${field.key}`} name={field.key}
                                            value={taskFormData[field.key] || ''} onChange={handleTaskFormInputChange}
                                            disabled={actionStatus.loading}
                                            className={`w-full px-3 py-1.5 border rounded-md text-sm ${taskFormValidationErrors[field.key] ? 'border-red-500' : 'border-gray-300'}`}
                                        >
                                            <option value="">-- Select {field.label} --</option>
                                            {(field.options || '').split(',').map(opt => opt.trim()).filter(opt => opt).map(optionValue => (
                                                <option key={optionValue} value={optionValue}>{optionValue}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'boolean' ? (
                                        <div className="flex items-center">
                                            <input
                                                id={`form-field-${field.key}`} name={field.key} type="checkbox"
                                                checked={!!taskFormData[field.key]} onChange={handleTaskFormInputChange}
                                                disabled={actionStatus.loading}
                                                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                        </div>
                                    ) : ( 
                                        <input
                                            id={`form-field-${field.key}`}
                                            type={field.type === 'integer' || field.type === 'float' ? 'number' : field.type || 'text'}
                                            name={field.key} value={taskFormData[field.key] || ''} onChange={handleTaskFormInputChange}
                                            placeholder={field.placeholder || ''} disabled={actionStatus.loading}
                                            step={field.type === 'float' ? 'any' : undefined}
                                            className={`w-full px-3 py-1.5 border rounded-md text-sm ${taskFormValidationErrors[field.key] ? 'border-red-500' : 'border-gray-300'}`}
                                        />
                                    )}
                                    {taskFormValidationErrors[field.key] && (
                                        <p className="mt-1 text-xs text-red-500">{taskFormValidationErrors[field.key]}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {(isFileUploadPromptTaskType && task?.taskData?.fileToReviewId) || (isFileReviewTask && task?.taskData?.attachedFileId) ? (
                        <div className="p-3 my-3 border border-blue-300 rounded-lg bg-blue-50 shadow-sm">
                            <p className="text-sm font-semibold text-blue-800 mb-2">File to Review:</p>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center text-sm text-blue-700 truncate">
                                    <FileIcon size={18} className="mr-2 flex-shrink-0 text-blue-500" />
                                    <span 
                                        className="font-medium truncate" 
                                        title={
                                            isFileReviewTask 
                                                ? (task.taskData.attachedFileName || task.taskData.attachedFileId)
                                                : (task.taskData.fileNameToReview || task.taskData.fileToReviewId)
                                        }
                                    >
                                        {isFileReviewTask 
                                            ? (task.taskData.attachedFileName || `File ID: ${task.taskData.attachedFileId.substring(0,15)}...`)
                                            : (task.taskData.fileNameToReview || `File ID: ${task.taskData.fileToReviewId.substring(0,15)}...`)
                                        }
                                    </span>
                                </div>
                                <button
                                    onClick={async () => {
                                        const fileId = isFileReviewTask ? task.taskData.attachedFileId : task.taskData.fileToReviewId;
                                        const fileName = isFileReviewTask 
                                            ? (task.taskData.attachedFileName || 'download')
                                            : (task.taskData.fileNameToReview || 'download');
                                        
                                        console.log(`Attempting download for fileId: ${fileId}, filename: ${fileName}`);
                                        try {
                                            await workflowService.downloadAuthFile(fileId, fileName);
                                        } catch (downloadError) {
                                            console.error("Download failed:", downloadError.message);
                                            alert(`Download failed: ${downloadError.message}`);
                                        }
                                    }}
                                    className="ml-3 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    <DownloadCloud size={14} className="mr-1.5" /> Download
                                </button>
                            </div>
                        </div>
                    ) : null}
                    
                    {task?.taskData?.allowFileSubmission && canActionTask && (
                        <div className="pt-3 border-t mt-3">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Attach Files:</h4>
                            <FileInput
                                label="Select file(s) to submit with this task:"
                                onFileStaged={handleFileSelectedByInput}
                                disabled={actionStatus.loading}
                                acceptedFileTypes={task?.taskData?.acceptedFileTypes || undefined}
                            />
                            {stagedFiles.length > 0 && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
                                    <div className="flex items-center mb-2">
                                        <Paperclip size={16} className="mr-2 text-blue-600 flex-shrink-0" />
                                        <p className="text-sm font-semibold text-blue-800">Files staged for submission:</p>
                                    </div>
                                    <div className="space-y-2">
                                        {stagedFiles.map((file, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-white border border-blue-200 rounded-md shadow-sm">
                                                <div className="flex items-center truncate min-w-0">
                                                    <FileIcon size={14} className="mr-2 text-blue-600 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-gray-800 truncate" title={file.name}>{file.name}</span>
                                                    <span className="ml-2 text-xs text-gray-500 flex-shrink-0">({Math.round(file.size / 1024)} KB)</span>
                                                </div>
                                                {!actionStatus.loading && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveStagedFile(file.name)}
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded flex-shrink-0 ml-2 transition-colors"
                                                        title="Remove staged file"
                                                    >
                                                        <XCircle size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {canActionTask && (
                        <div>
                            <label htmlFor="modalTaskActionComment" className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                                <MessageSquare size={16} className="mr-2 text-gray-500" /> Comments (Optional):
                            </label>
                            <textarea id="modalTaskActionComment" rows={3} value={taskActionComment} onChange={(e) => setTaskActionComment(e.target.value)} disabled={actionStatus.loading} className="w-full px-3 py-2 border rounded-md text-sm" placeholder="Optional comments for this action..."/>
                        </div>
                    )}

                    {actionStatus.successMessage && ( <div className="mt-3 text-sm text-green-600 bg-green-50 p-2 rounded-md flex items-center"><CheckCircle2 className="h-4 w-4 mr-2"/> {actionStatus.successMessage}</div> )}
                    {actionStatus.error && ( <div className="mt-3 text-sm text-red-700 bg-red-100 p-2 rounded-md flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/> {actionStatus.error}</div> )}
                </div>
            </Modal>

            {isReportIssueModalOpen && task && (
                <Modal
                    isOpen={isReportIssueModalOpen}
                    onClose={!reportIssueStatus.loading ? closeReportIssueModal : () => {}}
                    title={`Report Issue for: ${task.title}`}
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeReportIssueModal}
                                disabled={reportIssueStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                form="report-issue-form-internal" 
                                disabled={reportIssueStatus.loading || !issueDescription.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {reportIssueStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Megaphone size={16} className="mr-2" />}
                                Submit Issue
                            </button>
                        </>
                    }
                >
                    <form id="report-issue-form-internal" onSubmit={handleReportIssueSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="issueDescription" className="block text-sm font-medium text-gray-700 mb-1">
                                Issue Description: <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                id="issueDescription" name="issueDescription" rows={5}
                                value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)}
                                placeholder="Please describe the issue clearly..."
                                required disabled={reportIssueStatus.loading}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                        </div>
                        {reportIssueStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center">
                                <AlertTriangle size={18} className="mr-2" /> {reportIssueStatus.error}
                            </div>
                        )}
                        {reportIssueStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center">
                                <CheckCircle2 size={18} className="mr-2" /> {reportIssueStatus.successMessage}
                            </div>
                        )}
                    </form>
                </Modal>
            )}
        </>
    );
};