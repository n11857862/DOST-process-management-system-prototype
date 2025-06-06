import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

export const StartNode = memo(({ data, isConnectable, selected }) => {
  return (
    <div className={`px-4 py-2 rounded-full border-2 text-center min-w-[100px] bg-green-100 ${selected ? 'border-green-600 ring-2 ring-green-300' : 'border-green-500'}`}>
      <div className="text-green-800">
        <strong className="text-sm font-medium">{data.label || 'Start'}</strong>
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} id="a" className="!bg-gray-400" />
    </div>
  );
});