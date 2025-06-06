import React, { useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { GitBranch } from 'lucide-react';

export const DecisionNode = ({ id, data, isConnectable, selected }) => {
  const truePathLabel = data.config?.truePathLabel || 'Yes';
  const falsePathLabel = data.config?.falsePathLabel || 'No';
  const conditionExpression = data.config?.conditionExpression || '';
  const defaultPath = data.config?.defaultPath || 'false';
  
  const conditionPreview = conditionExpression 
    ? conditionExpression.length > 30 
      ? conditionExpression.substring(0, 27) + '...' 
      : conditionExpression
    : 'No condition set';
    
  const reactFlowInstance = useReactFlow();
  
  useEffect(() => {
    if (!id || !reactFlowInstance) return;
    
    const edges = reactFlowInstance.getEdges();
    if (!edges || !edges.length) return;

    let hasUpdatedEdges = false;
    
    const updatedEdges = edges.map(edge => {
      if (edge.source !== id) return edge;
      
      const isTruePath = edge.sourceHandle === 'true' || (edge.id && edge.id.includes('true'));
      const isFalsePath = edge.sourceHandle === 'false' || (edge.id && edge.id.includes('false'));
      
      if (isTruePath || isFalsePath) {
        const isDefaultPath = (isTruePath && defaultPath === 'true') || (isFalsePath && defaultPath === 'false');
        
        hasUpdatedEdges = true;
        return {
          ...edge,
          data: {
            ...edge.data,
            conditionType: isDefaultPath ? 'default' : (isTruePath ? 'true' : 'false'),
            conditionExpression: isDefaultPath ? '' : conditionExpression,
            label: isTruePath ? truePathLabel : falsePathLabel
          }
        };
      }
      
      return edge;
    });
    
    if (hasUpdatedEdges) {
      reactFlowInstance.setEdges(updatedEdges);
      console.log(`Updated edges for decision node ${id} with condition: ${conditionExpression}, default path: ${defaultPath}`);
    }
  }, [id, conditionExpression, truePathLabel, falsePathLabel, defaultPath, reactFlowInstance]);

  return (
    <div 
      className={`
        rounded-lg border-2 bg-amber-50 
        w-[180px] h-[110px] 
        flex flex-col items-center justify-center 
        text-center text-sm
        shadow-sm hover:shadow-md transition-shadow
        ${selected ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-300'}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable} 
        className="!bg-amber-400" 
      />
      
      <div className="flex flex-col items-center justify-center text-amber-700 p-2 w-full">
        <div className="flex items-center mb-1">
          <GitBranch size={20} className="mr-1.5" />
          <strong className="text-xs font-semibold whitespace-normal leading-tight">
            {data.label || 'Decision'}
          </strong>
        </div>
        
        <div className="text-[10px] px-2 py-1 bg-amber-100 rounded-sm w-full mt-1 font-mono text-amber-800 overflow-hidden text-ellipsis">
          {conditionPreview}
        </div>
        
        <div className="text-[9px] mt-1 text-gray-600">
          Default: {defaultPath === 'true' ? truePathLabel : falsePathLabel}
        </div>
      </div>

      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pr-[2px]">
        <div className="relative flex items-center">
          <span className={`text-[9px] mr-1 text-green-700 font-medium bg-green-100 px-1 rounded ${defaultPath === 'true' ? 'ring-1 ring-green-500' : ''}`}>
            {truePathLabel} {defaultPath === 'true' ? '(Default)' : ''}
          </span>
          <Handle 
            id="true" 
            type="source" 
            position={Position.Right} 
            isConnectable={isConnectable} 
            className="!static !transform-none !bg-green-500" 
          />
        </div>
      </div>
      
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 pb-[2px]">
        <div className="relative flex flex-col items-center">
          <span className={`text-[9px] mb-1 text-red-700 font-medium bg-red-100 px-1 rounded ${defaultPath === 'false' ? 'ring-1 ring-red-500' : ''}`}>
            {falsePathLabel} {defaultPath === 'false' ? '(Default)' : ''}
          </span>
          <Handle 
            id="false" 
            type="source" 
            position={Position.Bottom} 
            isConnectable={isConnectable} 
            className="!static !transform-none !bg-red-500" 
          />
        </div>
      </div>
    </div>
  );
};