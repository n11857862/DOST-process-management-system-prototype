import React, { useState, useEffect } from 'react';
import FileInput from '../FileInput';
import workflowService from '../../../../../lib/workflowService';

export const FileUploadPanel = ({ 
    nodeId, 
    config, 
    updateNodeData,
    handleConfigChange,
    handleConfigBlur
}) => {
  const [stagedFile, setStagedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    console.log('[FileUploadPanel] Config updated:', config);
    console.log('[FileUploadPanel] designerAttachedFileId:', config?.designerAttachedFileId);
    console.log('[FileUploadPanel] designerAttachedFileName:', config?.designerAttachedFileName);
  }, [config]);

  const handleFileStaged = (file) => {
    setStagedFile(file);
    setUploadError(null);
    
    handleUploadStagedFile(file);
  };

  const handleFileCleared = () => {
    setStagedFile(null);
    setUploadError(null);
  };

  const handleUploadStagedFile = async (file) => {
    if (!file) return;
    
    console.log('[FileUploadPanel] Starting file upload for:', file.name);
    setUploadLoading(true);
    setUploadError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      console.log('[FileUploadPanel] Calling workflowService.uploadFile...');
      const uploadResponse = await workflowService.uploadFile(formData);
      console.log('[FileUploadPanel] Upload response:', uploadResponse);
      
      if (uploadResponse.success && uploadResponse.data?.fileId) {
        const newConfig = { 
          ...config, 
          designerAttachedFileId: uploadResponse.data.fileId, 
          designerAttachedFileName: uploadResponse.data.filename || uploadResponse.data.originalname || file.name 
        };
        console.log('[FileUploadPanel] New config to update:', newConfig);
        console.log('[FileUploadPanel] Calling updateNodeData with nodeId:', nodeId);
        
        updateNodeData('node', nodeId, { config: newConfig });
        
        setStagedFile(null);
        console.log('[FileUploadPanel] File upload and config update completed successfully');
      } else {
        console.error('[FileUploadPanel] Upload response missing success or fileId:', uploadResponse);
        throw new Error(uploadResponse.message || 'Upload failed');
      }
    } catch (error) {
      console.error('[FileUploadPanel] File upload error:', error);
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleRemoveDesignerFile = () => {
    const newConfig = { 
      ...config, 
      designerAttachedFileId: null, 
      designerAttachedFileName: '' 
    };
    updateNodeData('node', nodeId, { config: newConfig });
    setUploadError(null);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Attach File to Definition</h4>
        <p className="text-xs text-gray-500 mb-3">
          Upload the specific file that will be presented to the assigned user during workflow execution.
        </p>
        <FileInput
          label="Workflow Document/Attachment:"
          onFileStaged={handleFileStaged}
          onFileCleared={handleFileCleared}
          stagedFile={stagedFile}
          currentFileId={config?.designerAttachedFileId}
          currentFileName={config?.designerAttachedFileName}
          onRemoveExisting={handleRemoveDesignerFile}
          disabled={uploadLoading}
        />
        {uploadLoading && (
          <div className="mt-2 text-sm text-blue-600">
            Uploading file...
          </div>
        )}
        {uploadError && (
          <div className="mt-2 text-sm text-red-600">
            Upload error: {uploadError}
          </div>
        )}
      </div>
      
      <div className="border-b border-gray-200 pb-4 pt-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-1 mt-2">Runtime Task Configuration</h4>
        <p className="text-xs text-gray-500 mb-3">
            This node will generate a task for a user to review the attached file.
        </p>
        <div>
          <label htmlFor={`fileUploadInstructions-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
            Instructions for Reviewer (Task Description):
          </label>
          <textarea
            id={`fileUploadInstructions-${nodeId}`}
            name="instructions"
            rows={3}
            value={config?.instructions || ''}
            onChange={handleConfigChange}
            onBlur={handleConfigBlur}
            placeholder="e.g., Please review the attached document and mark as complete."
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
        </div>

        <div className="mt-3">
          <label htmlFor={`fileUploadContextKey-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
            Store Attached File ID in Context As (Optional):
          </label>
          <input
            id={`fileUploadContextKey-${nodeId}`}
            type="text"
            name="contextKeyForFileId"
            value={config?.contextKeyForFileId || ''}
            onChange={handleConfigChange}
            onBlur={handleConfigBlur}
            placeholder="e.g., reviewedDocumentId (optional)"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
          <p className="mt-1 text-xs text-gray-500">
            If set, the ID of the attached file will also be placed into the instance context.
          </p>
        </div>
      </div>
      
      <div className="pt-2">
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Review Task Assignment</h4>
        <label htmlFor={`fileUploadAssignTo-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
            Assign Review Task To:
        </label>
        <select
          id={`fileUploadAssignTo-${nodeId}`}
          name="assignTo"
          value={config?.assignTo || 'initiator'}
          onChange={handleConfigChange}
          onBlur={handleConfigBlur}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        >
          <option value="initiator">Initiator</option>
          <option value="specificUser">Specific User</option>
          <option value="specificRole">Specific Role</option>
          <option value="manager">Initiator's Manager</option>
        </select>
      </div>

      {config?.assignTo === 'specificUser' && (
        <div className="mt-3">
          <label htmlFor={`fileUploadSpecificUserId-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">Specific User ID for Review Task:</label>
          <input
            id={`fileUploadSpecificUserId-${nodeId}`} type="text" name="specificUserId"
            value={config?.specificUserId || ''}
            onChange={handleConfigChange} onBlur={handleConfigBlur}
            placeholder="Enter User ID"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
        </div>
      )}
      {config?.assignTo === 'specificRole' && (
        <div className="mt-3">
          <label htmlFor={`fileUploadSpecificRole-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">Specific Role for Review Task:</label>
          <input
            id={`fileUploadSpecificRole-${nodeId}`} type="text" name="specificRole"
            value={config?.specificRole || ''}
            onChange={handleConfigChange} onBlur={handleConfigBlur}
            placeholder="Enter Role Name"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
        </div>
      )}
    </div>
  );
};