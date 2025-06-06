import React from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export const WorkflowGeneralSettingsPanel = ({
  workflowName,
  onWorkflowNameChange,
  workflowDescription,
  onWorkflowDescriptionChange,
  expectedContextFields,
  onExpectedContextFieldsChange
}) => {

  const handleAddField = () => {
    onExpectedContextFieldsChange([
      ...(expectedContextFields || []),
      { _id: uuidv4(), key: '', label: '', defaultValue: '' }
    ]);
  };

  const handleFieldChange = (index, fieldName, value) => {
    const updatedFields = (expectedContextFields || []).map((field, i) => 
      i === index ? { ...field, [fieldName]: value } : field
    );
    onExpectedContextFieldsChange(updatedFields);
  };

  const handleRemoveField = (index) => {
    const updatedFields = (expectedContextFields || []).filter((_, i) => i !== index);
    onExpectedContextFieldsChange(updatedFields);
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="workflowNameGlobal" className="block text-xs font-medium text-gray-700 mb-1">
          Workflow Name:
        </label>
        <input
          id="workflowNameGlobal"
          type="text"
          name="workflowName"
          value={workflowName}
          onChange={(e) => onWorkflowNameChange(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        />
      </div>
      <div>
        <label htmlFor="workflowDescriptionGlobal" className="block text-xs font-medium text-gray-700 mb-1">
          Workflow Description:
        </label>
        <textarea
          id="workflowDescriptionGlobal"
          name="workflowDescription"
          rows={3}
          value={workflowDescription}
          onChange={(e) => onWorkflowDescriptionChange(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
        />
      </div>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-800 mb-2">Expected Start Context Variables</h4>
        <p className="text-xs text-gray-500 mb-3">
          Define variables the user should provide when starting this workflow.
        </p>
        {(expectedContextFields || []).map((field, index) => (
          <div key={field._id || index} className="p-2 mb-2 border border-gray-200 rounded-md space-y-2 bg-gray-50">
            <div>
              <label htmlFor={`contextFieldLabel-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Display Label for User:</label>
              <input
                id={`contextFieldLabel-${index}`}
                type="text"
                value={field.label}
                onChange={(e) => handleFieldChange(index, 'label', e.target.value)}
                placeholder="e.g., Customer Name"
                className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-900"
              />
            </div>
            <div>
              <label htmlFor={`contextFieldKey-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Internal Key (no spaces/special chars):</label>
              <input
                id={`contextFieldKey-${index}`}
                type="text"
                value={field.key}
                onChange={(e) => handleFieldChange(index, 'key', e.target.value.replace(/\s+/g, ''))}
                placeholder="e.g., customerName"
                className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-900 font-mono"
              />
            </div>
            <div>
              <label htmlFor={`contextFieldDefault-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Default Value (Optional):</label>
              <input
                id={`contextFieldDefault-${index}`}
                type="text"
                value={field.defaultValue}
                onChange={(e) => handleFieldChange(index, 'defaultValue', e.target.value)}
                placeholder="Optional default"
                className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-900"
              />
            </div>
            <button
              onClick={() => handleRemoveField(index)}
              className="mt-1 text-xs text-red-500 hover:text-red-700 flex items-center"
            >
              <Trash2 size={12} className="mr-1" /> Remove Field
            </button>
          </div>
        ))}
        <button
          onClick={handleAddField}
          className="mt-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center"
        >
          <PlusCircle size={14} className="mr-1.5" /> Add Context Field
        </button>
      </div>
    </div>
  );
};