import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';

const TaskNode = ({ data, isConnectable, selected }) => {
  return (
    <div style={{
      border: `1px solid ${selected ? '#007bff' : '#ddd'}`,
      padding: '10px 15px',
      borderRadius: '5px',
      background: 'white',
      minWidth: '150px',
      textAlign: 'center',
      fontSize: '0.9em',
      boxShadow: selected ? '0 4px 8px rgba(0,0,0,0.1)' : 'none'
    }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} />
      <div>
        <strong>{data.label || 'Task Node'}</strong>
        {data.description && <p style={{fontSize: '0.8em', color: '#666', margin: '5px 0 0 0'}}>{data.description}</p>}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};

export default memo(TaskNode);