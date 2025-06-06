import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ListChecks, AlertTriangle, Loader2, RefreshCw, ArrowLeft, FileText, ChevronDown, ChevronRight, Briefcase, Clock, UserCircle, AlertCircle, CheckCircle, XCircle, Send, Info, Settings, Users, GanttChartSquare, MessageSquare, Paperclip } from 'lucide-react';
import workflowService from '../../../lib/workflowService';
import { useAuth } from '../../../context/AuthContext';

const formatDate = (dateString, includeTime = true) => {
    if (!dateString) return 'N/A';
    try {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        if (includeTime) {
            options.hour = '2-digit';
            options.minute = '2-digit';
            options.second = '2-digit';
        }
        return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (_e) { return 'Invalid Date'; }
};

const getInstanceStatusColor = (status) => {
    switch (status) {
        case 'Not Started': return 'bg-gray-100 text-gray-800 border-gray-300';
        case 'Running': return 'bg-blue-100 text-blue-800 border-blue-300';
        case 'Completed': return 'bg-green-100 text-green-800 border-green-300';
        case 'Failed': return 'bg-red-100 text-red-800 border-red-300';
        case 'Suspended': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'WaitingForTimer': return 'bg-purple-100 text-purple-800 border-purple-300';
        case 'AwaitingFileUpload': return 'bg-sky-100 text-sky-800 border-sky-300';
        case 'WaitingForSubWorkflow': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
        case 'Terminated': return 'bg-pink-100 text-pink-800 border-pink-300';
        default: return 'bg-gray-200 text-gray-700 border-gray-400';
    }
};

const getEventTypeIcon = (eventType) => {
    switch (eventType) {
        case 'NodeExecutionStart': return <Settings size={16} className="text-blue-500 mr-2" />;
        case 'NodeExecutionEnd': return <CheckCircle size={16} className="text-green-500 mr-2" />;
        case 'NodeExecutionError':
        case 'ApiCallError':
             return <XCircle size={16} className="text-red-500 mr-2" />;
        case 'TaskCreated': return <Briefcase size={16} className="text-purple-500 mr-2" />;
        case 'TaskCompleted':
        case 'TaskApproved':
             return <CheckCircle size={16} className="text-teal-500 mr-2" />;
        case 'TaskRejected':
        case 'TaskDenied':
            return <XCircle size={16} className="text-orange-500 mr-2" />;
        case 'ApiCallSuccess': return <Send size={16} className="text-cyan-500 mr-2" />;
        case 'ContextUpdate': return <Info size={16} className="text-gray-500 mr-2" />;
        case 'LogMessageRendered': return <MessageSquare size={16} className="text-gray-400 mr-2" />;
        case 'InstanceStatusChange': return <GanttChartSquare size={16} className="text-yellow-500 mr-2" />;
        case 'ExecutionCycleStart':
        case 'ExecutionCycleEnd':
        case 'ParentResumptionStart':
        case 'ParentResumptionTrigger':
             return <RefreshCw size={16} className="text-lime-500 mr-2" />;
        case 'NodeSkipped':
        case 'ExecutionAttemptIgnored':
             return <AlertTriangle size={16} className="text-yellow-600 mr-2" />;
        case 'TimerResumed': return <Clock size={16} className="text-indigo-500 mr-2" />;
        case 'NotificationSent':
        case 'NotificationLogged':
            return <Send size={16} className="text-sky-500 mr-2" />;
        case 'FileUploadNodeAwaiting': return <Paperclip size={16} className="text-blue-400 mr-2" />;
        default: return <Info size={16} className="text-gray-500 mr-2" />;
    }
};


const InstanceDetailsPage = () => {
    const { instanceId } = useParams();
    const { user } = useAuth();

    const [instanceDetails, setInstanceDetails] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('history');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = user?.role === 'admin' 
                ? await workflowService.adminGetInstanceDetails(instanceId)
                : await workflowService.getInstanceDetails(instanceId);
            
            if (response.success) {
                setInstanceDetails(response.data);
            } else {
                throw new Error(response.message || 'Failed to fetch instance details.');
            }
        } catch (err) {
            setError(err.message || 'An error occurred while fetching instance details.');
            setInstanceDetails(null);
        } finally {
            setIsLoading(false);
        }
    }, [instanceId, user?.role]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const renderDetailsRecursive = (details, level = 0) => {
        if (details === null || details === undefined) return <span className="text-gray-500 italic text-xs">null/undefined</span>;
        if (typeof details !== 'object') {
            return <span className="text-xs text-gray-700 break-all">{String(details)}</span>;
        }
        if (Array.isArray(details)) {
            if (details.length === 0) return <span className="text-xs text-gray-500 italic">empty array</span>;
            return (
                <ul className={`pl-${level > 0 ? 2 : 0} list-disc list-inside`}>
                    {details.map((item, index) => (
                        <li key={index}>{renderDetailsRecursive(item, level + 1)}</li>
                    ))}
                </ul>
            );
        }

        return (
            <div className={`pl-${level > 0 ? 2 : 0} mt-1`}>
                {Object.entries(details).map(([key, value]) => (
                    <div key={key} className="mb-0.5">
                        <strong className="text-xs text-slate-600 capitalize mr-1">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong>
                        {renderDetailsRecursive(value, level + 1)}
                    </div>
                ))}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                <p className="ml-4 text-xl text-gray-700">Loading Instance Details...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
                <h2 className="text-xl font-semibold text-red-700">Error Fetching Instance</h2>
                <p className="text-gray-600">{error}</p>
                <Link 
                    to={user?.role === 'admin' ? "/admin/instances" : "/my-workflows"} 
                    className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                    <ArrowLeft size={18} className="inline mr-2" /> 
                    {user?.role === 'admin' ? 'Back to Instances' : 'Back to My Workflows'}
                </Link>
            </div>
        );
    }

    if (!instanceDetails) {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
                <h2 className="text-xl font-semibold text-yellow-700">Instance Not Found</h2>
                <p className="text-gray-600">The requested workflow instance could not be found.</p>
                <Link 
                    to={user?.role === 'admin' ? "/admin/instances" : "/my-workflows"} 
                    className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                    <ArrowLeft size={18} className="inline mr-2" /> 
                    {user?.role === 'admin' ? 'Back to Instances' : 'Back to My Workflows'}
                </Link>
            </div>
        );
    }

    const {
        workflowDefinitionId: wfDef,
        status,
        startedBy,
        startedAt,
        completedAt,
        context,
        executionHistory = [],
        associatedTasks = [],
        associatedIssueReports = [],
        terminationInfo,
    } = instanceDetails;

    return (
        <div className="p-4 md:p-6 lg:p-8 bg-slate-50 min-h-screen">
            <div className="mb-6">
                <Link 
                    to={user?.role === 'admin' ? "/admin/instances" : "/my-workflows"} 
                    className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center mb-2"
                >
                    <ArrowLeft size={16} className="mr-1" /> 
                    {user?.role === 'admin' ? 'Back to All Instances' : 'Back to My Workflows'}
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 truncate" title={wfDef?.name}>
                            {wfDef?.name || 'Workflow Instance'}
                        </h1>
                        <p className="text-xs text-slate-500">Instance ID: {instanceDetails._id}</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="mt-2 sm:mt-0 p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-md transition-colors"
                        title="Refresh Data"
                    >
                        <RefreshCw size={20} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 shadow rounded-lg">
                    <div className="flex items-center text-slate-500 mb-1">
                        <ListChecks size={18} className="mr-2" />
                        <h3 className="text-sm font-medium">Status</h3>
                    </div>
                    <p className={`text-lg font-semibold px-2 py-1 text-center rounded-md border ${getInstanceStatusColor(status)}`}>
                        {status}
                    </p>
                </div>
                <div className="bg-white p-4 shadow rounded-lg">
                    <div className="flex items-center text-slate-500 mb-1">
                        <UserCircle size={18} className="mr-2" />
                        <h3 className="text-sm font-medium">Started By</h3>
                    </div>
                    <p className="text-lg font-semibold text-slate-700 truncate" title={startedBy?.name || startedBy?.username || 'System'}>
                        {startedBy?.name || startedBy?.username || 'System'}
                    </p>
                </div>
                <div className="bg-white p-4 shadow rounded-lg">
                    <div className="flex items-center text-slate-500 mb-1">
                        <Clock size={18} className="mr-2" />
                        <h3 className="text-sm font-medium">Started At</h3>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">{formatDate(startedAt)}</p>
                </div>
                <div className="bg-white p-4 shadow rounded-lg">
                    <div className="flex items-center text-slate-500 mb-1">
                        <Clock size={18} className="mr-2" />
                        <h3 className="text-sm font-medium">Completed/Terminated At</h3>
                    </div>
                    <p className="text-lg font-semibold text-slate-700">
                        {completedAt ? formatDate(completedAt) : (terminationInfo?.terminatedAt ? formatDate(terminationInfo.terminatedAt) : 'N/A')}
                    </p>
                </div>
            </div>

            {terminationInfo && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-lg shadow">
                    <h3 className="text-md font-semibold text-rose-700 mb-1 flex items-center">
                        <AlertCircle size={18} className="mr-2"/>Instance Terminated
                    </h3>
                    <p className="text-sm text-rose-600"><strong>Reason:</strong> {terminationInfo.reason || 'No reason provided.'}</p>
                    <p className="text-sm text-rose-600"><strong>By:</strong> {terminationInfo.terminatedBy?.name || 'System/Unknown'}</p>
                    <p className="text-sm text-rose-600"><strong>At:</strong> {formatDate(terminationInfo.terminatedAt)}</p>
                    <p className="text-sm text-rose-600"><strong>Previous Status:</strong> {terminationInfo.previousStatus}</p>
                </div>
            )}
            
            <div className="mb-6 border-b border-slate-300">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    {['history', 'tasks', 'issues', 'context'].map((tabName) => (
                        <button
                            key={tabName}
                            onClick={() => setActiveTab(tabName)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm capitalize
                                ${activeTab === tabName
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                }`}
                        >
                            {tabName} ({tabName === 'history' ? executionHistory.length : tabName === 'tasks' ? associatedTasks.length : tabName === 'issues' ? associatedIssueReports.length : ''})
                        </button>
                    ))}
                </nav>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                {activeTab === 'history' && (
                    <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Execution History ({executionHistory.length})</h2>
                        {executionHistory.length === 0 ? (
                            <p className="text-slate-500">No execution history recorded for this instance.</p>
                        ) : (
                            <ul className="space-y-3">
                                {executionHistory.slice().reverse().map((entry, index) => (
                                    <li key={index} className="p-3 border rounded-md bg-slate-50 shadow-sm">
                                        <div className="flex items-start justify-between mb-1">
                                            <div className="flex items-center">
                                                {getEventTypeIcon(entry.eventType)}
                                                <span className="font-semibold text-sm text-slate-700">{entry.eventType}</span>
                                            </div>
                                            <span className="text-xs text-slate-500">{formatDate(entry.timestamp)}</span>
                                        </div>
                                        <p className="text-sm text-slate-600 ml-6">{entry.message || <span className="italic text-slate-400">No message</span>}</p>
                                        {entry.nodeLabel && <p className="text-xs text-slate-500 ml-6">Node: {entry.nodeLabel} ({entry.nodeId} - {entry.nodeType})</p>}
                                        {entry.statusAtEvent && <p className="text-xs text-slate-500 ml-6">Instance Status at Event: <span className={`font-medium px-1 rounded ${getInstanceStatusColor(entry.statusAtEvent)}`}>{entry.statusAtEvent}</span></p>}
                                        {entry.details && Object.keys(entry.details).length > 0 && (
                                             <details className="mt-1 ml-6 text-xs">
                                                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800">Toggle Details</summary>
                                                <div className="mt-1 p-2 bg-slate-100 rounded max-h-96 overflow-y-auto pretty-scrollbar">
                                                    {renderDetailsRecursive(entry.details)}
                                                </div>
                                            </details>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {activeTab === 'context' && (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                                </svg>
                                Instance Context
                            </h2>
                            {Object.keys(context || {}).length > 0 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                    {Object.keys(context || {}).length} {Object.keys(context || {}).length === 1 ? 'item' : 'items'}
                                </span>
                            )}
                        </div>
                        
                        {Object.keys(context || {}).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 px-4 bg-gray-50 rounded-lg border border-gray-200 text-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                <p className="text-gray-500 font-medium">Context is empty</p>
                                <p className="text-gray-400 text-sm mt-1">No context data is available for this instance</p>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute right-3 top-3 flex space-x-2">
                                    <button 
                                        className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors" 
                                        title="Copy to clipboard"
                                        onClick={() => navigator.clipboard.writeText(JSON.stringify(context, null, 2))}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 max-h-[500px] overflow-y-auto pretty-scrollbar">
                                    <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap break-all">{JSON.stringify(context, null, 2)}</pre>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'tasks' && (
                    <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Associated Tasks ({associatedTasks.length})</h2>
                        {associatedTasks.length === 0 ? (
                            <p className="text-slate-500">No tasks associated with this instance.</p>
                        ) : (
                             <ul className="space-y-3">
                                {associatedTasks.map(task => (
                                    <li key={task._id} className="p-3 border rounded-md bg-slate-50 shadow-sm">
                                        <h4 className="font-semibold text-sm text-slate-700">{task.title} <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${getInstanceStatusColor(task.status)}`}>{task.status}</span></h4>
                                        <p className="text-xs text-slate-500">Task ID: {task._id} (Node: {task.nodeId})</p>
                                        <p className="text-xs text-slate-500">Type: {task.taskType}</p>
                                        {task.assignedUserId && <p className="text-xs text-slate-500">Assigned User: {task.assignedUserId.name || task.assignedUserId.username}</p>}
                                        {task.assignedRoleName && <p className="text-xs text-slate-500">Assigned Role: {task.assignedRoleName}</p>}
                                        {task.actionedBy && <p className="text-xs text-slate-500">Actioned By: {task.actionedBy.name || task.actionedBy.username} at {formatDate(task.actionedAt)}</p>}
                                        {task.comments && <p className="text-xs text-slate-600 mt-1 italic">Comments: "{task.comments}"</p>}
                                         {task.submittedFiles && task.submittedFiles.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-slate-200">
                                                <p className="text-xs font-medium text-slate-600 mb-1">Submitted Files:</p>
                                                <ul className="list-none space-y-1">
                                                    {task.submittedFiles.map(file => (
                                                        <li key={file._id} className="text-xs text-blue-600 hover:text-blue-800 flex items-center">
                                                            <Paperclip size={14} className="inline mr-1.5 flex-shrink-0" />
                                                            <button
                                                                onClick={async () => {
                                                                    console.log(`Attempting download for fileId: ${file._id}, filename: ${file.filename || file.originalname}`);
                                                                    try {
                                                                        await workflowService.downloadAuthFile(file._id, file.filename || file.originalname || 'download');
                                                                    } catch (downloadError) {
                                                                        console.error("Download failed:", downloadError.message);
                                                                        alert(`Download failed: ${downloadError.message}`);
                                                                    }
                                                                }}
                                                                className="text-blue-600 hover:text-blue-800 underline cursor-pointer"
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
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {activeTab === 'issues' && (
                     <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">Associated Issue Reports ({associatedIssueReports.length})</h2>
                        {associatedIssueReports.length === 0 ? (
                            <p className="text-slate-500">No issue reports associated with this instance's tasks.</p>
                        ) : (
                             <ul className="space-y-3">
                                {associatedIssueReports.map(issue => (
                                    <li key={issue._id} className="p-3 border rounded-md bg-slate-50 shadow-sm">
                                        <h4 className="font-semibold text-sm text-slate-700">Issue for Task: {issue.taskId?.title || issue.taskId?._id} <span className={`ml-2 text-xs font-semibold px-1.5 py-0.5 rounded-full ${getInstanceStatusColor(issue.status)}`}>{issue.status}</span></h4>
                                        <p className="text-xs text-slate-500">Issue ID: {issue._id}</p>
                                        <p className="text-xs text-slate-600 mt-1">Description: {issue.description}</p>
                                        <p className="text-xs text-slate-500">Reported By: {issue.reportedBy?.name || issue.reportedBy?.username} at {formatDate(issue.createdAt)}</p>
                                        {issue.resolvedBy && <p className="text-xs text-slate-500">Resolved By: {issue.resolvedBy?.name || issue.resolvedBy?.username} at {formatDate(issue.resolvedAt)}</p>}
                                        {issue.resolutionDetails && <p className="text-xs text-slate-600 mt-1 italic">Resolution: "{issue.resolutionDetails}"</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstanceDetailsPage;

// Basic CSS for pretty scrollbar (add to your global CSS if preferred)
const style = document.createElement('style');
style.innerHTML = `
.pretty-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.pretty-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
}
.pretty-scrollbar::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 10px;
}
.pretty-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #a1a1a1;
}
`;
document.head.appendChild(style); 