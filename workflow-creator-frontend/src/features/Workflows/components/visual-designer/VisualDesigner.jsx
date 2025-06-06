
import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
  MiniMap, Controls, Background
} from 'reactflow';
import 'reactflow/dist/style.css';

import { nodeTypes } from './nodes/nodeRegistry.js';

import { ConditionalEdge } from './edges/ConditionalEdge';

const edgeTypes = {
  conditionalEdge: ConditionalEdge,
};

function VisualDesigner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  setReactFlowInstance,
  setSelectedElement,
}) {
  const reactFlowInstanceRef = React.useRef(null);

  const onInit = useCallback((instance) => {
    console.log("ReactFlow instance initialized:", instance);
    reactFlowInstanceRef.current = instance;
    setReactFlowInstance(instance);
  }, [setReactFlowInstance]);

  useEffect(() => {
    if (!reactFlowInstanceRef.current || !nodes.length || !edges.length) return;
    
    const instance = reactFlowInstanceRef.current;
    let needsUpdate = false;
    
    const decisionNodes = nodes.filter(node => node.type === 'decision');
    
    const updatedEdges = edges.map(edge => {
      const sourceNode = decisionNodes.find(node => node.id === edge.source);
      if (!sourceNode) return edge;
      
      const config = sourceNode.data?.config || {};
      const conditionExpression = config.conditionExpression || '';
      const defaultPath = config.defaultPath || 'false';
      const truePathLabel = config.truePathLabel || 'Yes';
      const falsePathLabel = config.falsePathLabel || 'No';
      
      const isTruePath = edge.sourceHandle === 'true' || (edge.id && edge.id.includes('true'));
      const isFalsePath = edge.sourceHandle === 'false' || (edge.id && edge.id.includes('false'));
      
      if (!isTruePath && !isFalsePath) return edge;
      
      const isDefaultPath = (isTruePath && defaultPath === 'true') || (isFalsePath && defaultPath === 'false');
      
      const currentConditionType = edge.data?.conditionType;
      const expectedConditionType = isDefaultPath ? 'default' : (isTruePath ? 'true' : 'false');
      
      if (currentConditionType !== expectedConditionType) {
        needsUpdate = true;
        console.log(`Updating edge ${edge.id} conditionType from ${currentConditionType} to ${expectedConditionType}`);
        
        return {
          ...edge,
          type: 'conditionalEdge',
          data: {
            ...edge.data,
            conditionType: expectedConditionType,
            conditionExpression: isDefaultPath ? '' : conditionExpression,
            label: isTruePath ? truePathLabel : falsePathLabel
          }
        };
      }
      
      return edge;
    });
    
    if (needsUpdate) {
      console.log('Updating edges for decision nodes on mount/change');
      instance.setEdges(updatedEdges);
    }
  }, [nodes, edges]);

  const handleNodeClick = useCallback((event, node) => {
    console.log('Node clicked:', node);
    setSelectedElement({ type: 'node', element: node });
  }, [setSelectedElement]);

   const handleEdgeClick = useCallback((event, edge) => {
    console.log('Edge clicked:', edge);
    setSelectedElement({ type: 'edge', element: edge });
  }, [setSelectedElement]);

  const handlePaneClick = useCallback(() => {
    console.log('Pane clicked');
    setSelectedElement(null);
  }, [setSelectedElement]);

  const handleConnect = useCallback((params) => {
    const sourceNode = nodes.find(node => node.id === params.source);
    if (sourceNode && sourceNode.type === 'decision') {
      const conditionExpression = sourceNode.data?.config?.conditionExpression || '';
      const truePathLabel = sourceNode.data?.config?.truePathLabel || 'Yes';
      const falsePathLabel = sourceNode.data?.config?.falsePathLabel || 'No';
      const defaultPath = sourceNode.data?.config?.defaultPath || 'false';
      
      const isTrue = params.sourceHandle === 'true';
      const isFalse = params.sourceHandle === 'false';
      
      const isDefaultPath = (isTrue && defaultPath === 'true') || (isFalse && defaultPath === 'false');
      
      console.log(`Creating conditional edge from Decision node with expression: ${conditionExpression}`);
      console.log(`Path type: ${isTrue ? 'true' : isFalse ? 'false' : 'unknown'}, Default path: ${defaultPath}, Is default: ${isDefaultPath}`);
      
      const edgeWithType = {
        ...params,
        type: 'conditionalEdge',
        data: { 
          conditionType: isDefaultPath ? 'default' : (isTrue ? 'true' : 'false'),
          conditionExpression: isDefaultPath ? '' : conditionExpression,
          label: isTrue ? truePathLabel : isFalse ? falsePathLabel : 'Default'
        }
      };
      onConnect(edgeWithType);
    } else {
      onConnect(params);
    }
  }, [nodes, onConnect]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onInit={onInit}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        fitView
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ animated: true }}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
        <Background variant="dots" gap={15} size={1} />
      </ReactFlow>
    </div>
  );
}

export default VisualDesigner;
