import React, { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { Info } from 'lucide-react';

export const ParallelSplitPanel = ({ nodeId, config, updateElementData }) => {
    const reactFlowInstance = useReactFlow();
    const [outgoingCount, setOutgoingCount] = useState(0);
    const [autoActivatePaths, setAutoActivatePaths] = useState(config?.autoActivatePaths !== false);

    useEffect(() => {
        if (!reactFlowInstance || !nodeId) return;
        
        const edges = reactFlowInstance.getEdges();
        const outgoingEdges = edges.filter(edge => edge.source === nodeId);
        setOutgoingCount(outgoingEdges.length);
    }, [nodeId, reactFlowInstance]);
    
    const handleAutoActivateChange = (e) => {
        const value = e.target.checked;
        setAutoActivatePaths(value);
        
        const updatedConfig = {
            ...(config || {}),
            autoActivatePaths: value
        };
        updateElementData('node', nodeId, { config: updatedConfig });
    };

    return (
        <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <h4 className="font-medium mb-1">Parallel Split Configuration</h4>
                <p>This node splits the workflow into multiple paths that execute in parallel.
                All outgoing paths will be activated simultaneously.</p>
            </div>
            
            <div className="flex items-center justify-between p-2 border border-gray-100 bg-gray-50 rounded">
                <span className="text-sm font-medium">Connected Paths:</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 font-mono text-xs rounded-full">
                    {outgoingCount}
                </span>
            </div>
            
            <div className="p-2 border border-gray-200 rounded">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={autoActivatePaths}
                        onChange={handleAutoActivateChange}
                        className="h-4 w-4 rounded text-blue-500 focus:ring-blue-400"
                    />
                    <span>Auto-activate all paths (recommended)</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                    When enabled, all outgoing paths will be activated simultaneously when this node is reached.
                </p>
            </div>
            
            <div className="flex items-start p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <Info size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="mb-1">Best Practices:</p>
                    <ul className="list-disc ml-4">
                        <li>Connect each split path to its own task or process</li>
                        <li>Use a Join node later in the workflow to synchronize the parallel paths</li>
                        <li>For complex workflows, label your paths clearly</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};