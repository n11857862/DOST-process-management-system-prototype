import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Edit3,
  PlusCircle,
  Play,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Archive,
  CheckCircle2,
  Database,
  BarChart3,
  File as FileIcon,
  Trash2,
  ListTodo,
  Ban,
  RotateCcw,
  X,
  Eye,
  Settings as ApiConfigIcon,
  XCircle,
  Link2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import workflowService from '../../lib/workflowService';
import { Modal } from '../../components/Modal';
import { useAuth } from '../../context/AuthContext';
import { Pagination } from '../../components/Pagination';

const Loading = ({ text }) => (
  <div className="flex justify-center items-center py-10 text-indigo-600">
    <Loader2 className="h-6 w-6 animate-spin" />
    <span className="ml-2 text-sm text-gray-500">{text}</span>
  </div>
);

const DismissibleAlert = ({ variant = 'error', message, onClose }) => {
  if (!message) return null;
  const base =
    variant === 'error'
      ? 'bg-red-50 border border-red-200 text-red-700'
      : 'bg-green-50 border border-green-200 text-green-700';
  return (
    <div className={`${base} p-3 rounded-md flex items-start text-sm mb-4`}>
      {variant === 'error' ? <AlertTriangle className="h-4 w-4 mt-0.5 mr-2" /> : <CheckCircle2 className="h-4 w-4 mt-0.5 mr-2" />}
      <p className="flex-1 break-words">{message}</p>
      <button onClick={onClose} className="ml-2 text-gray-400 hover:text-gray-600" aria-label="Dismiss alert">
        <X size={14} />
      </button>
    </div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-800';
    case 'Draft':
      return 'bg-yellow-100 text-yellow-800';
    case 'Archived':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getInstanceStatusColor = (status) => {
  switch (status) {
    case 'Running':
      return 'bg-blue-100 text-blue-800';
    case 'Suspended':
    case 'WaitingForTimer':
    case 'WaitingForSubWorkflow':
    case 'AwaitingFileUpload':
      return 'bg-yellow-100 text-yellow-800';
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'Failed':
    case 'Terminated':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getTaskStatusColor = (status) => {
  switch (status) {
    case 'Pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'In Progress':
      return 'bg-blue-100 text-blue-800';
    case 'Needs Rework':
      return 'bg-orange-100 text-orange-800';
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'Rejected':
    case 'Cancelled':
    case 'Failed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const API_CONFIG_PAGE_STATUSES = ['PendingApproval', 'Approved', 'Rejected', 'Archived'];
const getApiConfigStatusColor = (status) => {
    switch (status) {
        case 'PendingApproval': return 'bg-yellow-100 text-yellow-700';
        case 'Approved': return 'bg-green-100 text-green-700';
        case 'Rejected': return 'bg-red-100 text-red-700';
        case 'Archived': return 'bg-gray-100 text-gray-700';
        default: return 'bg-gray-200 text-gray-800';
    }
};


export const AdminDataManagementPage = () => {
    const { user: currentUser, loading: isAuthLoading } = useAuth();
    const navigate = useNavigate();

    const [workflows, setWorkflows] = useState([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
    const [workflowsError, setWorkflowsError] = useState(null);

    const [isStartInstanceModalOpen, setIsStartInstanceModalOpen] = useState(false);
    const [selectedWorkflowForInstance, setSelectedWorkflowForInstance] = useState(null);
    const [dynamicContextValues, setDynamicContextValues] = useState({});
    const [rawInitialContext, setRawInitialContext] = useState('{}');
    const [startInstanceStatus, setStartInstanceStatus] = useState({
        loading: false, error: null, successMessage: null,
    });

    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [workflowToArchive, setWorkflowToArchive] = useState(null);
    const [archiveStatus, setArchiveStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
    const [instanceToTerminate, setInstanceToTerminate] = useState(null);
    const [terminationReason, setTerminationReason] = useState('');
    const [terminateStatus, setTerminateStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    const [isRetryModalOpen, setIsRetryModalOpen] = useState(false);
    const [instanceToRetry, setInstanceToRetry] = useState(null);
    const [retryContextUpdates, setRetryContextUpdates] = useState('');
    const [retryStatus, setRetryStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    const [instances, setInstances] = useState([]);
    const [isLoadingInstances, setIsLoadingInstances] = useState(true);
    const [instancesError, setInstancesError] = useState(null);
    const [instancePagination, setInstancePagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalInstances: 0,
        limit: 10
    });
    const [instanceFilters, setInstanceFilters] = useState({
        status: 'Not Started,Running,Suspended,WaitingForTimer,WaitingForSubWorkflow,AwaitingFileUpload,Failed',
    });

    const [files, setFiles] = useState([]);
    const [isLoadingFiles, setIsLoadingFiles] = useState(true);
    const [filesError, setFilesError] = useState(null);
    const [filePagination, setFilePagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalFiles: 0,
        limit: 10
    });
    const [fileFilters, setFileFilters] = useState({});

    const [isFileDeleteModalOpen, setIsFileDeleteModalOpen] = useState(false);
    const [fileToDelete, setFileToDelete] = useState(null);
    const [deleteFileStatus, setDeleteFileStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    const [allTasks, setAllTasks] = useState([]);
    const [isLoadingAllTasks, setIsLoadingAllTasks] = useState(true);
    const [allTasksError, setAllTasksError] = useState(null);
    const [allTasksPagination, setAllTasksPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalTasks: 0,
        limit: 10
    });
    const [allTasksFilters, setAllTasksFilters] = useState({});

    const [isTaskDeleteModalOpen, setIsTaskDeleteModalOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState(null);
    const [deleteTaskStatus, setDeleteTaskStatus] = useState({
        loading: false, error: null, successMessage: null
    });

    const [apiConfigs, setApiConfigs] = useState([]);
    const [isLoadingApiConfigs, setIsLoadingApiConfigs] = useState(true);
    const [apiConfigsError, setApiConfigsError] = useState(null);
    const [apiConfigPagination, setApiConfigPagination] = useState({
        currentPage: 1, totalPages: 1, totalItems: 0, limit: 10
    });
    const [apiConfigFilters, setApiConfigFilters] = useState({ status: '' });

    const [isApiConfigModalOpen, setIsApiConfigModalOpen] = useState(false);
    const [editingApiConfig, setEditingApiConfig] = useState(null);
    const [apiConfigFormData, setApiConfigFormData] = useState({
        name: '', description: '', apiUrl: '', apiMethod: 'GET', headersTemplate: '{}'
    });
    const [apiConfigFormError, setApiConfigFormError] = useState(null);

    const [isApiConfigStatusModalOpen, setIsApiConfigStatusModalOpen] = useState(false);
    const [apiConfigToUpdateStatus, setApiConfigToUpdateStatus] = useState(null);
    const [newApiConfigStatus, setNewApiConfigStatus] = useState('');
    const [apiConfigAdminNotes, setApiConfigAdminNotes] = useState('');
    
    const [apiConfigActionStatus, setApiConfigActionStatus] = useState({
        loading: false, error: null, successMessage: null, action: null
    });

    const openTerminateModal = (instance) => {
        setInstanceToTerminate(instance);
        setTerminationReason('');
        setTerminateStatus({ loading: false, error: null, successMessage: null });
        setIsTerminateModalOpen(true);
    };

    const closeTerminateModal = () => {
        setIsTerminateModalOpen(false);
        setInstanceToTerminate(null);
        setTerminationReason('');
    };

    const handleConfirmTerminate = async () => {
        if (!instanceToTerminate) return;

        setTerminateStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.adminTerminateWorkflowInstance(instanceToTerminate._id, terminationReason);
            if (response.success) {
                setTerminateStatus({ loading: false, error: null, successMessage: response.message || 'Instance terminated successfully!' });
                fetchInstances(instancePagination.currentPage, instanceFilters);
                setTimeout(() => {
                    closeTerminateModal();
                    setTerminateStatus({ loading: false, error: null, successMessage: null });
                }, 2000);
            } else {
                throw new Error(response.message || 'Failed to terminate instance.');
            }
        } catch (err) {
            setTerminateStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'An error occurred during termination.',
                successMessage: null
            });
             setTimeout(() => {
                setTerminateStatus(prev => ({ ...prev, error: null })); 
            }, 5000);
        }
    };

        const openRetryModal = (instance) => {
        setInstanceToRetry(instance);
        setRetryContextUpdates('');
        setRetryStatus({ loading: false, error: null, successMessage: null });
        setIsRetryModalOpen(true);
    };

    const closeRetryModal = () => {
        setIsRetryModalOpen(false);
        setInstanceToRetry(null);
        setRetryContextUpdates('');
    };

    const handleConfirmRetry = async () => {
        if (!instanceToRetry) return;

        let parsedContextUpdates = null;
        if (retryContextUpdates.trim()) {
            try {
                parsedContextUpdates = JSON.parse(retryContextUpdates);
                if (typeof parsedContextUpdates !== 'object' || parsedContextUpdates === null) {
                    setRetryStatus({ loading: false, error: 'Context Updates must be a valid JSON object.', successMessage: null });
                    return;
                }
            } catch (e) {
                setRetryStatus({ loading: false, error: 'Invalid JSON format for Context Updates.', successMessage: null });
                return;
            }
        }

        setRetryStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.adminRetryFailedWorkflowInstance(instanceToRetry._id, parsedContextUpdates);
            if (response.success) {
                setRetryStatus({ loading: false, error: null, successMessage: response.message || 'Instance retry initiated successfully!' });
                fetchInstances(instancePagination.currentPage, instanceFilters);
                setTimeout(() => {
                    closeRetryModal();
                    setRetryStatus({ loading: false, error: null, successMessage: null });
                }, 2500);
            } else {
                throw new Error(response.message || 'Failed to retry instance.');
            }
        } catch (err) {
            setRetryStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'An error occurred during retry.',
                successMessage: null
            });
             setTimeout(() => {
                setRetryStatus(prev => ({ ...prev, error: null }));
            }, 7000);
        }
    };

    const fetchWorkflows = useCallback(async () => {
        setIsLoadingWorkflows(true);
        setWorkflowsError(null);
        setArchiveStatus({ loading: false, error: null, successMessage: null });
        try {
            const fetchedWorkflowsData = await workflowService.listWorkflows({
                status: 'Draft,Active,Archived',
                sortBy: 'updatedAt',
                sortOrder: 'desc',
                allVersions: 'true'
            });

            if (Array.isArray(fetchedWorkflowsData)) {
                setWorkflows(fetchedWorkflowsData);
            } else {
                setWorkflows([]);
            }
        } catch (err) {
            setWorkflowsError(err.message || 'Failed to fetch workflow definitions.');
        } finally {
            setIsLoadingWorkflows(false);
        }
    }, []);

    const fetchInstances = useCallback(async (page = 1, filters = instanceFilters) => {
        setIsLoadingInstances(true);
        setInstancesError(null);
        try {
            const params = {
                ...filters,
                page,
                limit: instancePagination.limit,
                sortBy: 'updatedAt',
                sortOrder: 'desc'
            };
            const response = await workflowService.listWorkflowInstances(params);
            if (response.success) {
                setInstances(response.data || []);
                setInstancePagination(prev => ({
                    ...prev,
                    currentPage: response.pagination.currentPage || 1,
                    totalPages: response.pagination.totalPages || 1,
                    totalInstances: response.pagination.totalItems || 0,
                }));
            } else {
                throw new Error(response.message || "Failed to fetch workflow instances.");
            }
        } catch (err) {
            setInstancesError(err.message || 'An error occurred while fetching instances.');
            setInstances([]);
        } finally {
            setIsLoadingInstances(false);
        }
    }, [instancePagination.limit, instanceFilters]);

    const fetchFiles = useCallback(async (page = 1, filters = fileFilters) => {
        setIsLoadingFiles(true);
        setFilesError(null);
        setDeleteFileStatus({ loading: false, error: null, successMessage: null });
        try {
            const params = {
                ...filters,
                page,
                limit: filePagination.limit,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            };
            const response = await workflowService.listAllFilesForAdmin(params);
            if (response.success) {
                setFiles(response.data || []);
                setFilePagination(prev => ({
                    ...prev,
                    currentPage: response.pagination.currentPage || 1,
                    totalPages: response.pagination.totalPages || 1,
                    totalFiles: response.pagination.totalItems || 0,
                }));
            } else {
                throw new Error(response.message || "Failed to fetch files.");
            }
        } catch (err) {
            setFilesError(err.message || 'An error occurred while fetching files.');
            setFiles([]);
        } finally {
            setIsLoadingFiles(false);
        }
    }, [filePagination.limit, fileFilters]);

    const openDeleteFileModal = (file) => {
        setFileToDelete(file);
        setDeleteFileStatus({ loading: false, error: null, successMessage: null });
        setIsFileDeleteModalOpen(true);
    };

    const closeDeleteFileModal = () => {
        setIsFileDeleteModalOpen(false);
        setFileToDelete(null);
        setDeleteFileStatus({ loading: false, error: null, successMessage: null });
    };

    const handleConfirmDeleteFile = async () => {
        if (!fileToDelete) return;

        setDeleteFileStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.deleteFileForAdmin(fileToDelete._id);
            if (response.success) {
                setDeleteFileStatus({ loading: false, error: null, successMessage: response.message || 'File deleted successfully!' });
                fetchFiles(filePagination.currentPage, fileFilters);
                setTimeout(() => {
                    closeDeleteFileModal();
                }, 2000);
            } else {
                throw new Error(response.message || 'Failed to delete file.');
            }
        } catch (err) {
            setDeleteFileStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'An error occurred during file deletion.',
                successMessage: null
            });
            setTimeout(() => {
                setDeleteFileStatus(prev => ({ ...prev, error: null }));
            }, 5000);
        }
    };

const fetchAllAdminTasks = useCallback(async (page = 1, filters = allTasksFilters) => {
    setIsLoadingAllTasks(true);
    setAllTasksError(null);
    setDeleteTaskStatus({ loading: false, error: null, successMessage: null });
    try {
        const params = {
            ...filters,
            page,
            limit: allTasksPagination.limit,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        };

        const response = await workflowService.adminListAllTasks(params);

        console.log('Response from workflowService.adminListAllTasks (actual API call):', response);

        if (response && response.success === true) {
            setAllTasks(response.data || []);

            if (typeof response.currentPage !== 'undefined' &&
                typeof response.totalPages !== 'undefined' &&
                typeof response.totalTasks !== 'undefined') {
                setAllTasksPagination(prev => ({
                    ...prev,
                    currentPage: response.currentPage || 1,
                    totalPages: response.totalPages || 1,
                    totalTasks: response.totalTasks || 0,
                }));
            } else {
                console.warn('[fetchAllAdminTasks] Expected pagination fields (currentPage, totalPages, totalTasks) are missing or invalid in API response. Using defaults. API Response:', response);
                setAllTasksPagination(prev => ({
                    ...prev,
                    currentPage: 1,
                    totalPages: 1,
                    totalTasks: Array.isArray(response.data) ? response.data.length : 0,
                }));
            }
        } else {
            const errorMessage = response?.message || "Failed to fetch tasks or API call was not successful.";
            console.error('[fetchAllAdminTasks] API call unsuccessful or invalid response:', response);
            throw new Error(errorMessage);
        }
    } catch (err) {
        console.error('[fetchAllAdminTasks] CATCH BLOCK - Error fetching tasks:', err);
        setAllTasksError(err.message || 'An error occurred while fetching tasks.');
        setAllTasks([]);
        setAllTasksPagination(prev => ({
            ...prev,
            currentPage: 1,
            totalPages: 1,
            totalTasks: 0,
            limit: allTasksPagination.limit
        }));
    } finally {
        setIsLoadingAllTasks(false);
    }
}, [allTasksPagination.limit, allTasksFilters]);

    const openDeleteTaskModal = (task) => {
        setTaskToDelete(task);
        setDeleteTaskStatus({ loading: false, error: null, successMessage: null });
        setIsTaskDeleteModalOpen(true);
    };

    const closeDeleteTaskModal = () => {
        setIsTaskDeleteModalOpen(false);
        setTaskToDelete(null);
        setDeleteTaskStatus({ loading: false, error: null, successMessage: null });
    };

    const handleConfirmDeleteTask = async () => {
        if (!taskToDelete) return;

        setDeleteTaskStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.adminDeleteTask(taskToDelete._id);
            if (response.success) {
                setDeleteTaskStatus({ loading: false, error: null, successMessage: response.message || 'Task deleted successfully!' });
                fetchAllAdminTasks(allTasksPagination.currentPage, allTasksFilters);
                setTimeout(() => {
                    closeDeleteTaskModal();
                }, 2000);
            } else {
                throw new Error(response.message || 'Failed to delete task.');
            }
        } catch (err) {
            setDeleteTaskStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'An error occurred during task deletion.',
                successMessage: null
            });
            setTimeout(() => {
                setDeleteTaskStatus(prev => ({ ...prev, error: null }));
            }, 5000);
        }
    };

    const fetchApiConfigs = useCallback(async (page = 1, filters = apiConfigFilters) => {
        setIsLoadingApiConfigs(true);
        setApiConfigsError(null);
        setApiConfigActionStatus({loading: false, error: null, successMessage: null, action: null});
        try {
            const params = { 
                ...filters, 
                page, 
                limit: apiConfigPagination.limit, 
                sortBy: 'createdAt', 
                sortOrder: 'desc' 
            };
            const response = await workflowService.adminListApiConfigs(params);
            if (response.success) {
                setApiConfigs(response.data || response.configs || []);
                setApiConfigPagination(prev => ({
                    ...prev,
                    currentPage: response.currentPage || 1,
                    totalPages: response.totalPages || 1,
                    totalItems: response.totalConfigs || response.totalItems || 0,
                }));
            } else {
                throw new Error(response.message || "Failed to fetch API configurations.");
            }
        } catch (err) {
            setApiConfigsError(err.message || "Error fetching API configurations.");
            setApiConfigs([]);
            setApiConfigPagination(prev => ({ ...prev, currentPage: 1, totalPages: 1, totalItems: 0 }));
        } finally {
            setIsLoadingApiConfigs(false);
        }
    }, [apiConfigPagination.limit, apiConfigFilters]);

    const handleApiConfigStatusFilterChange = (e) => {
        const newStatus = e.target.value;
        setApiConfigFilters(prev => ({ ...prev, status: newStatus }));
        fetchApiConfigs(1, { ...apiConfigFilters, status: newStatus });
    };

    const openCreateApiConfigModal = () => {
        setEditingApiConfig(null);
        setApiConfigFormData({ name: '', description: '', apiUrl: '', apiMethod: 'GET', headersTemplate: '{}' });
        setApiConfigFormError(null);
        setApiConfigActionStatus({ loading:false, error: null, successMessage: null, action: 'create'});
        setIsApiConfigModalOpen(true);
    };

    const openEditApiConfigModal = (config) => {
        setEditingApiConfig(config);
        setApiConfigFormData({
            name: config.name || '',
            description: config.description || '',
            apiUrl: config.apiUrl || '',
            apiMethod: config.apiMethod || 'GET',
            headersTemplate: typeof config.headersTemplate === 'object' ? JSON.stringify(config.headersTemplate, null, 2) : (config.headersTemplate || '{}')
        });
        setApiConfigFormError(null);
        setApiConfigActionStatus({ loading:false, error: null, successMessage: null, action: 'edit'});
        setIsApiConfigModalOpen(true);
    };

    const closeApiConfigModal = () => {
        setIsApiConfigModalOpen(false);
        setEditingApiConfig(null);
        setApiConfigFormError(null);
        setApiConfigActionStatus({ loading:false, error: null, successMessage: null, action: null});
    };

    const handleApiConfigFormChange = (e) => {
        const { name, value } = e.target;
        setApiConfigFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleApiConfigFormSubmit = async (e) => {
        e.preventDefault();
        setApiConfigActionStatus(prev => ({ ...prev, loading: true, error: null, successMessage: null }));
        setApiConfigFormError(null);

        let headersObject;
        try {
            headersObject = JSON.parse(apiConfigFormData.headersTemplate.trim() || '{}');
        } catch (parseError) { 
            setApiConfigFormError("Headers Template is not valid JSON.");
            setApiConfigActionStatus(prev => ({ ...prev, loading: false, error: "Invalid JSON in Headers."}));
            return;
        }
        
        const payload = { ...apiConfigFormData, headersTemplate: headersObject };

        try {
            if (editingApiConfig) {
                const response = await workflowService.adminUpdateApiConfigDetails(editingApiConfig._id, payload);
                if (!response.success) throw new Error(response.message || "Update failed");
                setApiConfigActionStatus(prev => ({ ...prev, loading: false, successMessage: "API Config updated successfully!" }));
            } else { 
                const response = await workflowService.findOrCreateApiConfig(payload);
                if (!response.success) throw new Error(response.message || "Creation failed");
                setApiConfigActionStatus(prev => ({ ...prev, loading: false, successMessage: "API Config created and awaiting approval." }));
            }
            fetchApiConfigs(apiConfigActionStatus.action === 'create' ? 1 : apiConfigPagination.currentPage, apiConfigFilters);
            setTimeout(() => { closeApiConfigModal(); }, 2000);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Operation failed.";
            setApiConfigActionStatus(prev => ({ ...prev, loading: false, error: errorMsg }));
             setTimeout(() => { setApiConfigActionStatus(prev => ({...prev, error: null})); }, 7000);
        }
    };

    const openApiConfigStatusModal = (config, targetStatus) => {
        setApiConfigToUpdateStatus(config);
        setNewApiConfigStatus(targetStatus);
        setApiConfigAdminNotes(config.adminNotes || ''); 
        setApiConfigActionStatus({loading: false, error: null, successMessage: null, action: `status-${targetStatus}`});
        setIsApiConfigStatusModalOpen(true);
    };

    const closeApiConfigStatusModal = () => {
        setIsApiConfigStatusModalOpen(false);
        setApiConfigToUpdateStatus(null);
        setApiConfigAdminNotes('');
        setApiConfigActionStatus({loading: false, error: null, successMessage: null, action: null});
    };

    const handleConfirmApiConfigStatusUpdate = async () => {
        if (!apiConfigToUpdateStatus || !newApiConfigStatus) return;
        if (newApiConfigStatus === 'Rejected' && !apiConfigAdminNotes.trim()){
            setApiConfigActionStatus(prev => ({...prev, error: "Admin notes are required for rejection."}));
            setTimeout(() => setApiConfigActionStatus(prev => ({...prev, error: null})), 5000);
            return;
        }
        setApiConfigActionStatus(prev => ({...prev, loading: true, error: null, successMessage: null}));
        try {
            const response = await workflowService.adminUpdateApiConfigStatus(apiConfigToUpdateStatus._id, newApiConfigStatus, apiConfigAdminNotes);
            if (!response.success) throw new Error(response.message || "Status update failed");
            setApiConfigActionStatus(prev => ({...prev, loading: false, successMessage: `API Config status updated to ${newApiConfigStatus}!`}));
            fetchApiConfigs(apiConfigPagination.currentPage, apiConfigFilters);
            setTimeout(() => { closeApiConfigStatusModal();}, 2000);
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Failed to update status.";
            setApiConfigActionStatus(prev => ({ ...prev, loading: false, error: errorMsg }));
            setTimeout(() => setApiConfigActionStatus(prev => ({...prev, error: null})), 7000);
        }
    };
    
    const handleCreateNewWorkflow = () => navigate('/designer');

    useEffect(() => {
      if (isAuthLoading) return; 

      if (currentUser?.role === 'admin') {
          fetchWorkflows();
          fetchInstances(1, instanceFilters); 
          fetchFiles(1, fileFilters); 
          fetchAllAdminTasks(1, allTasksFilters); 
          fetchApiConfigs(1, apiConfigFilters); 
      } else if (currentUser) {
          console.warn("Current user is not an admin. Data fetching for admin page skipped.");
          setWorkflows([]);
          setInstances([]);
          setFiles([]);
          setAllTasks([]);
          setApiConfigs([]);
      } else if (!currentUser && !isAuthLoading) {
          navigate('/login'); 
      }
  }, [
      currentUser, 
      isAuthLoading, 
      navigate, 
      fetchWorkflows, 
      fetchInstances, 
      fetchFiles, 
      fetchAllAdminTasks, 
      fetchApiConfigs
  ]);

  useEffect(() => {
    let timer;
    if (isStartInstanceModalOpen && (startInstanceStatus.successMessage || startInstanceStatus.error)) {
        timer = setTimeout(() => {
            setStartInstanceStatus(prev => ({ ...prev, successMessage: null, error: null }));
        }, 4000);
    }
    return () => clearTimeout(timer);
}, [startInstanceStatus.successMessage, startInstanceStatus.error, isStartInstanceModalOpen]);


if (isAuthLoading) {
    return <Loading text="Authenticating user..." />;
}
if (!currentUser || currentUser.role !== 'admin') {
    return (
        <div className="p-8 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-orange-400" />
            <h2 className="mt-2 text-lg font-medium text-gray-900">Access Denied</h2>
            <p className="mt-1 text-sm text-gray-500">You do not have permission to view this page.</p>
            <button onClick={() => navigate('/')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                Go to Homepage
            </button>
        </div>
    );
}


    const openStartInstanceModal = (workflow) => {
        setSelectedWorkflowForInstance(workflow);
        setStartInstanceStatus({ loading: false, error: null, successMessage: null });
        const initialValues = {};
        if (workflow.expectedContextFields && workflow.expectedContextFields.length > 0) {
            workflow.expectedContextFields.forEach(field => {
                initialValues[field.key] = field.defaultValue || '';
            });
            setDynamicContextValues(initialValues);
            setRawInitialContext('');
        } else {
            setDynamicContextValues({});
            setRawInitialContext('{}');
        }
        setIsStartInstanceModalOpen(true);
    };
    const closeStartInstanceModal = () => { setIsStartInstanceModalOpen(false); setSelectedWorkflowForInstance(null); setDynamicContextValues({}); setRawInitialContext('{}'); setStartInstanceStatus({ loading: false, error: null, successMessage: null }); };
    const handleDynamicContextChange = (key, value) => setDynamicContextValues(prev => ({ ...prev, [key]: value }));
    const handleStartInstance = async () => {
        if (!selectedWorkflowForInstance) return;
        let contextToSend = {};
        const hasDefinedFields = selectedWorkflowForInstance.expectedContextFields && selectedWorkflowForInstance.expectedContextFields.length > 0;
        if (hasDefinedFields) {
            contextToSend = { ...dynamicContextValues };
        } else {
            try { contextToSend = JSON.parse(rawInitialContext); } catch (e) {
                setStartInstanceStatus({ loading: false, error: 'Invalid JSON in Initial Context.', successMessage: null }); return;
            }
        }
        setStartInstanceStatus({ loading: true, error: null, successMessage: null });
        try {
            const newInstance = await workflowService.startWorkflowInstance(selectedWorkflowForInstance._id, contextToSend);
            setStartInstanceStatus({ loading: false, error: null, successMessage: `Instance started! ID: ${newInstance?._id || 'N/A'}` });
        } catch (err) {
            setStartInstanceStatus({ loading: false, error: err.response?.data?.message || err.message || 'Failed to start instance.', successMessage: null });
        }
    };
    useEffect(() => {
        let timer;
        if (isStartInstanceModalOpen && (startInstanceStatus.successMessage || startInstanceStatus.error)) {
            timer = setTimeout(() => {
                setStartInstanceStatus(prev => ({ ...prev, successMessage: null, error: null }));
            }, 4000);
        }
        return () => clearTimeout(timer);
    }, [startInstanceStatus.successMessage, startInstanceStatus.error, isStartInstanceModalOpen]);

    const openArchiveModal = (workflow) => {
        setWorkflowToArchive(workflow);
        setArchiveStatus({ loading: false, error: null, successMessage: null });
        setIsArchiveModalOpen(true);
    };
    const closeArchiveModal = () => {
        setIsArchiveModalOpen(false);
        setWorkflowToArchive(null);
        setArchiveStatus({ loading: false, error: null, successMessage: null });
    };
    const handleConfirmArchive = async () => {
        if (!workflowToArchive) return;
        setArchiveStatus({ loading: true, error: null, successMessage: null });
        try {
            const response = await workflowService.archiveWorkflowDefinition(workflowToArchive._id);
            if (response.success) {
                setArchiveStatus({ loading: false, error: null, successMessage: response.message || 'Workflow archived successfully!' });
                fetchWorkflows();
                setTimeout(() => {
                    closeArchiveModal();
                }, 2000);
            } else {
                throw new Error(response.message || 'Failed to archive workflow.');
            }
        } catch (err) {
            setArchiveStatus({
                loading: false,
                error: err.response?.data?.message || err.message || 'An error occurred during archiving.',
                successMessage: null
            });
            setTimeout(() => {
                setArchiveStatus(prev => ({ ...prev, error: null }));
            }, 5000);
        }
    };


return (
    <div className="p-4 md:p-6 lg:p-8 bg-gray-100 min-h-full">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
        <h1 className="flex items-center text-2xl font-semibold text-gray-800">
          <Database className="mr-3 h-7 w-7 text-indigo-600" /> Admin Data Management
        </h1>
      </header>

<section className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h2 className="text-xl font-semibold text-gray-700 flex items-center">
            <FileText className="mr-2 h-6 w-6 text-gray-500" /> Workflow Definitions
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchWorkflows()}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md"
              title="Refresh Definitions"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={() => navigate('/designer')}
              className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
            >
              <PlusCircle size={16} /> Create New
            </button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
          {isLoadingWorkflows && <Loading text="Loading definitions…" />}
          <DismissibleAlert variant="error" message={workflowsError} onClose={() => setWorkflowsError(null)} />
          {!isLoadingWorkflows && !workflowsError && workflows.length === 0 && (
            <p className="text-gray-500 text-center py-6">No workflow definitions found.</p>
          )}

          {!isLoadingWorkflows && !workflowsError && workflows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Version</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workflows.map((wf) => (
                    <tr key={wf._id} className={`hover:bg-gray-50 ${wf.status === 'Archived' ? 'opacity-60 bg-gray-100' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{wf.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(wf.status)}`}>{wf.status || 'Draft'}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        v{wf.version} {wf.isLatestVersion && <span className="ml-1 text-blue-500 text-xs">(Latest)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(wf.updatedAt || wf.createdAt)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-2">
                        <Link
                          to={`/designer/${wf._id}`}
                          className="text-indigo-600 hover:text-indigo-900 inline-flex items-center gap-1"
                        >
                          <Edit3 size={14} /> Edit
                        </Link>
                        {wf.status !== 'Archived' && (
                          <button
                            onClick={() => openStartInstanceModal(wf)}
                            title="Start Instance"
                            disabled={wf.status !== 'Active'}
                            className={`inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-xs disabled:opacity-40`}
                          >
                            <Play size={14} /> Start
                          </button>
                        )}
                        {wf.status !== 'Archived' && (
                          <button
                            onClick={() => openArchiveModal(wf)}
                            title="Archive Workflow"
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs"
                          >
                            <Archive size={14} /> Archive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h2 className="text-xl font-semibold text-gray-700 flex items-center">
            <BarChart3 className="mr-2 h-6 w-6 text-gray-500" /> Workflow Instances
          </h2>
          <div className="flex items-center gap-2 relative">
            <select
              value={instanceFilters.status}
              onChange={(e) => setInstanceFilters({ ...instanceFilters, status: e.target.value })}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-gray-50 text-gray-700 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Not Started,Running,Suspended,WaitingForTimer,WaitingForSubWorkflow,AwaitingFileUpload,Failed">All Active</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
              <option value="Terminated">Terminated</option>
            </select>
            <button
              onClick={() => fetchInstances(1, instanceFilters)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md"
              title="Refresh Instances"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
          {isLoadingInstances && <Loading text="Loading instances…" />}
          <DismissibleAlert variant="error" message={instancesError} onClose={() => setInstancesError(null)} />
          {!isLoadingInstances && !instancesError && instances.length === 0 && (
            <p className="text-gray-500 text-center py-6">No workflow instances found.</p>
          )}

          {!isLoadingInstances && !instancesError && instances.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Workflow Name</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Instance ID</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Started By</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Started At</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {instances.map((instance) => (
                    <tr key={instance._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">
                        {instance.workflowDefinitionId?.name || 'N/A'}
                        {instance.workflowDefinitionId?.version && <span className="ml-1 text-xs text-gray-400">v{instance.workflowDefinitionId.version}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap" title={instance._id}>
                        {instance._id.slice(0, 8)}…{instance._id.slice(-4)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getInstanceStatusColor(instance.status)}`}>{instance.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{instance.startedBy?.name || instance.startedBy?.username || 'System'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(instance.startedAt, true)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(instance.updatedAt, true)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right space-x-2 text-xs">
                        {instance.status !== 'Completed' && instance.status !== 'Failed' && instance.status !== 'Terminated' && (
                          <button
                            onClick={() => openTerminateModal(instance)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 border border-red-300 rounded px-2 py-0.5"
                          >
                            <Ban size={12} /> Terminate
                          </button>
                        )}
                        {currentUser?.role === 'admin' && instance.status === 'Failed' && (
                          <button
                            onClick={() => openRetryModal(instance)}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 border border-green-300 rounded px-2 py-0.5"
                          >
                            <RotateCcw size={12} /> Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            label="instances"
            currentPage={instancePagination.currentPage}
            totalPages={instancePagination.totalPages}
            totalItems={instancePagination.totalInstances}
            onPageChange={(p) => fetchInstances(p, instanceFilters)}
            loading={isLoadingInstances}
          />
        </div>
      </section>

      <section className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h2 className="text-xl font-semibold text-gray-700 flex items-center">
            <FileIcon className="mr-2 h-6 w-6 text-gray-500" /> Uploaded Files
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search filename…"
              value={fileFilters.search || ''}
              onChange={(e) => setFileFilters({ ...fileFilters, search: e.target.value })}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-gray-50 text-gray-800 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={() => fetchFiles(1, fileFilters)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md"
              title="Refresh Files List"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
          {isLoadingFiles && <Loading text="Loading files…" />}
          <DismissibleAlert variant="error" message={filesError} onClose={() => setFilesError(null)} />
          {!isLoadingFiles && !filesError && files.length === 0 && (
            <p className="text-gray-500 text-center py-6">No files found.</p>
          )}

          {!isLoadingFiles && !filesError && files.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">MIME</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Size</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Uploaded By</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Uploaded At</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {files.map((file) => (
                    <tr key={file._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 truncate max-w-xs" title={file.filename}>{file.filename}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{file.mimetype}</td>
                      <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap">{(file.size / 1024).toFixed(2)} KB</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{file.uploadedBy?.name || file.uploadedBy?.username || 'Unknown'}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(file.createdAt, true)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => openDeleteFileModal(file)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={filePagination.currentPage}
            totalPages={filePagination.totalPages}
            totalItems={filePagination.totalFiles}
            itemsPerPage={filePagination.limit}
            onPageChange={(p) => fetchFiles(p, fileFilters)}
            loading={isLoadingFiles}
            itemLabel="files"
            size="sm"
          />
        </div>
      </section>


      <section className="mb-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
          <h2 className="text-xl font-semibold text-gray-700 flex items-center">
            <ListTodo className="mr-2 h-6 w-6 text-gray-500" /> All System Tasks
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={allTasksFilters.status || ''}
              onChange={(e) => setAllTasksFilters({ ...allTasksFilters, status: e.target.value })}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-gray-50 text-gray-700 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Needs Rework">Needs Rework</option>
              <option value="Completed">Completed</option>
              <option value="Failed">Failed</option>
            </select>
            <button
              onClick={() => fetchAllAdminTasks(1, allTasksFilters)}
              className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md"
              title="Refresh Tasks List"
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
          {isLoadingAllTasks && <Loading text="Loading tasks…" />}
          <DismissibleAlert variant="error" message={allTasksError} onClose={() => setAllTasksError(null)} />
          {!isLoadingAllTasks && !allTasksError && allTasks.length === 0 && (
            <p className="text-gray-500 text-center py-6">No tasks found.</p>
          )}

          {!isLoadingAllTasks && !allTasksError && allTasks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Instance ID</th>
                    <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                    <th className="px-4 py-3 font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {allTasks.map((task) => {
                    const assignee =
                      task.assignedToType === 'User'
                        ? task.assignedUserId?.name || task.assignedUserId?.username || 'N/A'
                        : `${task.assignedRoleName} (Role)`;
                    return (
                      <tr key={task._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 truncate max-w-xs" title={task.title}>{task.title}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{task.workflowDefinitionId?.name || 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap" title={task.workflowInstanceId?._id}>
                          {task.workflowInstanceId?._id ? `${task.workflowInstanceId._id.slice(0, 8)}…${task.workflowInstanceId._id.slice(-4)}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getTaskStatusColor(task.status)}`}>{task.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{assignee}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(task.createdAt, true)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => openDeleteTaskModal(task)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 text-xs"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <Pagination
            currentPage={allTasksPagination.currentPage}
            totalPages={allTasksPagination.totalPages}
            totalItems={allTasksPagination.totalTasks}
            itemsPerPage={allTasksPagination.limit}
            onPageChange={(p) => fetchAllAdminTasks(p, allTasksFilters)}
            loading={isLoadingAllTasks}
            itemLabel="tasks"
            size="sm"
          />
        </div>
      </section>
            <section className="mb-10">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-700 flex items-center">
                        <ApiConfigIcon className="mr-2 h-6 w-6 text-gray-500" />
                        API Connection Configurations
                    </h2>
                    <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                        <button 
                            onClick={openCreateApiConfigModal} 
                            className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm"
                        >
                            <PlusCircle size={16} className="mr-1"/> Create New
                        </button>
                        <button 
                            onClick={() => fetchApiConfigs(1, apiConfigFilters)} 
                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-gray-200 rounded-md transition-colors" 
                            title="Refresh API Configs"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
                
                <div className="mb-4 p-3 bg-gray-50 rounded-md border">
                    <label htmlFor="apiConfigStatusFilter" className="text-xs font-medium text-gray-700 mr-2">Filter by Status:</label>
                    <select 
                        id="apiConfigStatusFilter" 
                        value={apiConfigFilters.status} 
                        onChange={handleApiConfigStatusFilterChange} 
                        className="text-sm border-gray-300 rounded-md px-3 py-2 bg-white text-gray-800 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                    >
                        <option value="">All</option>
                        {API_CONFIG_PAGE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                    {isLoadingApiConfigs && <Loading text="Loading API configurations..." />}
                    <DismissibleAlert variant="error" message={apiConfigsError} onClose={() => setApiConfigsError(null)} />
                     {!isLoadingApiConfigs && !apiConfigsError && apiConfigs.length === 0 && (
                        <p className="text-gray-500 text-center py-6">No API configurations found for the selected filters.</p>
                    )}
                    {!isLoadingApiConfigs && !apiConfigsError && apiConfigs.length > 0 && (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-xs truncate">Endpoint URL</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Requested By</th>
                                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {apiConfigs.map((config) => (
                                        <tr key={config._id} className="hover:bg-gray-50">
                                            <td className="px-3 py-3 font-medium text-gray-900 whitespace-nowrap" title={config.description || config.name}>{config.name}</td>
                                            <td className="px-3 py-3 text-gray-500 truncate max-w-xs" title={config.apiUrl}>{config.apiUrl}</td>
                                            <td className="px-3 py-3 text-gray-500 text-center">{config.apiMethod}</td>
                                            <td className="px-3 py-3 text-center">
                                                <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getApiConfigStatusColor(config.status)}`}>{config.status}</span>
                                            </td>
                                            <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{config.requestedBy?.name || config.requestedBy?.username || 'N/A'}</td>
                                            <td className="px-3 py-3 text-gray-500 whitespace-nowrap">{formatDate(config.updatedAt, true)}</td>
                                            <td className="px-3 py-3 text-right font-medium space-x-1 whitespace-nowrap">
                                                <button onClick={() => openEditApiConfigModal(config)} className="text-indigo-600 hover:text-indigo-800 p-1" title="Edit Config"><Edit3 size={14}/></button>
                                                {config.status === 'PendingApproval' && (
                                                    <>
                                                        <button onClick={() => openApiConfigStatusModal(config, 'Approved')} className="text-green-600 hover:text-green-800 p-1" title="Approve Config"><CheckCircle2 size={14}/></button>
                                                        <button onClick={() => openApiConfigStatusModal(config, 'Rejected')} className="text-red-600 hover:text-red-800 p-1" title="Reject Config"><XCircle size={14}/></button>
                                                    </>
                                                )}
                                                {config.status !== 'Archived' && config.status !== 'PendingApproval' && (
                                                     <button onClick={() => openApiConfigStatusModal(config, 'Archived')} className="text-gray-500 hover:text-gray-700 p-1" title="Archive Config"><Archive size={14}/></button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pagination
                        label="API configs"
                        currentPage={apiConfigPagination.currentPage}
                        totalPages={apiConfigPagination.totalPages}
                        totalItems={apiConfigPagination.totalItems}
                        onPageChange={(p) => fetchApiConfigs(p, apiConfigFilters)}
                        loading={isLoadingApiConfigs}
                    />
                </div>
            </section> 


            {selectedWorkflowForInstance && (
                <Modal
                    isOpen={isStartInstanceModalOpen}
                    onClose={closeStartInstanceModal}
                    title={`Start Instance: ${selectedWorkflowForInstance?.name || ''}`}
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeStartInstanceModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md border border-gray-300"
                                disabled={startInstanceStatus.loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleStartInstance}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 flex items-center"
                                disabled={startInstanceStatus.loading}
                            >
                                {startInstanceStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Play size={16} className="mr-2" />}
                                Confirm Start
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        {selectedWorkflowForInstance?.expectedContextFields && selectedWorkflowForInstance.expectedContextFields.length > 0 ? (
                            <>
                                <p className="text-sm text-gray-600">
                                    Please provide the initial context variables for this workflow:
                                </p>
                                {selectedWorkflowForInstance.expectedContextFields.map((field, index) => (
                                    <div key={field.key || index}>
                                        <label htmlFor={`dynCtx-${field.key}`} className="block text-xs font-medium text-gray-700 mb-1">
                                            {field.label}:
                                        </label>
                                        <input
                                            type="text"
                                            id={`dynCtx-${field.key}`}
                                            name={field.key}
                                            value={dynamicContextValues[field.key] || ''}
                                            onChange={(e) => handleDynamicContextChange(field.key, e.target.value)}
                                            placeholder={field.defaultValue || `Enter ${field.label.toLowerCase()}`}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                                            disabled={startInstanceStatus.loading}
                                        />
                                    </div>
                                ))}
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600">
                                    Provide the initial context for this workflow instance as a JSON object (or leave as {'{}'} for empty context).
                                </p>
                                <textarea
                                    id="initialContext"
                                    name="initialContext"
                                    rows={6}
                                    value={rawInitialContext}
                                    onChange={(e) => setRawInitialContext(e.target.value)}
                                    placeholder={'{\n  "key": "value",\n  "anotherKey": 123\n}'}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white text-gray-900"
                                    disabled={startInstanceStatus.loading}
                                />
                            </>
                        )}
                        {startInstanceStatus.successMessage && (
                            <div className="mt-2 flex items-center text-xs text-green-700 bg-green-100 p-2 rounded-md">
                                <CheckCircle2 className="h-4 w-4 mr-1.5 flex-shrink-0" /> {startInstanceStatus.successMessage}
                            </div>
                        )}
                        {startInstanceStatus.error && (
                            <div className="mt-2 flex items-center text-xs text-red-700 bg-red-100 p-2 rounded-md">
                                <AlertTriangle className="h-4 w-4 mr-1.5 flex-shrink-0" /> {startInstanceStatus.error}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {workflowToArchive && (
                <Modal
                    isOpen={isArchiveModalOpen}
                    onClose={!archiveStatus.loading ? closeArchiveModal : () => { }}
                    title="Confirm Archive Workflow"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeArchiveModal}
                                disabled={archiveStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmArchive}
                                disabled={archiveStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {archiveStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Archive size={16} className="mr-2" />}
                                Confirm Archive
                            </button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to archive the workflow: <strong>{workflowToArchive.name}</strong> (Version {workflowToArchive.version})?
                        </p>
                        <p className="text-xs text-gray-500">
                            Archived workflows cannot be started. Existing running instances will continue based on this version.
                        </p>
                        {archiveStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center">
                                <AlertTriangle size={18} className="mr-2" /> {archiveStatus.error}
                            </div>
                        )}
                        {archiveStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center">
                                <CheckCircle2 size={18} className="mr-2" /> {archiveStatus.successMessage}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {fileToDelete && (
                <Modal
                    isOpen={isFileDeleteModalOpen}
                    onClose={!deleteFileStatus.loading ? closeDeleteFileModal : () => { }}
                    title="Confirm File Deletion"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeDeleteFileModal}
                                disabled={deleteFileStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDeleteFile}
                                disabled={deleteFileStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {deleteFileStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 size={16} className="mr-2" />}
                                Confirm Delete
                            </button>
                        </>
                    }
                >
                     <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete the file: <strong>{fileToDelete.filename}</strong> (ID: <code className="text-xs bg-gray-200 p-0.5 rounded">{fileToDelete._id}</code>)?
                        </p>
                        <p className="text-xs font-bold text-red-700">
                            This action will delete the file record and the physical file from storage. This cannot be undone.
                        </p>
                        <p className="text-xs text-gray-500">
                            Please ensure this file is not actively referenced by critical workflow instances or tasks.
                        </p>
                        {deleteFileStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center">
                                <AlertTriangle size={18} className="mr-2"/> {deleteFileStatus.error}
                            </div>
                        )}
                        {deleteFileStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center">
                                <CheckCircle2 size={18} className="mr-2"/> {deleteFileStatus.successMessage}
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {taskToDelete && (
                <Modal
                    isOpen={isTaskDeleteModalOpen}
                    onClose={!deleteTaskStatus.loading ? closeDeleteTaskModal : () => { }}
                    title="Confirm Task Deletion"
                    footer={
                        <>
                            <button type="button" onClick={closeDeleteTaskModal} disabled={deleteTaskStatus.loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm">Cancel</button>
                            <button type="button" onClick={handleConfirmDeleteTask} disabled={deleteTaskStatus.loading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                {deleteTaskStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 size={16} className="mr-2" />}
                                Confirm Delete
                            </button>
                        </>
                    }
                >
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                            Are you sure you want to delete the task: <strong>{taskToDelete.title}</strong> (ID: <code className="text-xs bg-gray-200 p-0.5 rounded">{taskToDelete._id}</code>)?
                        </p>
                        <p className="text-xs font-bold text-red-700">
                            This action will permanently delete the task record. This cannot be undone.
                        </p>
                        <p className="text-xs text-gray-500">
                            Deleting an active task might affect its parent workflow instance. Consider if this task is critical for a running workflow.
                        </p>
                        {deleteTaskStatus.error && (<div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center"> <AlertTriangle size={18} className="mr-2" /> {deleteTaskStatus.error}</div>)}
                        {deleteTaskStatus.successMessage && (<div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center"> <CheckCircle2 size={18} className="mr-2" /> {deleteTaskStatus.successMessage}</div>)}
                    </div>
                </Modal>
            )}

            {instanceToTerminate && (
                <Modal
                    isOpen={isTerminateModalOpen}
                    onClose={!terminateStatus.loading ? closeTerminateModal : () => {}}
                    title="Confirm Instance Termination"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeTerminateModal}
                                disabled={terminateStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmTerminate}
                                disabled={terminateStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {terminateStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <Ban size={16} className="mr-2"/>}
                                Confirm Termination
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-700">
                            Are you sure you want to terminate workflow instance: <br/>
                            <strong className="font-mono text-xs">{instanceToTerminate._id}</strong>
                            <br/>
                            (Workflow: <strong>{instanceToTerminate.workflowDefinitionId?.name || 'N/A'}</strong>, Status: <strong>{instanceToTerminate.status}</strong>)?
                        </p>
                        <div>
                            <label htmlFor="terminationReason" className="block text-xs font-medium text-gray-700 mb-1">
                                Reason for Termination (Optional):
                            </label>
                            <textarea
                                id="terminationReason"
                                rows={3}
                                value={terminationReason}
                                onChange={(e) => setTerminationReason(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                placeholder="Enter reason..."
                                disabled={terminateStatus.loading}
                            />
                        </div>
                        <p className="text-xs text-orange-600">
                            This action will attempt to stop the instance and cancel its active tasks. It cannot be undone.
                        </p>
                        {terminateStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center">
                                <AlertTriangle size={18} className="mr-2"/> {terminateStatus.error}
                            </div>
                        )}
                         {terminateStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center">
                                <CheckCircle2 size={18} className="mr-2"/> {terminateStatus.successMessage}
                            </div>
                        )}
                    </div>
                </Modal>
            )}
                        {instanceToRetry && isRetryModalOpen && (
                <Modal
                    isOpen={isRetryModalOpen}
                    onClose={!retryStatus.loading ? closeRetryModal : () => {}}
                    title="Retry Failed Workflow Instance"
                    size="lg"
                    footer={
                        <>
                            <button
                                type="button"
                                onClick={closeRetryModal}
                                disabled={retryStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRetry}
                                disabled={retryStatus.loading}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md shadow-sm disabled:opacity-50 flex items-center"
                            >
                                {retryStatus.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <RotateCcw size={16} className="mr-2"/>}
                                Confirm Retry
                            </button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            You are about to retry instance: <strong>{instanceToRetry._id}</strong>
                        </p>
                        <p className="text-sm text-gray-600">
                            Workflow: <strong>{instanceToRetry.workflowDefinitionId?.name || 'N/A'}</strong>
                        </p>
                         <p className="text-sm text-gray-600">
                            Current Status: <span className={`font-medium px-1.5 py-0.5 rounded-full text-xs ${getInstanceStatusColor(instanceToRetry.status)}`}>{instanceToRetry.status}</span>
                        </p>
                        {instanceToRetry.errorInfo && (
                            <div className="p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
                                <p className="font-semibold">Last Error (Node: {instanceToRetry.errorInfo.nodeId || 'N/A'}):</p>
                                <p className="whitespace-pre-wrap">{instanceToRetry.errorInfo.message}</p>
                                {instanceToRetry.errorInfo.previousError && <p className="mt-1 pt-1 border-t text-gray-600">Previous error: {instanceToRetry.errorInfo.previousError}</p>}
                            </div>
                        )}
                        <div>
                            <label htmlFor="retryContextUpdates" className="block text-xs font-medium text-gray-700 mb-1">
                                Context Updates (Optional JSON to merge):
                            </label>
                            <textarea
                                id="retryContextUpdates"
                                name="retryContextUpdates"
                                rows={4}
                                value={retryContextUpdates}
                                onChange={(e) => setRetryContextUpdates(e.target.value)}
                                placeholder={'{\n  "keyToUpdate": "newValue",\n  "newKey": "someValue"\n}'}
                                disabled={retryStatus.loading}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs font-mono"
                            />
                             <p className="mt-1 text-xs text-gray-500">
                                Provide a JSON object. These values will be merged into the instance context before retrying from the failed node.
                            </p>
                        </div>
                        
                        {retryStatus.error && (
                            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md flex items-center mt-2">
                                <AlertTriangle size={18} className="mr-2"/> {retryStatus.error}
                            </div>
                        )}
                         {retryStatus.successMessage && (
                            <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center mt-2">
                                <CheckCircle2 size={18} className="mr-2"/> {retryStatus.successMessage}
                            </div>
                        )}
                    </div>
                </Modal>
            )}


            {isApiConfigModalOpen && (
                <Modal isOpen={isApiConfigModalOpen} onClose={closeApiConfigModal} title={editingApiConfig ? "Edit API Configuration" : "Create New API Configuration"} size="lg">
                    <form onSubmit={handleApiConfigFormSubmit} className="space-y-4 text-sm">
                        <div>
                            <label htmlFor="apiConfigName" className="block text-xs font-medium text-gray-700 mb-0.5">Name <span className="text-red-500">*</span></label>
                            <input type="text" name="name" id="apiConfigName" value={apiConfigFormData.name} onChange={handleApiConfigFormChange} required className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label htmlFor="apiConfigDescription" className="block text-xs font-medium text-gray-700 mb-0.5">Description</label>
                            <textarea name="description" id="apiConfigDescription" rows={2} value={apiConfigFormData.description} onChange={handleApiConfigFormChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label htmlFor="apiConfigUrl" className="block text-xs font-medium text-gray-700 mb-0.5">API URL <span className="text-red-500">*</span></label>
                            <input type="url" name="apiUrl" id="apiConfigUrl" value={apiConfigFormData.apiUrl} onChange={handleApiConfigFormChange} required placeholder="https://api.example.com/endpoint" className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" />
                        </div>
                        <div>
                            <label htmlFor="apiConfigMethod" className="block text-xs font-medium text-gray-700 mb-0.5">Method <span className="text-red-500">*</span></label>
                            <select name="apiMethod" id="apiConfigMethod" value={apiConfigFormData.apiMethod} onChange={handleApiConfigFormChange} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                                <option value="PATCH">PATCH</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="apiConfigHeaders" className="block text-xs font-medium text-gray-700 mb-0.5">Headers Template (JSON)</label>
                            <textarea name="headersTemplate" id="apiConfigHeaders" rows={4} value={apiConfigFormData.headersTemplate} onChange={handleApiConfigFormChange} placeholder={'{\n  "Content-Type": "application/json",\n  "Authorization": "Bearer {{context.apiToken}}"\n}'} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-mono text-xs" />
                            {apiConfigFormError && <p className="text-xs text-red-600 mt-1">{apiConfigFormError}</p>}
                        </div>
                        
                        <DismissibleAlert variant="success" message={apiConfigActionStatus.action === (editingApiConfig ? 'edit' : 'create') ? apiConfigActionStatus.successMessage : null} onClose={() => setApiConfigActionStatus(prev => ({...prev, successMessage: null}))} />
                        <DismissibleAlert variant="error" message={apiConfigActionStatus.action === (editingApiConfig ? 'edit' : 'create') ? apiConfigActionStatus.error : null} onClose={() => setApiConfigActionStatus(prev => ({...prev, error: null}))} />
                        
                        <div className="flex justify-end pt-4 space-x-2">
                            <button type="button" onClick={closeApiConfigModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm" disabled={apiConfigActionStatus.loading}>Cancel</button>
                            <button type="submit" disabled={apiConfigActionStatus.loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                {apiConfigActionStatus.loading && <Loader2 className="animate-spin h-4 w-4 mr-1.5"/>}
                                {editingApiConfig ? 'Save Changes' : 'Create Config'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {isApiConfigStatusModalOpen && apiConfigToUpdateStatus && (
                <Modal isOpen={isApiConfigStatusModalOpen} onClose={closeApiConfigStatusModal} title={`Confirm: ${newApiConfigStatus} API Config`} size="md">
                    <div className="space-y-3">
                        <p className="text-sm mb-2">Are you sure you want to <span className="font-semibold">{newApiConfigStatus.toLowerCase()}</span> the API configuration: <br/><strong>{apiConfigToUpdateStatus.name}</strong> ({apiConfigToUpdateStatus.apiUrl})?</p>
                        
                        {(newApiConfigStatus === 'Rejected' || newApiConfigStatus === 'Approved' || newApiConfigStatus === 'Archived') && 
                            <div>
                                <label htmlFor="apiConfigAdminNotes" className="block text-xs font-medium text-gray-700 mb-1">
                                    Admin Notes {newApiConfigStatus === 'Rejected' ? '(Required)' : '(Optional)'}:
                                </label>
                                <textarea id="apiConfigAdminNotes" value={apiConfigAdminNotes} onChange={(e) => setApiConfigAdminNotes(e.target.value)} rows={3} className="w-full p-2 border border-gray-300 rounded text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                            </div>
                        }
                        <DismissibleAlert variant="success" message={apiConfigActionStatus.action === `status-${newApiConfigStatus}` ? apiConfigActionStatus.successMessage : null} onClose={() => setApiConfigActionStatus(prev => ({...prev, successMessage: null}))} />
                        <DismissibleAlert variant="error" message={apiConfigActionStatus.action === `status-${newApiConfigStatus}` ? apiConfigActionStatus.error : null} onClose={() => setApiConfigActionStatus(prev => ({...prev, error: null}))} />

                        <div className="flex justify-end pt-4 space-x-2">
                            <button type="button" onClick={closeApiConfigStatusModal} disabled={apiConfigActionStatus.loading} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-md border border-gray-300 shadow-sm">Cancel</button>
                            <button type="button" onClick={handleConfirmApiConfigStatusUpdate} disabled={apiConfigActionStatus.loading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm disabled:opacity-50 flex items-center">
                                {apiConfigActionStatus.loading && <Loader2 className="animate-spin h-4 w-4 mr-1.5"/>}
                                Confirm {newApiConfigStatus}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const formatDate = (dateString, includeTime = false) => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        if (includeTime) {
            return date.toLocaleString();
        }
        return date.toLocaleDateString();
    } catch (e) {
        return 'Invalid Date';
    }
};
