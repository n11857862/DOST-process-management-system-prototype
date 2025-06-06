import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { UserCheck } from 'lucide-react';

export const ApprovalNode = memo(({ data, isConnectable, selected }) => {
  return (
    <div 
      className={`
        px-4 py-3 rounded-lg border-2 
        w-[200px] min-h-[70px] {/* Increased width slightly for two labels */}
        flex flex-col items-center justify-center 
        text-center
        shadow-sm hover:shadow-md transition-shadow
        bg-emerald-50 
        ${selected ? 'border-emerald-600 ring-2 ring-emerald-300' : 'border-emerald-400'}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        isConnectable={isConnectable} 
        className="!bg-emerald-500 w-3 h-3"
      />
      
      <div className="flex items-center justify-center text-emerald-700 mb-1">
        <UserCheck size={18} className="mr-2 flex-shrink-0" />
        <strong className="text-sm font-semibold whitespace-normal leading-tight">
          {data.label || 'Approval Step'}
        </strong>
      </div>
      {data.description && (
        <p className="text-xs text-emerald-600 whitespace-normal leading-tight px-1">
          {data.description}
        </p>
      )}

      <div className="flex justify-around w-full mt-1">
        <div className="text-xs text-green-700">Approved</div>
        <div className="text-xs text-red-700">Rejected</div>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="approved" 
        style={{ left: '30%', background: '#34D399' }}
        isConnectable={isConnectable}
        className="w-3 h-3" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom} 
        id="rejected" 
        style={{ left: '70%', background: '#F87171' }}
        isConnectable={isConnectable}
        className="w-3 h-3"
      />
    </div>
  );
});