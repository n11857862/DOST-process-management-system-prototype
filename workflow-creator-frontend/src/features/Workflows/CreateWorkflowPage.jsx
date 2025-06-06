import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import {
    ReactFlowProvider,
    useNodesState,
    useEdgesState,
    addEdge
} from 'reactflow';

import VisualDesigner from './components/visual-designer/VisualDesigner.jsx';
import Palette from './components/Palette.jsx';
import PropertiesPanel from './components/PropertiesPanel.jsx';

import {
  ChevronLeft,
  ChevronRight,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { nodeTypes as customNodeTypes } from './components/visual-designer/nodes/nodeRegistry.js';

import workflowService from '../../lib/workflowService.js'; 
import { translateFlowToSteps } from './utils/workflowTranslator.js';
import { v4 as uuidv4 } from 'uuid';

const newWorkflowInitialNodes = [
  { 
    id: 'start-1', 
    type: 'input', 
    position: { x: 150, y: 50 }, 
    data: { label: 'Start', type: 'Start' } 
  },
  { 
    id: 'task-1', 
    type: 'task', 
    position: { x: 100, y: 150 }, 
    data: { 
      label: 'Submit Request', 
      type: 'Task', 
      description: 'User submits the initial request form.', 
      config: { 
        assignTo: 'initiator',
        priority: 'Medium'
      }, 
      reactFlowType: 'task' 
    } 
  },
  { 
    id: 'decide-1', 
    type: 'decision', 
    position: { x: 300, y: 250 }, 
    data: { 
      label: 'Amount > 1000?', 
      type: 'Decision', 
      config: {}, 
      reactFlowType: 'decision' 
    } 
  },
  { 
    id: 'approve-1', 
    type: 'approval', 
    position: { x: 200, y: 350 }, 
    data: { 
      label: 'Manager Approval', 
      type: 'Approval', 
      config: { approverRule: 'Manager' }, 
      reactFlowType: 'approval' 
    } 
  },
  { 
    id: 'auto-task-1', 
    type: 'automatedTask', 
    position: { x: 400, y: 350 }, 
    data: { 
      label: 'Update CRM', 
      type: 'AutomatedTask', 
      description: 'Sync data with external CRM API', 
      config: { 
        taskType: 'apiCall',
        apiUrl: 'https://mycrm.com/api/update', 
        apiMethod: 'POST' 
      }, 
      reactFlowType: 'automatedTask' 
    } 
  },
  { 
    id: 'end-1', 
    type: 'output', 
    position: { x: 450, y: 50 }, 
    data: { 
      label: 'End', 
      type: 'End' 
    } 
  }
];

const newWorkflowInitialEdges = [];

const initialExpectedContextFields = [];

function CreateWorkflowPage() {
  const { workflowId: paramWorkflowId } = useParams();
  console.log('CreateWorkflowPage loaded with workflowId:', paramWorkflowId);
  const navigate = useNavigate();

  const [loadedWorkflowId, setLoadedWorkflowId] = useState(null);
  
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  
  const [expectedContextFields, setExpectedContextFields] = useState(initialExpectedContextFields);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]); 
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [saveStatus, setSaveStatus] = useState({ 
    loading: false, 
    errors: [], 
    success: false, 
    message: '' 
  });
  const [isLoadingWorkflow, setIsLoadingWorkflow] = useState(false);

  const [isPaletteCollapsed, setIsPaletteCollapsed] = useState(false);
  const [isPropertiesCollapsed, setIsPropertiesCollapsed] = useState(false);
  const designerWrapperRef = useRef(null);

  const handleNodeConfigChange = useCallback((nodeId, configName, configValue, valueType = 'string') => {
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    let processedValue = configValue;
                    if (valueType === 'checkbox') {
                        processedValue = typeof configValue === 'boolean' ? configValue : !node.data.config?.[configName];
                    } else if (valueType === 'number') {
                        processedValue = parseFloat(configValue);
                        if (isNaN(processedValue)) processedValue = node.data.config?.[configName] || 0;
                    }

                    const newConfig = {
                        ...node.data.config,
                        [configName]: processedValue,
                    };
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            config: newConfig,
                        },
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

  useEffect(() => {
    console.log(`Effect triggered. paramWorkflowId: ${paramWorkflowId}, loadedWorkflowId: ${loadedWorkflowId}`);

    if (paramWorkflowId) {
      if (paramWorkflowId !== loadedWorkflowId) {
        setIsLoadingWorkflow(true);
        console.log(`Attempting to load workflow with ID: ${paramWorkflowId}`);
        
        workflowService.getWorkflowById(paramWorkflowId)
          .then(data => {
            console.log('Data received from getWorkflowById:', JSON.stringify(data, null, 2));
            
            if (data && data.flow && Array.isArray(data.flow.nodes) && Array.isArray(data.flow.edges)) {
              console.log('Setting workflow data:', data.name, data.flow.nodes.length, 'nodes,', data.flow.edges.length, 'edges');
              
              setWorkflowName(data.name || 'Untitled Workflow');
              setWorkflowDescription(data.description || '');
              setExpectedContextFields(data.expectedContextFields || initialExpectedContextFields);
              setNodes(data.flow.nodes);
              setEdges(data.flow.edges);
              
              setLoadedWorkflowId(paramWorkflowId);
              
              setSaveStatus(prev => ({ ...prev, message: `Loaded workflow: ${data.name}`}));
            } else {
              console.error("Loaded data is not in the expected format or flow/nodes/edges are missing. Response was:", data);
              
              if (data) {
                if (!data.flow) console.error("Missing 'flow' property in data");
                else {
                  if (!Array.isArray(data.flow.nodes)) console.error("data.flow.nodes is not an array:", data.flow.nodes);
                  if (!Array.isArray(data.flow.edges)) console.error("data.flow.edges is not an array:", data.flow.edges);
                }
              } else {
                console.error("Received null or undefined data from API");
              }
              
              setWorkflowName('New Workflow');
              setWorkflowDescription('');
              setExpectedContextFields(initialExpectedContextFields);
              setNodes(newWorkflowInitialNodes);
              setEdges(newWorkflowInitialEdges);
              setLoadedWorkflowId(null);
              navigate('/designer', { replace: true });
              setSaveStatus(prev => ({...prev, loading: false, errors: ['Failed to parse workflow structure. Starting new.'], success: false}));
            }
          })
          .catch(err => {
            console.error("Error fetching workflow in useEffect:", err);
            
            if (err.response) {
              console.error("Response status:", err.response.status);
              console.error("Response data:", err.response.data);
            } else if (err.request) {
              console.error("Request was made but no response received");
            } else {
              console.error("Error message:", err.message);
            }
            
            setSaveStatus({ 
              loading: false, 
              errors: [`Failed to load workflow: ${err.message || 'Unknown error'}`], 
              success: false, 
              message: '' 
            });
            
            setWorkflowName('New Workflow');
            setWorkflowDescription('');
            setExpectedContextFields(initialExpectedContextFields);
            setNodes(newWorkflowInitialNodes);
            setEdges(newWorkflowInitialEdges);
            setLoadedWorkflowId(null);
            navigate('/designer', { replace: true });
          })
          .finally(() => {
            setIsLoadingWorkflow(false);
          });
      } else {
        setIsLoadingWorkflow(false);
        console.log(`Data for workflow ID ${paramWorkflowId} is already loaded.`);
      }
    } else {
      console.log('No workflowId in URL, initializing a new workflow.');
      setWorkflowName('New Workflow');
      setWorkflowDescription('');
      setExpectedContextFields(initialExpectedContextFields);
      setNodes(newWorkflowInitialNodes);
      setEdges(newWorkflowInitialEdges);
      setLoadedWorkflowId(null);
      setIsLoadingWorkflow(false);
    }
  }, [paramWorkflowId, loadedWorkflowId, setNodes, setEdges, navigate]);

  useEffect(() => {
    if (reactFlowInstance && nodes.length > 0 && !isLoadingWorkflow) {
      setTimeout(() => {
        reactFlowInstance.fitView({ padding: 0.1, duration: 200 });
      }, 100);
    }
  }, [reactFlowInstance, nodes, isLoadingWorkflow]);

  useEffect(() => {
    let timer;
    if (saveStatus.success || saveStatus.errors.length > 0) {
        timer = setTimeout(() => {
             setSaveStatus(prev => ({ ...prev, errors: [], success: false }));
        }, 4000);
    }
    return () => clearTimeout(timer);
  }, [saveStatus.success, saveStatus.errors]);

const onConnect = useCallback(
  (params) => {
    const sourceNode = nodes.find(n => n.id === params.source);
    let edgeData = {};
    let edgeLabel = undefined; 

    const nodeTypeForSwitch = sourceNode?.data?.reactFlowType || sourceNode?.type;

    switch (nodeTypeForSwitch) {
        case 'decision': {
            const conditionType = params.sourceHandle || 'default';
            edgeData = { conditionType: conditionType, conditionExpression: '' };
            if (conditionType === 'true') edgeLabel = 'Yes';
            else if (conditionType === 'false') edgeLabel = 'No';
            else if (conditionType !== 'default') edgeLabel = conditionType;
            break;
        }
        case 'approval': {
            const outcomeType = params.sourceHandle;
            edgeData = { conditionType: outcomeType }; 
            if (outcomeType === 'approved') {
                edgeLabel = 'Approved';
            } else if (outcomeType === 'rejected') {
                edgeLabel = 'Rejected';
            } else {
                edgeLabel = 'Next';
            }
            break;
        }
        default:
            break;
    }
    
    setEdges((eds) => addEdge({ 
      ...params, 
      data: edgeData, 
      label: edgeLabel, 
      type: 'default'
    }, eds));
  },
  [nodes, setEdges]
);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();
        
        const reactFlowNodeType = event.dataTransfer.getData('application/reactflow-nodetype');
        const nodeInitialDataString = event.dataTransfer.getData('application/reactflow-data');
        
        let nodeInitialData = {};
        try {
            nodeInitialData = JSON.parse(nodeInitialDataString || '{}');
        } catch (e) {
            console.error("Failed to parse nodeInitialData from drag event:", e);
        }
    
        if (typeof reactFlowNodeType === 'undefined' || !reactFlowNodeType || !reactFlowInstance) {
            console.warn("onDrop: reactFlowNodeType or reactFlowInstance is undefined.", {reactFlowNodeType, reactFlowInstanceExists: !!reactFlowInstance});
            return;
        }
        
        const reactFlowBounds = designerWrapperRef.current?.getBoundingClientRect();
        if (!reactFlowBounds) {
            console.warn("onDrop: reactFlowBounds is undefined.");
            return;
        }
        
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX - reactFlowBounds.left,
            y: event.clientY - reactFlowBounds.top,
        });
        
        const newNodeId = uuidv4();
        const finalLabel = nodeInitialData.label || `Node ${newNodeId.substring(0,4)}`;

        const newNode = {
            id: newNodeId,
            type: reactFlowNodeType,
            position,
            data: { ...nodeInitialData, label: finalLabel }, 
        };
        
        console.log("Dropping New Node:", JSON.stringify(newNode, null, 2));
        setNodes((nds) => nds.concat(newNode));
    }, [reactFlowInstance, setNodes]);

  const updateElementData = useCallback((elementType, elementId, newData) => {
    console.log(`DEBUG: CreateWorkflowPage - updateElementData - For ${elementId}, newData:`, JSON.stringify(newData, null, 2));
    if (elementType === 'node') {
      setNodes((nds) =>
        nds.map((node) => node.id === elementId ? { ...node, data: { ...(node.data || {}), ...newData } } : node)
      );
    } else if (elementType === 'edge') {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === elementId) {
            const updatedData = { ...(edge.data || {}), ...newData };
            const updatedEdge = { ...edge, data: updatedData };
            if (newData.label !== undefined) updatedEdge.label = newData.label;
            return updatedEdge;
          }
          return edge;
        })
      );
    }
  }, [setNodes, setEdges]);

  const handleSave = useCallback(async () => {
    console.log('DEBUG: handleSave function called.');
    setSaveStatus({ loading: true, errors: [], success: false, message: '' });
    
    console.log('DEBUG: Starting validation...');
    let validationErrors = [];
    
    if (!workflowName.trim()) validationErrors.push('Workflow name is required.');
    if (nodes.length === 0) validationErrors.push('Workflow cannot be empty.');
    
    const startNodes = nodes.filter(n => n.data?.type === 'Start' || n.type === 'input');
    if (startNodes.length !== 1) validationErrors.push('Workflow must have exactly one Start node.');
    
    const endNodes = nodes.filter(n => n.data?.type === 'End' || n.type === 'output');
    if (endNodes.length === 0) validationErrors.push('Workflow must have at least one End node.');
    
    console.log('DEBUG: Frontend validation errors:', validationErrors);
    
    
    let translationErrors = [];
    
    if (validationErrors.length === 0 && typeof translateFlowToSteps === 'function') {
      console.log('DEBUG: Frontend validation passed. Translating flow...');
      try {
        const result = translateFlowToSteps(nodes, edges);
        translationErrors = result.errors;
        
        if (result.steps.length === 0 && result.errors.length === 0) {
          translationErrors.push("Workflow translation resulted in no executable steps.");
        }
        
        console.log('DEBUG: Translation result:', { steps: result.steps, translationErrors });
      } catch(translationError) {
        console.error("DEBUG: Error during translation:", translationError);
        translationErrors.push(`Translation Error: ${translationError.message}`);
      }
    }
    
    const allErrors = [...validationErrors, ...translationErrors];
    if (allErrors.length > 0) {
      console.error("DEBUG: Save aborted due to errors:", allErrors);
      setSaveStatus({ loading: false, errors: allErrors, success: false, message: '' });
      return;
    }
    console.log('TASK NODE CONFIGS BEFORE SAVE:', 
    JSON.stringify(
      nodes.filter(n => n.data.type === 'Task' || n.data.reactFlowType === 'task')
           .map(n => ({ id: n.id, config: n.data.config })),
      null, 
      2
    )
  );

const workflowDataPayload = { 
  name: workflowName, 
  description: workflowDescription, 
  flow: { nodes, edges },
  status: 'Active',
  expectedContextFields: expectedContextFields
};
    
    console.log('DEBUG: Preparing to send data to backend:', workflowDataPayload);
    
    try {
      let savedOrUpdatedWorkflow;
      let successMessage = '';
      
      if (loadedWorkflowId) {
        console.log(`DEBUG: Updating workflow based on version ID: ${loadedWorkflowId}`);
        console.log('PAYLOAD BEING SENT TO BACKEND:', JSON.stringify(workflowDataPayload, null, 2));
        savedOrUpdatedWorkflow = await workflowService.updateWorkflow(loadedWorkflowId, workflowDataPayload);
        console.log('DEBUG: Backend call successful (updated/new version). Full response:', savedOrUpdatedWorkflow);
        
        successMessage = `Workflow [${savedOrUpdatedWorkflow.name}] updated successfully (New Version ID: ${savedOrUpdatedWorkflow._id})!`;
        
        setWorkflowName(savedOrUpdatedWorkflow.name);
        setWorkflowDescription(savedOrUpdatedWorkflow.description || '');
        setExpectedContextFields(savedOrUpdatedWorkflow.expectedContextFields || initialExpectedContextFields);
        if (savedOrUpdatedWorkflow.flow) {
            setNodes(savedOrUpdatedWorkflow.flow.nodes || []);
            setEdges(savedOrUpdatedWorkflow.flow.edges || []);
        }
        setLoadedWorkflowId(savedOrUpdatedWorkflow._id);
        navigate(`/designer/${savedOrUpdatedWorkflow._id}`, { replace: true });
      } else {
        console.log('DEBUG: Creating new workflow');
        console.log('PAYLOAD BEING SENT TO BACKEND:', JSON.stringify(workflowDataPayload, null, 2));
        savedOrUpdatedWorkflow = await workflowService.createWorkflow(workflowDataPayload);
        console.log('DEBUG: Backend call successful (created new). Full response:', savedOrUpdatedWorkflow);
        
        successMessage = `Workflow [${savedOrUpdatedWorkflow.name}] created successfully (ID: ${savedOrUpdatedWorkflow._id})!`;
        
        setLoadedWorkflowId(savedOrUpdatedWorkflow._id);
        navigate(`/designer/${savedOrUpdatedWorkflow._id}`, { replace: true });
      }
      
      setSaveStatus({ 
        loading: false, 
        errors: [], 
        success: true, 
        message: successMessage 
      });
      
    } catch (error) {
      console.error('DEBUG: Save/Update workflow failed:', error);
      
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      } else if (error.request) {
        console.error("Request was made but no response received");
      } else {
        console.error("Error message:", error.message);
      }
      
      const backendErrorMessage = error.response?.data?.message || 
                                 error.response?.data?.error || 
                                 error.message || 
                                 "Unknown backend error";
      setSaveStatus({ 
        loading: false, 
        errors: [`Save Failed: ${backendErrorMessage}`], 
        success: false,
        message: '' 
      });
    }
  }, [
    workflowName, 
    workflowDescription, 
    nodes, 
    edges, 
    expectedContextFields,
    loadedWorkflowId, 
    navigate,
    setNodes,
    setEdges
  ]);

  if (isLoadingWorkflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
        <p className="ml-4 text-xl text-gray-700">Loading Workflow...</p>
      </div>
    );
  }
console.log("CWP: Passing to PropertiesPanel -> selectedElement:", selectedElement ? JSON.parse(JSON.stringify(selectedElement)) : selectedElement, "isWorkflowSelected:", !selectedElement);

  return (
    <ReactFlowProvider>
      <div className="flex flex-col h-full bg-gray-100 font-sans">
        <header className="bg-white border-b border-gray-200 shadow-sm z-10 flex-shrink-0">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-y-2">
              <h1 className="text-xl font-semibold text-gray-800">
                {loadedWorkflowId ? "Edit Workflow" : "Create New Workflow"}
              </h1>
              <div className="flex-1 mx-4 min-w-[200px] text-sm">
                {saveStatus.loading && ( 
                  <div className="flex items-center text-gray-600 animate-pulse">
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    <span>Saving...</span>
                  </div> 
                )}
                {saveStatus.success && saveStatus.message && ( 
                  <div className="flex items-center text-green-600">
                    <CheckCircle2 className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>{saveStatus.message}</span>
                  </div> 
                )}
                {saveStatus.errors.length > 0 && ( 
                  <div className="bg-red-50 border border-red-200 text-red-700 p-2 rounded text-xs">
                    <div className="flex items-center mb-1 font-medium">
                      <AlertCircle className="mr-1.5 h-4 w-4 flex-shrink-0" />
                      <span>Error</span>
                    </div>
                    <ul className="list-disc pl-5">
                      {saveStatus.errors.map((error, i) => ( 
                        <li key={i}>{error}</li> 
                      ))}
                    </ul>
                  </div> 
                )}
              </div>
              <button
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed text-sm font-medium"
                onClick={handleSave}
                disabled={saveStatus.loading}
              >
                {saveStatus.loading ? ( 
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> 
                ) : ( 
                  <Save className="-ml-1 mr-2 h-4 w-4" /> 
                )}
                Save Workflow
              </button>
            </div>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[250px]">
                <label htmlFor="workflowNameInput" className="block text-xs font-medium text-gray-700 mb-1">Name:</label>
                <input 
                  id="workflowNameInput" 
                  type="text" 
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900" 
                  value={workflowName} 
                  onChange={(e) => setWorkflowName(e.target.value)} 
                />
              </div>
              <div className="flex-[2_2_0%] min-w-[350px]">
                <label htmlFor="workflowDescInput" className="block text-xs font-medium text-gray-700 mb-1">Description:</label>
                <textarea 
                  id="workflowDescInput" 
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none bg-white text-gray-900" 
                  rows={1} 
                  value={workflowDescription} 
                  onChange={(e) => setWorkflowDescription(e.target.value)} 
                  placeholder="Optional description" 
                />
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className={`bg-white border-r border-gray-200 flex flex-col flex-shrink-0 ${isPaletteCollapsed ? 'w-12' : 'w-56'} transition-width duration-300 ease-in-out`}>
            <div className="flex items-center justify-between p-2 border-b border-gray-200 h-12 flex-shrink-0">
              {!isPaletteCollapsed && <h3 className="font-medium text-gray-700 text-sm ml-1">Node Palette</h3>}
              <button 
                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300" 
                onClick={() => setIsPaletteCollapsed(!isPaletteCollapsed)} 
                title={isPaletteCollapsed ? "Expand palette" : "Collapse palette"}
              >
                {isPaletteCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
            <div className={`overflow-y-auto flex-grow p-2`}>
              <Palette isCollapsed={isPaletteCollapsed} />
            </div>
          </div>

          <div className="flex-1 bg-gray-200 relative" ref={designerWrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
            <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
            <div className="absolute inset-0">
              <VisualDesigner
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChange} 
                onConnect={onConnect} 
                setReactFlowInstance={setReactFlowInstance} 
                setSelectedElement={setSelectedElement}
                nodeTypes={customNodeTypes}
              />
            </div>
            {nodes.length === 0 && !isLoadingWorkflow && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white bg-opacity-80 p-4 rounded-lg shadow-sm">
                  <p className="text-gray-500">Drag nodes from the palette or load a workflow.</p>
                </div>
              </div>
            )}
          </div>

          <div className={`bg-white border-l border-gray-200 flex flex-col flex-shrink-0 ${isPropertiesCollapsed ? 'w-12' : 'w-72'} transition-width duration-300 ease-in-out`}>
            <div className="flex items-center justify-between p-2 border-b border-gray-200 h-12 flex-shrink-0">
              <button 
                className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-300" 
                onClick={() => setIsPropertiesCollapsed(!isPropertiesCollapsed)} 
                title={isPropertiesCollapsed ? "Expand properties" : "Collapse properties"}
              >
                {isPropertiesCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </button>
              {!isPropertiesCollapsed && (
                <h3 className="font-medium text-gray-700 text-sm mr-1">
                  {!selectedElement ? 'Workflow Settings' : `Properties (${selectedElement.type === 'node' ? 'Node' : 'Edge'})`}
                </h3>
              )}
            </div>
            <div className={`overflow-y-auto flex-grow p-3 ${isPropertiesCollapsed ? 'hidden' : ''}`}>
              <PropertiesPanel 
                selectedElement={selectedElement} 
                nodes={nodes} 
                edges={edges} 
                updateElementData={updateElementData}
                handleNodeConfigChange={handleNodeConfigChange}
                workflowName={workflowName}
                onWorkflowNameChange={setWorkflowName}
                workflowDescription={workflowDescription}
                onWorkflowDescriptionChange={setWorkflowDescription}
                expectedContextFields={expectedContextFields}
                onExpectedContextFieldsChange={setExpectedContextFields}
                isWorkflowSelected={!selectedElement}
              />
            </div>
          </div>
        </div>
      </div>
    </ReactFlowProvider>
  );
}

export default CreateWorkflowPage;