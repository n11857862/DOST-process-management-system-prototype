import React, { useEffect } from 'react';
import { BaseEdge, EdgeLabelRenderer, getStraightPath } from 'reactflow';

export const ConditionalEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  data,
}) => {
  useEffect(() => {
    if (data) {
      const conditionType = data?.conditionType || 'unknown';
      const expression = data?.conditionExpression || 'none';
      const isDefault = conditionType === 'default';
      console.log(`Edge ${id} - Type: ${conditionType}, Expression: ${expression}, Is Default: ${isDefault}`);
    }
  }, [id, data]);

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const conditionType = data?.conditionType || '';
  const isConditional = conditionType === 'true' || conditionType === 'false' || conditionType === 'default';
  const isDefault = conditionType === 'default';
  
  let displayLabel = data?.label || '';
  if (isDefault && !displayLabel.includes('Default')) {
    displayLabel += ' (Default)';
  }
  
  let edgeColor = '#888';
  if (conditionType === 'true') edgeColor = '#10b981';
  if (conditionType === 'false') edgeColor = '#ef4444';
  if (conditionType === 'default') edgeColor = '#6366f1';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: isConditional ? 2 : 1,
          strokeDasharray: isDefault ? '5,5' : 'none',
        }}
      />
      
      {isConditional && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'all',
            }}
            className={`px-1 py-0.5 rounded border ${
              conditionType === 'true' 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : conditionType === 'false' 
                  ? 'bg-red-100 text-red-800 border-red-200'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-200' // For default
            }`}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default ConditionalEdge; 