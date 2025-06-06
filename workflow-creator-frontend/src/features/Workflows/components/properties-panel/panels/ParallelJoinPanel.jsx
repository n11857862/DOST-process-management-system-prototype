import React, { useState, useEffect } from 'react';
import { useReactFlow } from 'reactflow';
import { Info } from 'lucide-react';

export const ParallelJoinPanel = ({ nodeId, config, updateElementData }) => {
    const reactFlowInstance = useReactFlow();
    const [expectedPaths, setExpectedPaths] = useState(config?.expectedPaths || 'auto');
    const [incomingCount, setIncomingCount] = useState(0);

    useEffect(() => {
        if (!reactFlowInstance || !nodeId) return;
        
        const edges = reactFlowInstance.getEdges();
        const incomingEdges = edges.filter(edge => edge.target === nodeId);
        setIncomingCount(incomingEdges.length);
    }, [nodeId, reactFlowInstance]);
    
    const handleExpectedPathsChange = (e) => {
        const value = e.target.value;
        setExpectedPaths(value);
        
        const updatedConfig = {
            ...(config || {}),
            expectedPaths: value
        };
        updateElementData('node', nodeId, { config: updatedConfig });
    };

    const handleCustomExpectedPathsChange = (e) => {
        if (expectedPaths !== 'custom') return;
        
        const value = parseInt(e.target.value, 10);
        if (isNaN(value) || value <= 0) return;
        
        const updatedConfig = {
            ...(config || {}),
            expectedPaths: value,
            customExpectedPaths: value
        };
        updateElementData('node', nodeId, { config: updatedConfig });
    };

    return (
        <div className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                <h4 className="font-medium mb-1">Parallel Join Configuration</h4>
                <p>This gateway synchronizes multiple incoming parallel paths.
                It will wait until the specified number of incoming paths have completed before activating its outgoing path.</p>
            </div>
            
            <div>
                <label htmlFor={`joinExpectedPaths-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Expected Incoming Paths:
                </label>
                <select
                    id={`joinExpectedPaths-${nodeId}`}
                    name="expectedPaths"
                    value={expectedPaths}
                    onChange={handleExpectedPathsChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm"
                >
                    <option value="auto">All Connected Paths ({incomingCount})</option>
                    <option value="1">At Least 1 Path (Any Path)</option>
                    <option value="custom">Custom Number</option>
                </select>
                
                {expectedPaths === 'custom' && (
                    <div className="mt-2">
                        <label htmlFor={`customExpectedPaths-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                            Number of Paths:
                        </label>
                        <input
                            type="number"
                            id={`customExpectedPaths-${nodeId}`}
                            name="customExpectedPaths"
                            min="1"
                            defaultValue={config?.customExpectedPaths || Math.max(1, incomingCount)}
                            onChange={handleCustomExpectedPathsChange}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm text-sm"
                        />
                    </div>
                )}
            </div>
            
            <div className="flex items-start p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                <Info size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                <div>
                    <p>For best results, connect all split paths to a join node to ensure proper workflow completion.</p>
                </div>
            </div>
        </div>
    );
};