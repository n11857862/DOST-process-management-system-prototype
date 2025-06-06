import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Bell } from 'lucide-react';

export const NotificationNode = memo(({ data, isConnectable, selected }) => {
    const notificationType = data?.config?.notificationType || 'Log';
    const displayLabel = data?.label || 'Notification';

    return (
        <div className={`
            px-4 py-3 rounded-lg border-2
            w-52 min-h-[70px] 
            flex flex-col items-center justify-center 
            text-center text-sm
            shadow-sm hover:shadow-md transition-shadow
            ${selected ? 'border-purple-600 ring-2 ring-purple-300 bg-purple-50' : 'border-purple-400 bg-purple-50'}
        `}>
            <Handle 
                type="target" 
                position={Position.Top} 
                isConnectable={isConnectable} 
                className="!bg-purple-500 w-3 h-3"
            />
            
            <div className="flex items-center gap-2 text-purple-700 font-semibold">
                <Bell size={16} />
                <span>{displayLabel}</span>
            </div>

            <p className="mt-1 text-xs text-purple-600 truncate w-full px-1 capitalize" title={notificationType}>
                Type: {notificationType}
            </p>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                isConnectable={isConnectable} 
                className="!bg-purple-500 w-3 h-3"
            />
        </div>
    );
});