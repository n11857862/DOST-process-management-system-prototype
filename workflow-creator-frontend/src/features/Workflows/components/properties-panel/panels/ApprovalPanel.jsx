import React from 'react';
import { PlusCircle, XCircle } from 'lucide-react';

const FIELD_TYPES = [
    { value: 'text', label: 'Text Input' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number Input' },
    { value: 'date', label: 'Date Picker' },
    { value: 'boolean', label: 'Checkbox (Yes/No)' },
    { value: 'select', label: 'Dropdown Select' },
];

export const ApprovalPanel = ({ config, handleConfigChange, handleConfigBlur }) => {
  const formFields = config?.formFields || [];
  
  console.log('ApprovalPanel - Rendering with formFields:', formFields.length, formFields);

  const handleFormFieldChange = (index, fieldProperty, value) => {
    const updatedFormFields = formFields.map((field, i) => {
      if (i === index) {
        return { ...field, [fieldProperty]: value };
      }
      return field;
    });
    handleConfigChange({ target: { name: 'formFields', value: updatedFormFields } });
  };
  
  const handleFormFieldBlur = (index, fieldProperty, value) => {
    const updatedFormFields = formFields.map((field, i) => {
      if (i === index) {
        return { ...field, [fieldProperty]: value };
      }
      return field;
    });
    handleConfigBlur({ target: { name: 'formFields', value: updatedFormFields } });
  };

  const addFormField = () => {
    const newField = {
      id: `approval_field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      key: '',
      label: '',
      type: 'text',
      required: false,
      options: '',
      placeholder: ''
    };
    const newFormFields = [...formFields, newField];
    handleConfigChange({ target: { name: 'formFields', value: newFormFields } });
  };

  const removeFormField = (indexToRemove) => {
    console.log('ApprovalPanel - removeFormField called with index:', indexToRemove);
    console.log('ApprovalPanel - current formFields before removal:', formFields);
    
    const updatedFormFields = [...formFields.filter((_, index) => index !== indexToRemove)];
    console.log('ApprovalPanel - updatedFormFields after removal:', updatedFormFields);
    
    handleConfigChange({ target: { name: 'formFields', value: updatedFormFields } });
    handleConfigBlur({ target: { name: 'formFields', value: updatedFormFields } });
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="approvalApproverRule" className="block text-xs font-medium text-gray-700 mb-1">Approver Rule:</label>
        <select
          id="approvalApproverRule"
          name="approverRule"
          value={config?.approverRule || 'Manager'}
          onChange={handleConfigChange}
          onBlur={handleConfigBlur}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        >
          <option value="Manager">Initiator's Manager</option>
          <option value="SpecificUser">Specific User</option>
          <option value="SpecificRole">Specific Role</option>
          {/* Add more rules like 'ApprovalGroup', 'HierarchyBased' later */}
        </select>
      </div>

      {/* Conditional Inputs based on Approver Rule */}
      {config?.approverRule === 'SpecificUser' && (
        <div>
          <label htmlFor="approvalApproverUserId" className="block text-xs font-medium text-gray-700 mb-1">Approver User ID:</label>
          <input
            id="approvalApproverUserId"
            type="text"
            name="approverUserId" // Corresponds to config.approverUserId
            value={config?.approverUserId || ''}
            onChange={handleConfigChange}
            onBlur={handleConfigBlur}
            placeholder="Enter User ID"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
        </div>
      )}
      {config?.approverRule === 'SpecificRole' && (
        <div>
          <label htmlFor="approvalApproverRole" className="block text-xs font-medium text-gray-700 mb-1">Approver Role:</label>
          <input
            id="approvalApproverRole"
            type="text"
            name="approverRole" // Corresponds to config.approverRole
            value={config?.approverRole || ''}
            onChange={handleConfigChange}
            onBlur={handleConfigBlur}
            placeholder="Enter Role Name (e.g., finance, legal)"
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
          />
        </div>
      )}

      {/* REVISED Rejection Behavior */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <label htmlFor="approvalRejectionBehavior" className="block text-xs font-medium text-gray-700 mb-1">
          If Rejected:
        </label>
        <select
          id="approvalRejectionBehavior"
          name="rejectionBehavior" 
          value={config?.rejectionBehavior || 'followRejectedPath'} // Default to following the visual path
          onChange={handleConfigChange}
          onBlur={handleConfigBlur}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        >
          <option value="followRejectedPath">Follow Visual Rejected Path</option>
          <option value="failWorkflow">Fail Entire Workflow</option>
          <option value="endPathIfNoConnection">End This Path (if no rejected path drawn)</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          "Follow Visual Path" requires an edge connected to the 'Rejected' handle.
        </p>
      </div>

      {/* Instructions for Approver */}
      <div>
        <label htmlFor="approvalInstructions" className="block text-xs font-medium text-gray-700 mb-1">
          Instructions for Approver (Optional):
        </label>
        <textarea
          id="approvalInstructions"
          name="instructions" // Will be stored in config.instructions
          rows={3}
          value={config?.instructions || ''}
          onChange={handleConfigChange}
          onBlur={handleConfigBlur}
          placeholder="e.g., Please verify budget alignment and policy compliance."
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        />
      </div>

      {/* Priority */}
      <div>
        <label htmlFor="approvalPriority" className="block text-xs font-medium text-gray-700 mb-1">Priority:</label>
        <select
          id="approvalPriority"
          name="priority"
          value={config?.priority || 'Medium'}
          onChange={handleConfigChange}
          onBlur={handleConfigBlur}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        >
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Urgent">Urgent</option>
        </select>
      </div>

      {/* Allow File Submission */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            name="allowFileSubmission"
            checked={!!config?.allowFileSubmission}
            onChange={handleConfigChange}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-offset-0 focus:ring-blue-200 focus:ring-opacity-50 h-4 w-4"
          />
          <span className="text-gray-800">Allow file submission for this approval?</span>
        </label>
        <p className="mt-1 text-xs text-gray-500">If checked, approver can upload files when making their decision.</p>
      </div>

      {/* Custom Form Fields Section */}
      <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-semibold text-gray-700">Custom Form Fields for Approver</h4>
          <button
            type="button"
            onClick={addFormField}
            className="text-xs flex items-center px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm"
          >
            <PlusCircle size={14} className="mr-1" /> Add Field
          </button>
        </div>

        {formFields.length === 0 && (
          <p className="text-xs text-gray-500">No custom form fields defined for this approval.</p>
        )}

        {formFields.map((field, index) => (
          <div key={field.id} className="p-3 border border-gray-200 rounded-md space-y-3 bg-gray-50 relative">
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                removeFormField(index);
              }}
              className="absolute top-2 right-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full z-10 transition-colors"
              title="Remove Field"
            >
              <XCircle size={16} />
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`approval-field-key-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Key</label>
                <input
                  type="text"
                  id={`approval-field-key-${index}`}
                  placeholder="e.g., approvalReason (no spaces)"
                  value={field.key || ''}
                  onChange={(e) => handleFormFieldChange(index, 'key', e.target.value.replace(/\s+/g, ''))}
                  onBlur={(e) => handleFormFieldBlur(index, 'key', e.target.value.replace(/\s+/g, ''))}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
              <div>
                <label htmlFor={`approval-field-label-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Label</label>
                <input
                  type="text"
                  id={`approval-field-label-${index}`}
                  placeholder="e.g., Approval Reason"
                  value={field.label || ''}
                  onChange={(e) => handleFormFieldChange(index, 'label', e.target.value)}
                  onBlur={(e) => handleFormFieldBlur(index, 'label', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`approval-field-type-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Type</label>
                <select
                  id={`approval-field-type-${index}`}
                  value={field.type || 'text'}
                  onChange={(e) => handleFormFieldChange(index, 'type', e.target.value)}
                  onBlur={(e) => handleFormFieldBlur(index, 'type', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                >
                  {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`approval-field-placeholder-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Placeholder (Optional)</label>
                <input
                  type="text"
                  id={`approval-field-placeholder-${index}`}
                  placeholder="e.g., Enter reason for approval"
                  value={field.placeholder || ''}
                  onChange={(e) => handleFormFieldChange(index, 'placeholder', e.target.value)}
                  onBlur={(e) => handleFormFieldBlur(index, 'placeholder', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
            </div>
            
            {field.type === 'select' && (
              <div>
                <label htmlFor={`approval-field-options-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Options (comma-separated)</label>
                <input
                  type="text"
                  id={`approval-field-options-${index}`}
                  placeholder="e.g., Budget Approved,Needs Revision,Policy Compliant"
                  value={field.options || ''}
                  onChange={(e) => handleFormFieldChange(index, 'options', e.target.value)}
                  onBlur={(e) => handleFormFieldBlur(index, 'options', e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                />
              </div>
            )}
            <div className="flex items-center mt-1">
              <input
                id={`approval-field-required-${index}`}
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => handleFormFieldChange(index, 'required', e.target.checked)}
                onBlur={(e) => handleFormFieldBlur(index, 'required', e.target.checked)}
                className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor={`approval-field-required-${index}`} className="ml-2 block text-xs font-medium text-gray-700">
                Required Field
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};