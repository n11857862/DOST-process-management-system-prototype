import React from 'react';
import { PlusCircle, XCircle, Trash2 } from 'lucide-react';

const FIELD_TYPES = [
    { value: 'text', label: 'Text Input' },
    { value: 'textarea', label: 'Text Area' },
    { value: 'number', label: 'Number Input' },
    { value: 'date', label: 'Date Picker' },
    { value: 'boolean', label: 'Checkbox (Yes/No)' },
    { value: 'select', label: 'Dropdown Select' },
];

export const TaskPanel = ({ config, handleConfigChange, handleConfigBlur }) => {
    const formFields = config?.formFields || [];
    
    console.log('TaskPanel - Rendering with formFields:', formFields.length, formFields);

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
            id: `task_field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            key: '',
            label: '',
            type: 'text',
            required: false,
            options: '',
            placeholder: ''
        };
        handleConfigChange({ target: { name: 'formFields', value: [...formFields, newField] } });
    };

    const removeFormField = (indexToRemove) => {
        console.log('TaskPanel - removeFormField called with index:', indexToRemove);
        console.log('TaskPanel - current formFields before removal:', formFields);
        
        const updatedFormFields = [...formFields.filter((_, index) => index !== indexToRemove)];
        console.log('TaskPanel - updatedFormFields after removal:', updatedFormFields);
        
        handleConfigChange({ target: { name: 'formFields', value: updatedFormFields } });
        handleConfigBlur({ target: { name: 'formFields', value: updatedFormFields } });
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="taskAssignTo" className="block text-xs font-medium text-gray-700 mb-1">Assign To Rule:</label>
                <select
                    id="taskAssignTo"
                    name="assignTo"
                    value={config?.assignTo || 'initiator'}
                    onChange={handleConfigChange}
                    onBlur={handleConfigBlur}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                >
                    <option value="initiator">Initiator</option>
                    <option value="specificUser">Specific User</option>
                    <option value="manager">Manager</option>
                    <option value="role">Specific Role</option>
                </select>
            </div>

            {config?.assignTo === 'specificUser' && (
                <div>
                    <label htmlFor="taskSpecificUserId" className="block text-xs font-medium text-gray-700 mb-1">Specific User ID:</label>
                    <input
                        id="taskSpecificUserId" type="text" name="specificUserId"
                        value={config?.specificUserId || ''} onChange={handleConfigChange} onBlur={handleConfigBlur}
                        placeholder="Enter User ID"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    />
                </div>
            )}
            {config?.assignTo === 'role' && (
                 <div>
                    <label htmlFor="taskSpecificRole" className="block text-xs font-medium text-gray-700 mb-1">Specific Role:</label>
                    <input
                        id="taskSpecificRole" type="text" name="specificRole"
                        value={config?.specificRole || ''} onChange={handleConfigChange} onBlur={handleConfigBlur}
                        placeholder="Enter Role Name"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    />
                </div>
            )}

            <div>
                <label htmlFor="taskPriority" className="block text-xs font-medium text-gray-700 mb-1">Priority:</label>
                <select
                    id="taskPriority" name="priority" value={config?.priority || 'Medium'}
                    onChange={handleConfigChange} onBlur={handleConfigBlur}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                </select>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4">
                <label className="flex items-center space-x-2 text-xs font-medium cursor-pointer">
                    <input 
                        type="checkbox" name="allowFileSubmission" checked={!!config?.allowFileSubmission}
                        onChange={handleConfigChange}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-offset-0 focus:ring-blue-200 focus:ring-opacity-50 h-4 w-4"
                    />
                    <span className="text-gray-800">Allow file submission for this task?</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">If checked, user can upload files when completing task.</p>
            </div>

            <div className="border-t border-gray-200 pt-4 mt-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-gray-700">Custom Form Fields</h4>
                    <button
                        type="button"
                        onClick={addFormField}
                        className="text-xs flex items-center px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm"
                    >
                        <PlusCircle size={14} className="mr-1" /> Add Field
                    </button>
                </div>

                {formFields.length === 0 && (
                    <p className="text-xs text-gray-500">No custom form fields defined for this task.</p>
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
                                <label htmlFor={`field-key-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Key</label>
                                <input
                                    type="text"
                                    id={`field-key-${index}`}
                                    placeholder="e.g., customerName (no spaces)"
                                    value={field.key || ''}
                                    onChange={(e) => handleFormFieldChange(index, 'key', e.target.value.replace(/\s+/g, ''))}
                                    onBlur={(e) => handleFormFieldBlur(index, 'key', e.target.value.replace(/\s+/g, ''))}
                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                            </div>
                            <div>
                                <label htmlFor={`field-label-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Label</label>
                                <input
                                    type="text"
                                    id={`field-label-${index}`}
                                    placeholder="e.g., Customer Name"
                                    value={field.label || ''}
                                    onChange={(e) => handleFormFieldChange(index, 'label', e.target.value)}
                                    onBlur={(e) => handleFormFieldBlur(index, 'label', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label htmlFor={`field-type-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Field Type</label>
                                <select
                                    id={`field-type-${index}`}
                                    value={field.type || 'text'}
                                    onChange={(e) => handleFormFieldChange(index, 'type', e.target.value)}
                                    onBlur={(e) => handleFormFieldBlur(index, 'type', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                                >
                                    {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor={`field-placeholder-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Placeholder (Optional)</label>
                                <input
                                    type="text"
                                    id={`field-placeholder-${index}`}
                                    placeholder="e.g., Enter full name"
                                    value={field.placeholder || ''}
                                    onChange={(e) => handleFormFieldChange(index, 'placeholder', e.target.value)}
                                    onBlur={(e) => handleFormFieldBlur(index, 'placeholder', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                            </div>
                        </div>
                        
                        {field.type === 'select' && (
                            <div>
                                <label htmlFor={`field-options-${index}`} className="block text-xs font-medium text-gray-600 mb-0.5">Options (comma-separated)</label>
                                <input
                                    type="text"
                                    id={`field-options-${index}`}
                                    placeholder="e.g., Option A,Option B,Option C"
                                    value={field.options || ''}
                                    onChange={(e) => handleFormFieldChange(index, 'options', e.target.value)}
                                    onBlur={(e) => handleFormFieldBlur(index, 'options', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs"
                                />
                            </div>
                        )}
                        <div className="flex items-center mt-1">
                            <input
                                id={`field-required-${index}`}
                                type="checkbox"
                                checked={!!field.required}
                                onChange={(e) => handleFormFieldChange(index, 'required', e.target.checked)}
                                onBlur={(e) => handleFormFieldBlur(index, 'required', e.target.checked)}
                                className="h-3.5 w-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor={`field-required-${index}`} className="ml-2 block text-xs font-medium text-gray-700">
                                Required Field
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};