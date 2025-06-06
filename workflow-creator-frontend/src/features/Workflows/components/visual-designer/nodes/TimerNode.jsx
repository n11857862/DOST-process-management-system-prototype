import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Clock } from 'lucide-react';

export const TimerNode = memo(({ data, isConnectable, selected }) => {
    const displayLabel = data?.label || 'Timer / Delay';
    const delayValue = data?.config?.delayValue;
    const delayUnit = data?.config?.delayUnit;
    let delayDisplay = 'Not configured';

    if (delayValue && delayUnit) {
        delayDisplay = `${delayValue} ${delayUnit}`;
    }

    return (
        <div className={`
            px-4 py-3 rounded-lg border-2
            w-52 min-h-[70px] 
            flex flex-col items-center justify-center 
            text-center text-sm
            shadow-sm hover:shadow-md transition-shadow
            ${selected ? 'border-cyan-600 ring-2 ring-cyan-300 bg-cyan-50' : 'border-cyan-400 bg-cyan-50'}
        `}>
            <Handle 
                type="target" 
                position={Position.Top} 
                isConnectable={isConnectable} 
                className="!bg-cyan-500 w-3 h-3"
            />

            <div className="flex items-center gap-2 text-cyan-700 font-semibold">
                <Clock size={16} />
                <span>{displayLabel}</span>
            </div>

            <p className="mt-1 text-xs text-cyan-600 truncate w-full px-1" title={delayDisplay}>
                Wait: {delayDisplay}
            </p>

            <Handle 
                type="source" 
                position={Position.Bottom} 
                isConnectable={isConnectable} 
                className="!bg-cyan-500 w-3 h-3"
            />
        </div>
    );
});