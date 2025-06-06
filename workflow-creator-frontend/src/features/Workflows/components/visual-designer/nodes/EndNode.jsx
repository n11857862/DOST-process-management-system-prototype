import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export const EndNode = memo(({ data, isConnectable, selected }) => {
  return (
    <div className={`px-4 py-2 rounded-full border-2 text-center min-w-[100px] bg-red-100 ${selected ? 'border-red-600 ring-2 ring-red-300' : 'border-red-500'}`}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} id="a" className="!bg-gray-400" />
      <div className="text-red-800">
        <strong className="text-sm font-medium">{data.label || 'End'}</strong>
      </div>
    </div>
  );
});