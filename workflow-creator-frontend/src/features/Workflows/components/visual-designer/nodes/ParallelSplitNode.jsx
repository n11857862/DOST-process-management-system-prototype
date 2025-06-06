import React, { useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { Split } from 'lucide-react';

export const ParallelSplitNode = ({ id, data, isConnectable, selected }) => {
    const reactFlowInstance = useReactFlow();
    
    const [outgoingCount, setOutgoingCount] = React.useState(0);
    
    useEffect(() => {
        if (!reactFlowInstance) return;
        
        const edges = reactFlowInstance.getEdges();
        const outgoingEdges = edges.filter(edge => edge.source === id);
        setOutgoingCount(outgoingEdges.length);
        
        if (outgoingEdges.length > 0) {
            const updatedEdges = edges.map(edge => {
                if (edge.source === id) {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            splitSourceId: id,
                            animated: true
                        }
                    };
                }
                return edge;
            });
            
            const needsUpdate = outgoingEdges.some(edge => !edge.data?.splitSourceId);
            if (needsUpdate) {
                console.log(`Marking ${outgoingEdges.length} edges as originating from split node ${id}`);
                reactFlowInstance.setEdges(updatedEdges);
            }
        }
    }, [id, reactFlowInstance]);

    return (
        <div 
            className={`
                w-[120px] h-[100px] 
                flex flex-col items-center justify-center 
                border-2 bg-blue-50 
                ${selected ? 'border-blue-500 ring-2 ring-blue-300' : 'border-blue-300'}
                rounded-lg text-center
                shadow-sm hover:shadow-md transition-shadow
            `}
        >
            <Handle 
                type="target" 
                position={Position.Top} 
                id="top" 
                isConnectable={isConnectable} 
                className="!bg-blue-500" 
            />
            
            <div className="flex flex-col items-center text-blue-700">
                <Split size={24} className="mb-1" />
                <div className="text-xs font-medium">
                    {data.label || 'Split'}
                </div>
                
                <div className="mt-2 text-[10px] px-2 py-1 bg-blue-100 rounded-full">
                    <span className="font-mono">
                        {outgoingCount} Path{outgoingCount !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="bottom" 
                isConnectable={isConnectable} 
                className="!bg-blue-500 !w-3 !h-3" 
            />
            
            <Handle 
                type="source" 
                position={Position.Left} 
                id="left" 
                isConnectable={isConnectable} 
                className="!bg-blue-500 !w-3 !h-3" 
            />
            
            <Handle 
                type="source" 
                position={Position.Right} 
                id="right" 
                isConnectable={isConnectable} 
                className="!bg-blue-500 !w-3 !h-3" 
            />
        </div>
    );
};