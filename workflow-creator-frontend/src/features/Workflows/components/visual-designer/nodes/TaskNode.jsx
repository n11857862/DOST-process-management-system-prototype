import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export const TaskNode = memo(({ data, isConnectable, selected }) => {
  return (
    <div className={`p-3 rounded border text-center min-w-[180px] bg-white shadow-sm hover:shadow-md transition-shadow ${selected ? 'border-blue-600 ring-2 ring-blue-300' : 'border-gray-300'}`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} className="!bg-gray-400" />
      <div className="text-gray-800">
        <strong className="block text-sm font-semibold mb-0.5">{data.label || 'Task'}</strong>
        {data.description && (
          <p className="text-xs text-gray-600 whitespace-normal">{data.description}</p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} className="!bg-gray-400" />
    </div>
  );
});

