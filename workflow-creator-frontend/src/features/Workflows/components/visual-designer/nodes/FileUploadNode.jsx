import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { FileUp } from 'lucide-react';

export const FileUploadNode = ({ data, isConnectable, selected }) => {
  return (
    <div style={{
      border: `2px solid ${selected ? '#0EA5E9' : '#7DD3FC'}`,
      padding: '10px 15px',
      borderRadius: '8px',
      background: '#F0F9FF',
      minWidth: '160px',
      textAlign: 'center',
      fontSize: '0.9em',
      boxShadow: selected ? '0 6px 12px rgba(14, 165, 233, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '5px'
    }}>
      <Handle type="target" position={Position.Top} isConnectable={isConnectable} style={{ background: '#38BDF8' }} />
       <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284C7' }}>
         <FileUp size={16} />
         <strong>{data.label || 'File Upload'}</strong>
      </div>
      {data.description && <p style={{fontSize: '0.8em', color: '#0369A1', margin: '0'}}>{data.description}</p>}
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} style={{ background: '#38BDF8' }} />
    </div>
  );
};
