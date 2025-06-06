
import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Info, HelpCircle } from 'lucide-react';

export const DecisionPanel = ({ nodeId, config, handleConfigChange, handleConfigBlur }) => {
  const configRef = useRef(config);
  
  const [conditionExpression, setConditionExpression] = useState(config?.conditionExpression || '');
  const [truePathLabel, setTruePathLabel] = useState(config?.truePathLabel || 'Yes');
  const [falsePathLabel, setFalsePathLabel] = useState(config?.falsePathLabel || 'No');
  const [defaultPath, setDefaultPath] = useState(config?.defaultPath || 'false');
  const [hasValidationError, setHasValidationError] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    if (config !== configRef.current) {
      setConditionExpression(config?.conditionExpression || '');
      setTruePathLabel(config?.truePathLabel || 'Yes');
      setFalsePathLabel(config?.falsePathLabel || 'No');
      setDefaultPath(config?.defaultPath || 'false');
      configRef.current = config;
    }
  }, [config]);

  const simulateConfigChange = (name, value) => {
    const syntheticEvent = {
      target: {
        name,
        value
      }
    };
    handleConfigChange(syntheticEvent);
    
    configRef.current = {
      ...configRef.current,
      [name]: value
    };
  };

  const handleLocalInputChange = (setter, name, value) => {
    setter(value);
    simulateConfigChange(name, value);
    setHasValidationError(false);
  };

  const formatExpressionForBackend = (expression) => {
    if (!expression) return '';
    
    let formatted = expression.replace(/\{\{([^}]+)\}\}/g, '$1');
    
    formatted = formatted.replace(/\bcontext\./g, '');
    
    
    return formatted;
  };

  const handleExpressionBlur = (e) => {
    const value = e.target.value;
    if (!value.trim()) {
      setHasValidationError(true);
      setValidationMessage('Condition expression is required');
      return;
    }
    
    try {
      if (value.includes('{{') && !value.includes('}}')) {
        throw new Error("Unmatched template brackets");
      }
      
      const backendExpression = formatExpressionForBackend(value);
      
      handleConfigBlur({
        target: {
          name: 'conditionExpression',
          value: backendExpression
        }
      });
      
      setConditionExpression(backendExpression);
      
      setHasValidationError(false);
      setValidationMessage('');
    } catch (error) {
      setHasValidationError(true);
      setValidationMessage(error.message || 'Invalid condition format');
    }
  };
  
  const handleInputBlur = (name, value) => {
    handleConfigBlur({
      target: {
        name,
        value
      }
    });
  };
  
  const handleSelectChange = (e) => {
    const { name, value } = e.target;
    handleConfigChange(e);
    
    if (name === 'defaultPath') {
      setDefaultPath(value);
    }
    
    configRef.current = {
      ...configRef.current,
      [name]: value
    };
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between items-center mb-1">
          <label htmlFor={`decisionCondition-${nodeId}`} className="block text-xs font-medium text-gray-700">
            Condition Expression:
          </label>
          <div className="relative group">
            <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
            <div className="absolute hidden group-hover:block right-0 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
              Use simple conditions like <strong>amount {'>'} 500</strong> or <strong>status === 'approved'</strong>. For numbers, values are automatically converted for proper comparison.
            </div>
          </div>
        </div>
        <textarea
          id={`decisionCondition-${nodeId}`}
          name="conditionExpression"
          value={conditionExpression}
          onChange={(e) => handleLocalInputChange(setConditionExpression, 'conditionExpression', e.target.value)}
          onBlur={handleExpressionBlur}
          placeholder="amount > 500"
          className={`w-full px-3 py-2 border ${hasValidationError ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono`}
          rows={3}
        />
        {hasValidationError && (
          <p className="mt-1 text-xs text-red-600 flex items-center">
            <AlertCircle className="h-3 w-3 mr-1" /> {validationMessage}
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Enter a condition using context variables (e.g., <code className="bg-gray-100 px-1 rounded">amount {'>'} 500</code>)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`truePath-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
            True Path Label:
          </label>
          <input
            id={`truePath-${nodeId}`}
            name="truePathLabel"
            type="text"
            value={truePathLabel}
            onChange={(e) => handleLocalInputChange(setTruePathLabel, 'truePathLabel', e.target.value)}
            onBlur={() => handleInputBlur('truePathLabel', truePathLabel)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="Yes"
          />
        </div>
        <div>
          <label htmlFor={`falsePath-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
            False Path Label:
          </label>
          <input
            id={`falsePath-${nodeId}`}
            name="falsePathLabel"
            type="text"
            value={falsePathLabel}
            onChange={(e) => handleLocalInputChange(setFalsePathLabel, 'falsePathLabel', e.target.value)}
            onBlur={() => handleInputBlur('falsePathLabel', falsePathLabel)}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            placeholder="No"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`defaultPath-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
          Default Path (if evaluation fails):
        </label>
        <select
          id={`defaultPath-${nodeId}`}
          name="defaultPath"
          value={defaultPath}
          onChange={handleSelectChange}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        >
          <option value="true">True Path ({truePathLabel})</option>
          <option value="false">False Path ({falsePathLabel})</option>
        </select>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-start">
        <Info className="h-4 w-4 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <p className="font-medium">How Decision Nodes Work:</p>
          <p className="mt-1">Decision nodes evaluate conditions against the workflow context to determine which path to follow.</p>
          <p className="mt-1">Examples:</p>
          <ul className="list-disc ml-4 mt-1">
            <li><code className="bg-blue-100 px-1 rounded">amount {'>'} 1000</code> - Compares as numbers</li>
            <li><code className="bg-blue-100 px-1 rounded">status === 'approved'</code> - String comparison</li>
            <li><code className="bg-blue-100 px-1 rounded">isComplete === true</code> - Boolean check</li>
          </ul>
          <p className="mt-2 font-medium text-blue-900">Important:</p>
          <p className="mt-1">Make sure to connect BOTH paths from the decision node. The default path (selected below) will be used if the condition evaluation fails.</p>
        </div>
      </div>
    </div>
  );
};