import React, { useState, useEffect, useCallback } from 'react';
import { DefaultPanel } from './properties-panel/panels/DefaultPanel.jsx';
import { TaskPanel } from './properties-panel/panels/TaskPanel.jsx';
import { ApprovalPanel } from './properties-panel/panels/ApprovalPanel.jsx';
import { DecisionPanel } from './properties-panel/panels/DecisionPanel.jsx';
import { AutomatedTaskPanel } from './properties-panel/panels/AutomatedTaskPanel.jsx';
import { FileUploadPanel } from './properties-panel/panels/FileUploadPanel.jsx';
import { SubworkflowPanel } from './properties-panel/panels/SubworkflowPanel.jsx';
import { EdgePanel } from './properties-panel/panels/EdgePanel.jsx';
import { WorkflowGeneralSettingsPanel } from './properties-panel/panels/WorkflowGeneralSettingsPanel.jsx';
import { NotificationPanel } from './properties-panel/panels/NotificationPanel.jsx';
import { TimerPanel } from './properties-panel/panels/TimerPanel.jsx';
import { ParallelSplitPanel } from './properties-panel/panels/ParallelSplitPanel.jsx';
import { ParallelJoinPanel } from './properties-panel/panels/ParallelJoinPanel.jsx';

const PropertiesPanel = ({ 
  selectedElement, 
  nodes, 
  edges, 
  updateElementData,
  workflowName,
  onWorkflowNameChange,
  workflowDescription,
  onWorkflowDescriptionChange,
  expectedContextFields,
  onExpectedContextFieldsChange,
  isWorkflowSelected
}) => {
  const [elementType, setElementType] = useState(null);
  const [elementData, setElementData] = useState({});
  const [elementId, setElementId] = useState(null);

  useEffect(() => {
    if (selectedElement) {
      setElementType(selectedElement.type);
      setElementId(selectedElement.element.id);
      
      const currentElementObject = selectedElement.type === 'node'
        ? nodes.find(n => n.id === selectedElement.element.id)
        : edges.find(e => e.id === selectedElement.element.id);
      
      setElementData({ ...(currentElementObject?.data || {}) });
    } else {
      setElementType(null);
      setElementId(null);
      setElementData({});
    }
  }, [selectedElement, nodes, edges]);

  const handleChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const val = type === 'checkbox' ? checked : value;
    setElementData(prev => ({ ...prev, [name]: val }));
  }, []);

  const handleConfigChange = useCallback((event) => {
    const { name, value, type, checked } = event.target;
    const isCheckbox = type === 'checkbox';
    const val = isCheckbox ? checked : value;

    console.log(`DEBUG: PropertiesPanel - handleConfigChange - Name: ${name}, Value: ${val}`); 

    setElementData(prev => {
      const newConfig = { ...(prev.config || {}), [name]: val };
      console.log(`DEBUG: PropertiesPanel - handleConfigChange - newElementData.config after set:`, newConfig);
      return { ...prev, config: newConfig };
    });

    if ((isCheckbox || Array.isArray(val)) && elementId && elementType === 'node') {
      const updatedConfigForParent = { ...(elementData.config || {}), [name]: val };
      console.log(`DEBUG: PropertiesPanel - handleConfigChange - Immediate update for ${name}:`, updatedConfigForParent);
      updateElementData(elementType, elementId, { config: updatedConfigForParent });
    }
  }, [elementId, elementType, updateElementData, elementData]);

  const handleBlur = useCallback((event) => {
    const { name } = event.target;
    if (elementId && elementType) {
      const originalValue = selectedElement?.element?.data?.[name];
      if (elementData[name] !== originalValue) {
        updateElementData(elementType, elementId, { [name]: elementData[name] });
      }
    }
  }, [elementId, elementType, elementData, selectedElement, updateElementData]);

  const handleConfigBlur = useCallback((event) => {
    const { name, type } = event.target;
    
    if (type === 'checkbox' || Array.isArray(elementData.config?.[name])) return;

    if (elementId && elementType === 'node') {
      const originalFullConfigFromProp = selectedElement?.element?.data?.config || {};
      const currentFullLocalConfig = elementData.config || {};

      const originalSpecificValue = originalFullConfigFromProp[name];
      const currentSpecificValue = currentFullLocalConfig[name];

      if (String(currentSpecificValue ?? '') !== String(originalSpecificValue ?? '')) {
          console.log(`DEBUG: PropertiesPanel - handleConfigBlur - Change detected for config.${name}. Sending entire local config.`);
          console.log(`DEBUG: PropertiesPanel - handleConfigBlur - Entire local elementData.config being sent up:`, JSON.stringify(currentFullLocalConfig, null, 2));
          updateElementData(elementType, elementId, { config: { ...currentFullLocalConfig } });
      }
    } else if (elementId && elementType === 'edge') {
      const originalValue = selectedElement?.element?.data?.[name];
      if (elementData[name] !== originalValue) {
          updateElementData(elementType, elementId, { [name]: elementData[name] });
      }
    }
  }, [elementId, elementType, elementData, selectedElement, updateElementData]);

  const handleDefaultPanelConfigBlur = useCallback((event) => {
    const { name } = event.target;
    if (name !== 'config') return;
    if (elementId && elementType === 'node') {
      const originalValueString = JSON.stringify(selectedElement?.element?.data?.config || {});
      const currentValueString = typeof elementData.config === 'string' ? elementData.config : JSON.stringify(elementData.config || {});
      if (currentValueString !== originalValueString) {
        try {
          const parsedValue = JSON.parse(currentValueString || '{}');
          updateElementData(elementType, elementId, { config: parsedValue });
        } catch {
          updateElementData(elementType, elementId, { config: currentValueString });
        }
      }
    }
  }, [elementId, elementType, elementData, selectedElement, updateElementData]);

  const handleJsonObjectBlur = useCallback((event) => {
    const { name } = event.target;
    if (elementId && elementType) {
      const originalValueString = JSON.stringify(selectedElement?.element?.data?.[name] || {});
      const dataObject = name === 'config' ? elementData.config : elementData;
      const currentValueStringOrObject = dataObject?.[name];
      const currentValueString = typeof currentValueStringOrObject === 'object'
        ? JSON.stringify(currentValueStringOrObject)
        : currentValueStringOrObject || '{}';

      if (currentValueString !== originalValueString) {
        try {
          const parsedValue = JSON.parse(currentValueString || '{}');
          if (name === 'config' && typeof elementData.config === 'object' && elementData.config !== null) {

             updateElementData(elementType, elementId, { config: parsedValue });
          } else if (name !== 'config') {
             updateElementData(elementType, elementId, { [name]: parsedValue });
          }
        } catch {
          if (name === 'config' && typeof elementData.config === 'object' && elementData.config !== null) {
            updateElementData(elementType, elementId, { config: { ...(elementData.config || {}), [name]: currentValueString } });
          } else if (name !== 'config') {
            updateElementData(elementType, elementId, { [name]: currentValueString });
          }
        }
      }
    }
  }, [elementId, elementType, elementData, selectedElement, updateElementData]);

  if (isWorkflowSelected) {
    return (
      <WorkflowGeneralSettingsPanel
        workflowName={workflowName}
        onWorkflowNameChange={onWorkflowNameChange}
        workflowDescription={workflowDescription}
        onWorkflowDescriptionChange={onWorkflowDescriptionChange}
        expectedContextFields={expectedContextFields}
        onExpectedContextFieldsChange={onExpectedContextFieldsChange}
      />
    );
  }

  if (!elementType || !elementId) {
    return <div className="p-4 text-sm text-gray-500">Select a node, edge, or clear selection to see workflow settings.</div>;
  }

  const currentElementObject = elementType === 'node'
    ? nodes.find(n => n.id === elementId)
    : edges.find(e => e.id === elementId);

  const renderSpecificPanel = () => {
    console.log('PropertiesPanel - renderSpecificPanel - Selected Element ID:', elementId);
    console.log('PropertiesPanel - renderSpecificPanel - Element Data (for panel):', JSON.stringify(elementData, null, 2)); 
    if (elementType === 'edge') {
      return <EdgePanel edgeData={elementData} handleEdgeDataChange={handleChange} handleEdgeDataBlur={handleBlur} />;
    }
    if (elementType === 'node') {
      const nodeBackendType = elementData.type?.toLowerCase();
      console.log('PropertiesPanel - Rendering panel for node type:', nodeBackendType, 'with config:', JSON.stringify(elementData.config, null, 2));
      const commonProps = {
        config: elementData.config || {},
        handleConfigChange: handleConfigChange,
        handleConfigBlur: handleConfigBlur,
        handleJsonObjectBlur: handleJsonObjectBlur,
        handleChange: handleChange,
        handleBlur: handleBlur,
      };
      switch (nodeBackendType) {
        case 'task': return <TaskPanel {...commonProps} />;
        case 'approval': return <ApprovalPanel {...commonProps} />;
        case 'decision': return <DecisionPanel {...commonProps} />;
        case 'timer':
          if (!TimerPanel) return <p className="text-red-500 p-4">Error: TimerPanel component failed to load.</p>;
          return <TimerPanel 
                config={elementData.config || {}} 
                handleConfigChange={handleConfigChange} 
                handleConfigBlur={handleConfigBlur}     
            />;
        case 'notification':
          if (!NotificationPanel) return <p className="text-red-500 p-4">Error: NotificationPanel component failed to load.</p>;
          return <NotificationPanel 
                config={elementData.config || {}} 
                handleConfigChange={handleConfigChange} 
                handleConfigBlur={handleConfigBlur}
            />;
        case 'automatedtask': 
          if (!AutomatedTaskPanel) return <p className="text-red-500 p-4">Error: AutomatedTaskPanel component failed to load.</p>;
          return <AutomatedTaskPanel 
                nodeId={elementId}
                config={elementData.config || {}}
                handleConfigChange={handleConfigChange}
                handleConfigBlur={handleConfigBlur}
                handleJsonObjectBlur={handleJsonObjectBlur}
                updateElementData={updateElementData}
             />;
        case 'fileupload': 
          if (!FileUploadPanel) return <p className="text-red-500 p-4">Error: FileUploadPanel component failed to load.</p>; 
          return <FileUploadPanel 
                nodeId={elementId} 
                config={elementData.config || {}} 
                updateNodeData={updateElementData}
                handleConfigChange={handleConfigChange} 
                handleConfigBlur={handleConfigBlur}     
             />;       
        case 'subworkflow':
           if (!SubworkflowPanel) return <p className="text-red-500 p-4">Error: SubworkflowPanel component failed to load.</p>;
            return <SubworkflowPanel 
                config={elementData.config || {}} 
                handleConfigChange={handleConfigChange} 
                handleConfigBlur={handleConfigBlur} 
         />;
         case 'parallelsplit':
                return <ParallelSplitPanel 
                            nodeId={elementId}
                            nodeLabel={elementData.label}
                            config={elementData.config} 
                            updateElementData={updateElementData}
                            handleConfigChange={handleConfigChange}
                        />;
            case 'paralleljoin':
                return <ParallelJoinPanel
                            nodeId={elementId}
                            nodeLabel={elementData.label}
                            config={elementData.config} 
                            updateElementData={updateElementData}
                            handleConfigChange={handleConfigChange}
                        />;
        case 'start': case 'end': return <p className="text-sm text-gray-500">No configuration for {elementData.type}.</p>;
        default:
          return <DefaultPanel
            formData={elementData}
            handleChange={handleChange}
            handleBlur={handleBlur}
            handleConfigChange={(e) => handleChange({ target: { name: 'config', value: e.target.value } })}
            handleConfigBlur={handleDefaultPanelConfigBlur}
          />;
      }
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col space-y-4">
        <div>
          <label htmlFor="elementIdInput" className="block text-xs font-medium text-gray-700 mb-1">ID:</label>
          <input id="elementIdInput" type="text" value={elementId} readOnly disabled className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-gray-500 text-sm cursor-not-allowed"/>
        </div>
        {elementType === 'node' && (
          <>
            <div>
              <label htmlFor="nodeBackendTypeInput" className="block text-xs font-medium text-gray-700 mb-1">Backend Type:</label>
              <input id="nodeBackendTypeInput" type="text" value={elementData.type || ''} name="type" readOnly disabled className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-gray-500 text-sm cursor-not-allowed"/>
            </div>
            <div>
              <label htmlFor="nodeLabelInput" className="block text-xs font-medium text-gray-700 mb-1">Label:</label>
              <input
                id="nodeLabelInput"
                type="text"
                name="label"
                value={elementData.label || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
              />
            </div>
            <div>
              <label htmlFor="nodeDescInput" className="block text-xs font-medium text-gray-700 mb-1">Description:</label>
              <textarea
                id="nodeDescInput"
                name="description"
                rows={2}
                value={elementData.description || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
              />
            </div>
            <h4 className="text-sm font-medium text-gray-800 border-t border-gray-200 pt-3 mt-2 mb-2">Configuration ({elementData.type || 'N/A'})</h4>
          </>
        )}
         {elementType === 'edge' && (
          <>
            <div>
              <label htmlFor="edgeLabelInput" className="block text-xs font-medium text-gray-700 mb-1">Edge Label (Optional):</label>
              <input
                id="edgeLabelInput"
                type="text"
                name="label"
                value={elementData.label || ''}
                onChange={handleChange}
                onBlur={handleBlur}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              <span className="font-medium">Source:</span> {currentElementObject?.source} <br/>
              <span className="font-medium">Target:</span> {currentElementObject?.target}
            </div>
            <h4 className="text-sm font-medium text-gray-800 border-t border-gray-200 pt-3 mt-2 mb-2">Edge Configuration</h4>
          </>
        )}
        <div className="flex flex-col space-y-4">
          {renderSpecificPanel()}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPanel;