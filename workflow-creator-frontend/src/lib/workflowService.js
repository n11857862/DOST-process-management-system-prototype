import apiClient from './api.js';

const WORKFLOWS_ENDPOINT = '/workflows';
const API_CONFIGS_ENDPOINT = '/api-configs';
const INSTANCES_ENDPOINT = '/instances'; 
const TASKS_ENDPOINT = '/tasks';
const FILES_ENDPOINT = '/files';
const DASHBOARD_ENDPOINT = '/dashboard';
const ME_PROFILE_ENDPOINT = '/me/profile';
const USERS_ENDPOINT = '/users';


const createWorkflow = async (workflowData) => {
  try {
    const response = await apiClient.post(WORKFLOWS_ENDPOINT, workflowData);
    return response.data.data || response.data; 
  } catch (error) {
    console.error('Error in createWorkflow service:', error.response?.data || error.message);
    throw error;
  }
};

const findOrCreateApiConfig = async (apiConfigDetails) => {
  try {
    const payload = {
        name: apiConfigDetails.name,
        apiUrl: apiConfigDetails.apiUrl,
        apiMethod: apiConfigDetails.apiMethod,
        headersTemplate: typeof apiConfigDetails.headersTemplate === 'object' 
            ? JSON.stringify(apiConfigDetails.headersTemplate) 
            : apiConfigDetails.headersTemplate || '{}',
        description: apiConfigDetails.description || '',
    };
    const response = await apiClient.post(`${API_CONFIGS_ENDPOINT}/find-or-create`, payload);
    return response.data;
  } catch (error) {
    console.error('Error in findOrCreateApiConfig service:', error.response?.data || error.message);
    throw error;
  }
};

const listWorkflows = async (params = {}) => {
  try {
    const response = await apiClient.get(WORKFLOWS_ENDPOINT, { params });
    return response.data.data || response.data; 
  } catch (error) {
    console.error('Error in listWorkflows service:', error.response?.data || error.message);
    throw error;
  }
};

const getWorkflowById = async (workflowId) => {
  try {
    const response = await apiClient.get(`${WORKFLOWS_ENDPOINT}/${workflowId}`);
    return response.data.data || response.data;
  } catch (error) {
    console.error(`Error fetching workflow by ID ${workflowId}:`, error.response?.data || error.message);
    throw error;
  }
};

const updateWorkflow = async (workflowId, workflowData) => {
  try {
    const response = await apiClient.put(`${WORKFLOWS_ENDPOINT}/${workflowId}`, workflowData);
    return response.data.data || response.data;
  } catch (error) {
    console.error(`Error updating workflow ID ${workflowId}:`, error.response?.data || error.message);
    throw error;
  }
};

const startWorkflowInstance = async (workflowDefinitionId, initialContext = {}) => {
  try {
    const payload = {
      workflowDefinitionId,
      initialContext,
    };
    const response = await apiClient.post(`${INSTANCES_ENDPOINT}/start`, payload);
    return response.data.data || response.data; 
  } catch (error) {
    console.error(`Error starting instance for workflow definition ID ${workflowDefinitionId}:`, error.response?.data || error.message);
    throw error;
  }
};

const listMyTasks = async (params = { status: 'Pending,In Progress,Needs Rework', limit: 10, page: 1, sortBy: 'dueDate', sortOrder: 'asc' }) => {
  try {
    const response = await apiClient.get(TASKS_ENDPOINT, { params });
        console.log('workflowService.listMyTasks - API Response:', JSON.stringify(response, null, 2));
    console.log('workflowService.listMyTasks - Tasks being returned (response.data.data):', JSON.stringify(response.data.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error in listMyTasks service:', error.response?.data || error.message);
    throw error;
  }
};

const getTaskDetails = async (taskId) => {
    try {
        const response = await apiClient.get(`${TASKS_ENDPOINT}/${taskId}`);
        return response.data.data || response.data; 
    } catch (error) {
        console.error(`Error fetching task details for ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const completeTask = async (taskId, completionData = {}) => {
    try {
        const response = await apiClient.post(`${TASKS_ENDPOINT}/${taskId}/complete`, completionData);
        return response.data.data || response.data;
    } catch (error) {
    let errorDetails = error.message;
    if (error.response && error.response.data) {
        errorDetails = typeof error.response.data === 'object' ? JSON.stringify(error.response.data, null, 2) : error.response.data;
    }
    console.error(`Error completing task ${taskId}:`, errorDetails);
    throw error;
}
};

const rejectTask = async (taskId, rejectionData = {}) => {
    try {
        const response = await apiClient.post(`${TASKS_ENDPOINT}/${taskId}/reject`, rejectionData);
        return response.data.data || response.data;
    } catch (error) {
        console.error(`Error rejecting task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const approveTask = async (taskId, approvalData = {}) => {
    try {
        const response = await apiClient.post(`${TASKS_ENDPOINT}/${taskId}/approve`, approvalData);
        return response.data.data || response.data;
    } catch (error) {
        console.error(`Error approving task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const denyTask = async (taskId, denialData = {}) => {
    try {
        const response = await apiClient.post(`${TASKS_ENDPOINT}/${taskId}/deny`, denialData);
        return response.data.data || response.data;
    } catch (error) {
        console.error(`Error denying task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const uploadFile = async (formData) => {
 try {
  const response = await apiClient.post(`${FILES_ENDPOINT}/upload`, formData, {
   headers: {
    'Content-Type': 'multipart/form-data',
   },
});
  return response.data;
 } catch (error) {
  console.error('Error in uploadFile service:', error.response?.data || error.message);
  throw error;
 }
};

const getFileDownloadUrl = (fileId) => {
  if (!fileId) {
    console.warn('getFileDownloadUrl called with no fileId');
    return '#';
  }
  
  const url = `/api/v1/files/${fileId}/download`;
  console.log('[WorkflowService] Generated download URL:', url);
  return url;
};

const listAllUsersForAdmin = async (params = {}) => {
    try {
        const response = await apiClient.get('/admin/users', { params });
        return response.data;
    } catch (error) {
        console.error('Error in listAllUsersForAdmin service:', error.response?.data || error.message);
        throw error;
    }
};


const updateUserRoleForAdmin = async (userId, newRole) => {
    try {
        const response = await apiClient.put(`/admin/users/${userId}/role`, { role: newRole });
        return response.data;
    } catch (error) {
        console.error(`Error updating role for user ${userId}:`, error.response?.data || error.message);
        throw error;
    }
};

const getDashboardOverviewStats = async () => {
    try {
        const response = await apiClient.get(`${DASHBOARD_ENDPOINT}/stats`);
        return response.data.data || response.data;
    } catch (error) {
        console.error('Error in getDashboardOverviewStats service:', error.response?.data || error.message);
        throw error;
    }
};

const getDashboardRecentActivities = async (limit = 5) => {
    try {
        const response = await apiClient.get(`${DASHBOARD_ENDPOINT}/activities`, { params: { limit } });
        return response.data.data || response.data;
    } catch (error) {
        console.error('Error in getDashboardRecentActivities service:', error.response?.data || error.message);
        throw error;
    }
};

const claimTask = async (taskId) => {
    try {
        const response = await apiClient.post(`/tasks/${taskId}/claim`);
        return response.data;
    } catch (error) {
        console.error(`Error claiming task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const unclaimTask = async (taskId) => {
    try {
        const response = await apiClient.post(`/tasks/${taskId}/unclaim`);
        return response.data;
    } catch (error) {
        console.error(`Error unclaiming task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const reassignTask = async (taskId, reassignmentDetails) => {
    try {
        const response = await apiClient.put(`/tasks/${taskId}/reassign`, reassignmentDetails);
        return response.data;
    } catch (error) {
        console.error(`Error reassigning task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const listWorkflowInstances = async (params = {}) => {
    try {
        const response = await apiClient.get('/instances', { params });
        return response.data;
    } catch (error) {
        console.error('Error in listWorkflowInstances service:', error.response?.data || error.message);
        throw error;
    }
};

const adminListAllInstances = async (params = {}) => {
    try {
        const response = await apiClient.get('/instances/admin/all', { params }); 
        return response.data;
    } catch (error) {
        console.error('Error in adminListAllInstances service:', error.response?.data || error.message);
        throw error;
    }
};

const getInstanceDetails = async (instanceId) => {
    try {
        const response = await apiClient.get(`/instances/${instanceId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching instance details (ID: ${instanceId}):`, error.response?.data || error.message);
        throw error;
    }
};

const adminGetInstanceDetails = async (instanceId) => {
    try {
        const response = await apiClient.get(`/instances/admin/${instanceId}/details`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching instance details for admin (ID: ${instanceId}):`, error.response?.data || error.message);
        throw error;
    }
};

const archiveWorkflowDefinition = async (definitionId) => {
    try {
        const response = await apiClient.delete(`/workflows/${definitionId}`);
        return response.data;
    } catch (error) {
        console.error(`Error archiving workflow definition ${definitionId}:`, error.response?.data || error.message);
        throw error;
    }
};

const listAllFilesForAdmin = async (params = {}) => {
    try {
        const response = await apiClient.get('/files/admin/all', { params });
        return response.data;
    } catch (error) {
        console.error('Error in listAllFilesForAdmin service:', error.response?.data || error.message);
        throw error;
    }
};


const deleteFileForAdmin = async (fileId) => {
    try {
        const response = await apiClient.delete(`/files/admin/${fileId}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting file ${fileId} for admin:`, error.response?.data || error.message);
        throw error;
    }
};

const adminListAllTasks = async (params = {}) => {
    try {
        const response = await apiClient.get('/tasks', { params });
        return response.data;
    } catch (error) {
        console.error('Error in adminListAllTasks service:', error.response?.data || error.message);
        throw error;
    }
};


const adminDeleteTask = async (taskId) => {
    try {
        const response = await apiClient.delete(`/admin/tasks/${taskId}`);
        return response.data;
    } catch (error) {
        console.error(`Error deleting task ${taskId} for admin:`, error.response?.data || error.message);
        throw error;
    }
};

const reportTaskIssue = async (taskId, description) => {
    try {
        const response = await apiClient.post('/issues', { taskId, description });
        return response.data;
    } catch (error) {
        console.error(`Error reporting issue for task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const listAllIssues = async (params = {}) => {
    try {
        const response = await apiClient.get('/issues', { params });
        return response.data;
    } catch (error) {
        console.error('Error in listAllIssues service:', error.response?.data || error.message);
        throw error;
    }
};


const getIssueDetails = async (issueId) => {
    try {
        const response = await apiClient.get(`/issues/${issueId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching issue details for ${issueId}:`, error.response?.data || error.message);
        throw error;
    }
};


const addManagerCommentToIssue = async (issueId, commentText) => {
    try {
        const response = await apiClient.post(`/issues/${issueId}/comments`, { comment: commentText });
        return response.data;
    } catch (error) {
        console.error(`Error adding comment to issue ${issueId}:`, error.response?.data || error.message);
        throw error;
    }
};


const updateIssueStatus = async (issueId, newStatus, resolutionDetails = '') => {
    try {
        const payload = { status: newStatus };
        if (resolutionDetails) {
            payload.resolutionDetails = resolutionDetails;
        }
        const response = await apiClient.put(`/issues/${issueId}/status`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error updating status for issue ${issueId}:`, error.response?.data || error.message);
        throw error;
    }
};

const adminTerminateWorkflowInstance = async (instanceId, reason = '') => {
    try {
        const response = await apiClient.post(`/instances/admin/${instanceId}/terminate`, { reason });
        return response.data;
    } catch (error) {
        console.error(`Error terminating workflow instance ${instanceId}:`, error.response?.data || error.message);
        throw error;
    }
};

const adminRetryFailedWorkflowInstance = async (instanceId, contextUpdates = null) => {
    try {
        const payload = {};
        if (contextUpdates && typeof contextUpdates === 'object' && Object.keys(contextUpdates).length > 0) {
            payload.contextUpdates = contextUpdates;
        }
        const response = await apiClient.post(`/instances/admin/${instanceId}/retry`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error retrying workflow instance ${instanceId} for admin:`, error.response?.data || error.message);
        throw error;
    }
};

const generateDocumentForTask = async (taskId, templateString) => {
    try {
        const response = await apiClient.post(`/tasks/${taskId}/generate-document`, { templateString });
        return response.data;
    } catch (error) {
        console.error(`Error generating document for task ${taskId}:`, error.response?.data || error.message);
        throw error;
    }
};

const listTasksForInstance = async (instanceId, params = {}) => {
    try {
        const response = await apiClient.get(TASKS_ENDPOINT, { params: { ...params, workflowInstanceId: instanceId, limit: 200 } });
        return response.data;
    } catch (error) {
        console.error(`Error fetching tasks for instance ${instanceId}:`, error.response?.data || error.message);
        throw error;
    }
};

const downloadAuthFile = async (fileId, expectedFilename) => {
    try {
        console.log(`[WorkflowService] Starting download for fileId: ${fileId}, expectedFilename: ${expectedFilename}`);
        
        const response = await apiClient.get(`/files/${fileId}/download`, {
            responseType: 'blob',
        });

        console.log(`[WorkflowService] Download response received:`, {
            status: response.status,
            contentType: response.headers['content-type'],
            contentLength: response.headers['content-length'],
            contentDisposition: response.headers['content-disposition']
        });

        const blob = new Blob([response.data], { type: response.headers['content-type'] || 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        let filename = expectedFilename || 'download';
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+?)"?(;|$)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }

        console.log(`[WorkflowService] Triggering download with filename: ${filename}`);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log(`[WorkflowService] Download completed successfully for ${filename}`);
        return { success: true };
    } catch (error) {
        console.error(`[WorkflowService] Error downloading file ${fileId}:`, {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data
        });
        
        let errorMessage = 'Could not download the file.';
        if (error.response && error.response.data) {
            if (error.response.data instanceof Blob) {
                try {
                    const errorText = await error.response.data.text();
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                                 } catch (parseError) {
                     console.warn('[WorkflowService] Could not parse error response blob:', parseError);
                 }
            } else if (typeof error.response.data === 'string') {
                try {
                    const errorJson = JSON.parse(error.response.data);
                    errorMessage = errorJson.message || errorMessage;
                } catch (parseError) {
                    errorMessage = error.response.data;
                }
            } else if (error.response.data.message) {
                errorMessage = error.response.data.message;
            }
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        if (error.code === 'ENOTFOUND' || error.message.includes('ENOTFOUND')) {
            errorMessage = 'Network error: Cannot reach the backend server. Please check if the backend is running.';
        } else if (error.response?.status === 404) {
            errorMessage = 'File not found on the server.';
        } else if (error.response?.status === 403) {
            errorMessage = 'You are not authorized to download this file.';
        }
        
        throw new Error(errorMessage);
    }
};

const updateMyProfile = async (profileData) => {
  try {
    console.log('[WORKFLOW_SERVICE] Updating profile with data:', profileData);
    
    const response = await apiClient.put(ME_PROFILE_ENDPOINT, profileData);
    
    return {
      success: true,
      data: response.data,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    console.error('[WORKFLOW_SERVICE] Error updating user profile:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update profile'
    };
  }
};


const updateUserEmail = async (userId, newEmail) => {
  try {
    if (!userId) {
      console.error('[WORKFLOW_SERVICE] Missing userId for email update');
      return {
        success: false,
        message: 'User ID is required'
      };
    }
    
    if (!newEmail || typeof newEmail !== 'string' || !newEmail.trim()) {
      console.error('[WORKFLOW_SERVICE] Missing or invalid email for update');
      return {
        success: false,
        message: 'Valid email address is required'
      };
    }
    
    console.log(`[WORKFLOW_SERVICE] Updating email for user ${userId} to ${newEmail}`);
    
    const response = await apiClient.put(`${USERS_ENDPOINT}/${userId}/email`, { 
      email: newEmail.trim() 
    });
    
    return {
      success: true,
      data: response.data,
      message: 'Email updated successfully'
    };
  } catch (error) {
    console.error('[WORKFLOW_SERVICE] Error updating user email:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || 'Failed to update email'
    };
  }
};

const adminListApiConfigs = async (params = {}) => {
    try {
        const response = await apiClient.get(`${API_CONFIGS_ENDPOINT}/admin`, { params });
        return response.data;
    } catch (error) {
        console.error('Error listing API configs:', error.response?.data || error.message);
        throw error;
    }
};


const adminGetApiConfigDetails = async (configId) => {
    try {
        const response = await apiClient.get(`${API_CONFIGS_ENDPOINT}/admin/${configId}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching API config ${configId}:`, error.response?.data || error.message);
        throw error;
    }
};



const adminUpdateApiConfigDetails = async (configId, updateData) => {
    try {
        const response = await apiClient.put(`${API_CONFIGS_ENDPOINT}/admin/${configId}`, updateData);
        return response.data;
    } catch (error) {
        console.error(`Error updating API config ${configId} details:`, error.response?.data || error.message);
        throw error;
    }
};


const adminUpdateApiConfigStatus = async (configId, status, adminNotes = '') => {
    try {
        const payload = { status, adminNotes };
        const response = await apiClient.put(`${API_CONFIGS_ENDPOINT}/admin/${configId}/status`, payload);
        return response.data;
    } catch (error) {
        console.error(`Error updating API config ${configId} status to ${status}:`, error.response?.data || error.message);
        throw error;
    }
};

const searchSimilarApiConfigs = async (apiUrl, apiMethod) => {
    try {
        const response = await apiClient.get(`${API_CONFIGS_ENDPOINT}/search`, {
            params: { apiUrl, apiMethod }
        });
        return response.data;
    } catch (error) {
        console.error('Error searching similar API configs:', error.response?.data || error.message);
        throw error;
    }
};

const workflowService = {
  createWorkflow,
  findOrCreateApiConfig,
  listWorkflows,
  getWorkflowById,
  updateWorkflow,
  startWorkflowInstance,
  listMyTasks,
  getTaskDetails,
  completeTask,
  rejectTask,
  approveTask,
  denyTask,
  uploadFile,
  getFileDownloadUrl,
  listAllUsersForAdmin,
  updateUserRoleForAdmin,
  getDashboardOverviewStats,
  getDashboardRecentActivities,
  claimTask,
  unclaimTask,
  reassignTask,
  listWorkflowInstances,
  getInstanceDetails,
  adminListAllInstances,
  adminGetInstanceDetails,
  archiveWorkflowDefinition,
  listAllFilesForAdmin,
  deleteFileForAdmin,
  adminListAllTasks,
  adminDeleteTask,
  reportTaskIssue,
  listAllIssues,
  getIssueDetails,
  addManagerCommentToIssue,
  updateIssueStatus,
  adminTerminateWorkflowInstance,
  adminRetryFailedWorkflowInstance,
  generateDocumentForTask,
  listTasksForInstance,
  downloadAuthFile,
  updateMyProfile,
  updateUserEmail,
  adminListApiConfigs,
  adminGetApiConfigDetails,
  adminUpdateApiConfigDetails,
  adminUpdateApiConfigStatus,
  searchSimilarApiConfigs,
};

export default workflowService;