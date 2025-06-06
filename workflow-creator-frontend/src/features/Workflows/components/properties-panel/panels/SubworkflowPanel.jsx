import React, { useState, useEffect } from 'react';
import workflowService from '../../../../../lib/workflowService';
import { Loader2 } from 'lucide-react';

export const SubworkflowPanel = ({ config, handleConfigChange, handleConfigBlur }) => {
    const [availableWorkflows, setAvailableWorkflows] = useState([]);
    const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
    const [errorLoadingWorkflows, setErrorLoadingWorkflows] = useState(null);

    useEffect(() => {
        setIsLoadingWorkflows(true);
        setErrorLoadingWorkflows(null);
        workflowService.listWorkflows({ status: 'Active', fields: 'name,_id,version' })
            .then(fetchedWorkflows => {
                setAvailableWorkflows(fetchedWorkflows || []);
            })
            .catch(err => {
                console.error("Error fetching workflows for SubworkflowPanel:", err);
                setErrorLoadingWorkflows(err.message || 'Failed to load workflow list.');
            })
            .finally(() => {
                setIsLoadingWorkflows(false);
            });
    }, []);

    const handleSubWorkflowSelectionChange = (e) => {
        const selectedId = e.target.value;
        const selectedWorkflow = availableWorkflows.find(wf => wf._id === selectedId);
        
        handleConfigChange({ target: { name: 'subWorkflowId', value: selectedId } });
        handleConfigChange({ target: { name: 'selectedSubWorkflowName', value: selectedWorkflow ? selectedWorkflow.name : '' } });
    };

    const handleJsonTextareaChange = (e) => {
        handleConfigChange({ target: { name: e.target.name, value: e.target.value } });
    };

    const handleJsonTextareaBlur = (e) => {
        let valueToSave = e.target.value;
        try {
            valueToSave = JSON.parse(e.target.value || '{}');
        } catch (err) {
            console.warn(`Mapping for ${e.target.name} is not valid JSON, saving as string:`, e.target.value);
        }
        handleConfigBlur({ target: { name: e.target.name, value: valueToSave } });
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="subWorkflowIdSelect" className="block text-xs font-medium text-gray-700 mb-1">
                    Select Sub-Workflow:
                </label>
                {isLoadingWorkflows && (
                    <div className="flex items-center text-sm text-gray-500">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        <span>Loading workflows...</span>
                    </div>
                )}
                {errorLoadingWorkflows && (
                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded">Error: {errorLoadingWorkflows}</p>
                )}
                {!isLoadingWorkflows && !errorLoadingWorkflows && (
                    <select
                        id="subWorkflowIdSelect"
                        name="subWorkflowId"
                        value={config?.subWorkflowId || ''}
                        onChange={handleSubWorkflowSelectionChange}
                        onBlur={(e) => { 
                            const selectedId = e.target.value;
                            const selectedWorkflow = availableWorkflows.find(wf => wf._id === selectedId);
                            handleConfigBlur({ target: { name: 'subWorkflowId', value: selectedId } });
                            if(selectedWorkflow) {
                                handleConfigBlur({ target: { name: 'selectedSubWorkflowName', value: selectedWorkflow.name } });
                            } else {
                                handleConfigBlur({ target: { name: 'selectedSubWorkflowName', value: '' } });
                            }
                        }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    >
                        <option value="">-- Select a workflow --</option>
                        {availableWorkflows.map(wf => (
                            <option key={wf._id} value={wf._id}>
                                {wf.name} (v{wf.version || 1})
                            </option>
                        ))}
                    </select>
                )}
                <p className="mt-1 text-xs text-gray-500">
                    Choose an "Active" workflow definition to run as a sub-process.
                </p>
            </div>

            <div>
                <label htmlFor="subWorkflowInputMapping" className="block text-xs font-medium text-gray-700 mb-1">
                    Input Data Mapping (JSON):
                </label>
                <textarea
                    id="subWorkflowInputMapping"
                    name="inputMapping"
                    rows={5}
                    value={typeof config?.inputMapping === 'object' ? JSON.stringify(config.inputMapping, null, 2) : config?.inputMapping || '{}'}
                    onChange={handleJsonTextareaChange}
                    onBlur={handleJsonTextareaBlur}
                    placeholder={'{\n  "subWorkflowVar": "{{parentContextKey}}",\n  "anotherInput": "staticValue"\n}'}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-mono bg-white text-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Map parent context to sub-workflow inputs. Use `{"{{contextKey}}"}`` for dynamic values from parent.
                </p>
            </div>
            
            {/* Output Data Mapping Section */}
            <div>
                <label htmlFor="subWorkflowOutputMapping" className="block text-xs font-medium text-gray-700 mb-1">
                    Output Data Mapping (JSON):
                </label>
                <textarea
                    id="subWorkflowOutputMapping"
                    name="outputMapping"
                    rows={5}
                    value={typeof config?.outputMapping === 'object' ? JSON.stringify(config.outputMapping, null, 2) : config?.outputMapping || '{}'}
                    onChange={handleJsonTextareaChange}
                    onBlur={handleJsonTextareaBlur}
                    placeholder={'{\n  "parentContextKeyToStore": "{{subWorkflowOutputVar}}",\n  "anotherParentKey": "staticOutputValue"\n}'}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs font-mono bg-white text-gray-900"
                />
                <p className="mt-1 text-xs text-gray-500">
                    Map completed sub-workflow context back to parent context. Use `{"{{subWorkflowKey}}"}``.
                </p>
            </div>

            <div className="flex items-center mt-2">
                <input
                    id="subWorkflowWaitForCompletion"
                    type="checkbox"
                    name="waitForCompletion"
                    checked={config?.waitForCompletion !== undefined ? config.waitForCompletion : true}
                    onChange={(e) => handleConfigChange({ target: { name: 'waitForCompletion', value: e.target.checked }})}
                    onBlur={(e) => handleConfigBlur({ target: { name: 'waitForCompletion', value: e.target.checked }})}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="subWorkflowWaitForCompletion" className="ml-2 block text-sm text-gray-900">
                    Wait for sub-workflow to complete?
                </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
                If checked, the parent workflow will pause until the sub-workflow finishes. Output mapping only applies if waiting.
            </p>
        </div>
    );
};