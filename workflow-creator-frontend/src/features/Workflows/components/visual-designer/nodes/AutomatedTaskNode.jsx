import React from 'react';
import { Handle, Position } from 'reactflow';
import { Zap } from 'lucide-react';

export const AutomatedTaskNode = ({ data, isConnectable, selected }) => {
  return (
    <div style={{
      border: `2px solid ${selected ? '#8B5CF6' : '#C4B5FD'}`,
      padding: '10px 15px',
      borderRadius: '8px',
      background: '#F5F3FF',
      minWidth: '160px',
      textAlign: 'center',
      fontSize: '0.9em',
      boxShadow: selected ? '0 6px 12px rgba(139, 92, 246, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px'
    }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#A78BFA' }} />
       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7C3AED' }}>
         <Zap size={16} />
         <strong>{data.label || 'Automated Task'}</strong>
      </div>
      {data.description && <p style={{fontSize: '0.8em', color: '#6D28D9', margin: '0'}}>{data.description}</p>}
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#A78BFA' }} />
    </div>
  );
};
