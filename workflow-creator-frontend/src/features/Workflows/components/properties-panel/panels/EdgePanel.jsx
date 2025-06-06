import React from 'react';

export const EdgePanel = ({ edgeData, handleEdgeDataChange, handleEdgeDataBlur }) => {
    const isConditionalEdge = edgeData?.conditionType !== undefined;
    const isDefaultPath = edgeData?.conditionType === 'default';

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="edgeLabel" className="block text-xs font-medium text-gray-700 mb-1">
                    Edge Label (Optional):
                </label>
                <input
                    id="edgeLabel"
                    type="text"
                    name="label"
                    value={edgeData?.label || ''}
                    onChange={handleEdgeDataChange}
                    onBlur={handleEdgeDataBlur}
                    placeholder="e.g., Yes, No, Approved"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                />
            </div>

            {isConditionalEdge ? (
                <>
                    <div>
                        <label htmlFor="conditionType" className="block text-xs font-medium text-gray-700 mb-1">
                            Condition Type:
                        </label>
                        <input
                            id="conditionType"
                            type="text"
                            name="conditionType"
                            value={edgeData?.conditionType || 'N/A'}
                            readOnly
                            disabled
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-gray-500 text-sm cursor-not-allowed"
                        />
                        {isDefaultPath && (
                            <p className="mt-1 text-xs text-gray-500">
                                This is the default path, taken if no other conditional edges from the source node evaluate to true.
                            </p>
                        )}
                    </div>

                    {!isDefaultPath ? (
                        <div>
                            <label htmlFor="conditionExpression" className="block text-xs font-medium text-gray-700 mb-1">
                                Condition Expression:
                            </label>
                            <input
                                id="conditionExpression"
                                type="text"
                                name="conditionExpression"
                                value={edgeData?.conditionExpression || ''}
                                onChange={handleEdgeDataChange}
                                onBlur={handleEdgeDataBlur}
                                placeholder="e.g., amount > 1000 OR user.role === 'manager'"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Define a JavaScript-like condition using variables from the workflow context (e.g., `orderTotal`, `customer.type`).
                                The backend uses `expr-eval` library for evaluation.
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                             <p className="text-xs text-blue-700">
                                No condition expression is needed for a default path.
                            </p>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-sm text-gray-600 pt-2">
                    No specific conditional configuration for this type of edge.
                </p>
            )}
        </div>
    );
};