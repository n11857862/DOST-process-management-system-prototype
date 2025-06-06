import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Workflow as WorkflowIcon } from 'lucide-react';

export const SubworkflowNode = memo(({ data, isConnectable, selected }) => {
    const subWorkflowName = data?.config?.selectedSubWorkflowName;
    const displayLabel = data?.label || 'Sub-Workflow';

    return (
        <div className={`
            px-4 py-3 rounded-lg border-2 border-dashed
            w-52 min-h-[70px] 
            flex flex-col items-center justify-center 
            text-center text-sm
            shadow-sm hover:shadow-md transition-shadow
            ${selected ? 'border-pink-500 ring-2 ring-pink-300 bg-pink-50' : 'border-pink-300 bg-pink-50'}
        `}>
            <Handle 
                type="target" 
                position={Position.Top} 
                isConnectable={isConnectable} 
                className="!bg-pink-500 w-3 h-3"
            />
            
            <div className="flex items-center gap-2 text-pink-700 font-semibold">
                <WorkflowIcon size={16} />
                <span>{displayLabel}</span>
            </div>

            {subWorkflowName && (
                <p className="mt-1 text-xs text-pink-600 truncate w-full px-1" title={subWorkflowName}>
                    Ref: {subWorkflowName}
                </p>
            )}
            
            {data?.description && !subWorkflowName && (
                 <p className="text-xs text-pink-500 mt-0.5 whitespace-normal leading-tight px-1">
                    {data.description}
                 </p>
            )}

            <Handle 
                type="source" 
                position={Position.Bottom} 
                isConnectable={isConnectable} 
                className="!bg-pink-500 w-3 h-3"
            />
        </div>
    );
});