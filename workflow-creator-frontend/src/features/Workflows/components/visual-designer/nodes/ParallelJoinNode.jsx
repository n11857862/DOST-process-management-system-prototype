import React, { useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { GitMerge } from 'lucide-react';

export const ParallelJoinNode = ({ id, data, isConnectable, selected }) => {
    const reactFlowInstance = useReactFlow();
    const expectedPaths = data.config?.expectedPaths || 'auto';
    
    const [incomingCount, setIncomingCount] = React.useState(0);
    const [expectedCount, setExpectedCount] = React.useState('Auto');
    
    useEffect(() => {
        if (!reactFlowInstance) return;
        
        const edges = reactFlowInstance.getEdges();
        const incomingEdges = edges.filter(edge => edge.target === id);
        setIncomingCount(incomingEdges.length);
        
        if (expectedPaths === 'auto' || expectedPaths === undefined) {
            setExpectedCount(`All (${incomingEdges.length})`);
        } else {
            setExpectedCount(expectedPaths);
        }
        
        if (incomingEdges.length > 0) {
            const updatedEdges = edges.map(edge => {
                if (edge.target === id) {
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            joinTargetId: id,
                            animated: true
                        }
                    };
                }
                return edge;
            });
            
            const needsUpdate = incomingEdges.some(edge => !edge.data?.joinTargetId);
            if (needsUpdate) {
                console.log(`Marking ${incomingEdges.length} edges as targeting join node ${id}`);
                reactFlowInstance.setEdges(updatedEdges);
            }
        }
    }, [id, reactFlowInstance, expectedPaths]);

    return (
        <div 
            className={`
                w-[120px] h-[100px] 
                flex flex-col items-center justify-center 
                border-2 bg-emerald-50 
                ${selected ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-emerald-300'}
                rounded-lg text-center
                shadow-sm hover:shadow-md transition-shadow
            `}
        >
            <Handle 
                type="target" 
                position={Position.Top} 
                id="top" 
                isConnectable={isConnectable} 
                className="!bg-emerald-500 !w-3 !h-3"
            />
            
            <Handle 
                type="target" 
                position={Position.Left} 
                id="left" 
                isConnectable={isConnectable} 
                className="!bg-emerald-500 !w-3 !h-3" 
            />
            
            <Handle 
                type="target" 
                position={Position.Right} 
                id="right" 
                isConnectable={isConnectable} 
                className="!bg-emerald-500 !w-3 !h-3" 
            />

            <div className="flex flex-col items-center text-emerald-700">
                <GitMerge size={24} className="mb-1" />
                <div className="text-xs font-medium">
                    {data.label || 'Join'}
                </div>
                
                <div className="mt-2 text-[10px] px-2 py-1 bg-emerald-100 rounded-full">
                    <span className="font-mono">
                        {incomingCount} / {expectedCount}
                    </span>
                </div>
            </div>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="bottom" 
                isConnectable={isConnectable} 
                className="!bg-emerald-500" 
            />
        </div>
    );
};