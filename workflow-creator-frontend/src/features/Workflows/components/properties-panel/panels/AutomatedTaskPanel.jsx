import React, { useState, useEffect, useRef } from 'react';
import workflowService from '../../../../../lib/workflowService';
import { AlertCircle, CheckCircle2, Loader2, Link2, Edit2, FileText as LogIcon, Search, ExternalLink } from 'lucide-react';

const formatConfigObjectForTextarea = (value) => {
    if (value === undefined || value === null) return '{}';
    
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch (e) {
            console.error("Error stringifying object for textarea:", e);
            return '{}';
        }
    }

    if (typeof value === 'string') {
        try {
            const parsedJson = JSON.parse(value);
            if (typeof parsedJson === 'object' && parsedJson !== null) {
                return JSON.stringify(parsedJson, null, 2);
            }
            return value; 
        } catch { 
            return value;
        }
    }
    return String(value);
};

export const AutomatedTaskPanel = ({ 
    nodeId, 
    config, 
    updateElementData, 
}) => {
    const [apiConfigVerification, setApiConfigVerification] = useState({
        loading: false,
        error: null,
        successMessage: null,
        retrievedConfigId: config?.apiConfigId || null,
        retrievedConfigStatus: config?.apiConfigStatus || null,
    });

    const [localTaskType, setLocalTaskType] = useState(config?.taskType || 'apiCall');
    
    const [contextUpdatesString, setContextUpdatesString] = useState(formatConfigObjectForTextarea(config?.contextUpdates));
    const [apiHeadersString, setApiHeadersString] = useState(formatConfigObjectForTextarea(config?.apiHeaders));
    const [apiBodyTemplateString, setApiBodyTemplateString] = useState(formatConfigObjectForTextarea(config?.apiBodyTemplate));
    const [saveResponseToString, setSaveResponseToString] = useState(config?.saveResponseTo || '');
    const [apiConfigNameString, setApiConfigNameString] = useState(config?.apiConfigName || '');
    const [apiConfigDescriptionString, setApiConfigDescriptionString] = useState(config?.apiConfigDescription || '');
    const [apiUrlString, setApiUrlString] = useState(config?.apiUrl || '');
    const [logMessageTemplateString, setLogMessageTemplateString] = useState(config?.logMessageTemplate || '');

    const [showSearchResults, setShowSearchResults] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState(null);

    const internalConfigRef = useRef(config); 

    useEffect(() => {
        const configChanged = config !== internalConfigRef.current;
        const nodeIdMismatch = nodeId && internalConfigRef.current?.nodeId !== nodeId;

        if (configChanged || nodeIdMismatch) {
            console.log(`[ATP] useEffect - Config or NodeID changed for node ${nodeId}. Applying new config to local state.`);
            const currentConfigTaskType = config?.taskType || 'apiCall';
            setLocalTaskType(currentConfigTaskType);

            setContextUpdatesString(formatConfigObjectForTextarea(config?.contextUpdates));
            setApiHeadersString(formatConfigObjectForTextarea(config?.apiHeaders));
            setApiBodyTemplateString(formatConfigObjectForTextarea(config?.apiBodyTemplate));
            setSaveResponseToString(config?.saveResponseTo || '');
            setApiConfigNameString(config?.apiConfigName || '');
            setApiConfigDescriptionString(config?.apiConfigDescription || '');
            setApiUrlString(config?.apiUrl || '');
            setLogMessageTemplateString(config?.logMessageTemplate || '');

            setApiConfigVerification(prev => ({
                ...prev,
                loading: false, 
                retrievedConfigId: config?.apiConfigId,
                retrievedConfigStatus: config?.apiConfigStatus,
            }));
            internalConfigRef.current = {...config, nodeId: nodeId}; 
        }
    }, [config, nodeId]); 

    const handleStringInputChange = (setterFunction, value) => {
        setterFunction(value); 
    };

    const saveStringInput = (fieldName, stringValue) => {
        console.log(`[ATP] Saving simple field '${fieldName}' for node ${nodeId} with value: "${stringValue}"`);
        
        const updatedConfig = {
            ...(internalConfigRef.current || config || {}),
            [fieldName]: stringValue
        };
        
        internalConfigRef.current = updatedConfig;
        
        updateElementData('node', nodeId, { config: updatedConfig });
    };
    
    const handleDirectConfigChange = (e) => {
        const { name, value, type, checked } = e.target;
        const val = type === 'checkbox' ? checked : value;
        
        const updatedConfig = {
            ...(internalConfigRef.current || config || {}),
            [name]: val
        };
        
        internalConfigRef.current = updatedConfig;
        
        updateElementData('node', nodeId, { config: updatedConfig });
    };

    const parseAndSaveJsonTextarea = (fieldName, stringValueFromTextarea) => {
        let parsedJsonValue;
        if (stringValueFromTextarea.trim() === "") {
            parsedJsonValue = {}; 
        } else {
            try {
                parsedJsonValue = JSON.parse(stringValueFromTextarea);
                if (typeof parsedJsonValue !== 'object' || parsedJsonValue === null) {
                    console.warn(`[ATP] Field ${fieldName} parsed to a non-object JSON primitive: "${stringValueFromTextarea}". Storing as raw string.`);
                    parsedJsonValue = stringValueFromTextarea; 
                }
            } catch (e) {
                console.warn(`[ATP] Invalid JSON in ${fieldName}. Storing raw string: "${stringValueFromTextarea}". Error: ${e.message}`);
                parsedJsonValue = stringValueFromTextarea; 
            }
        }
        
        console.log(`[ATP] For node ${nodeId}, field '${fieldName}', attempting to save:`, parsedJsonValue);
        
        const updatedConfig = { 
            ...(internalConfigRef.current || config || {}), 
            [fieldName]: parsedJsonValue 
        };
        
        internalConfigRef.current = updatedConfig;
        
        updateElementData('node', nodeId, { config: updatedConfig });
    };

    const handleTaskTypeChange = (e) => {
        const newType = e.target.value;
        
        setLocalTaskType(newType);
        
        const baseConfig = { ...(internalConfigRef.current || config || {}) };
        
        
        const finalNewConfig = {
            ...baseConfig,
            taskType: newType,
        };

        if (newType === 'setContext') {
            if (!baseConfig.contextUpdates || typeof baseConfig.contextUpdates !== 'object') {
                finalNewConfig.contextUpdates = {};
                setContextUpdatesString('{}');
            }
        } else if (newType === 'log') {
            if (!baseConfig.logMessageTemplate) {
                finalNewConfig.logMessageTemplate = 'Automated log: Instance {{instanceId}} - Node {{nodeId}}';
                setLogMessageTemplateString('Automated log: Instance {{instanceId}} - Node {{nodeId}}');
            }
        } else if (newType === 'apiCall') {
            if (!baseConfig.apiMethod || !['GET', 'POST', 'PUT', 'DELETE'].includes(baseConfig.apiMethod)) {
                finalNewConfig.apiMethod = 'POST';
            }
            
            if (!baseConfig.apiHeaders || typeof baseConfig.apiHeaders !== 'object') {
                finalNewConfig.apiHeaders = {};
                setApiHeadersString('{}');
            }
            
            if (!baseConfig.apiBodyTemplate || typeof baseConfig.apiBodyTemplate !== 'object') {
                finalNewConfig.apiBodyTemplate = {};
                setApiBodyTemplateString('{}');
            }
        }
        
        console.log(`[ATP] Task type changed to ${newType}. Updating node ${nodeId} config to:`, finalNewConfig);
        
        internalConfigRef.current = finalNewConfig;
        
        updateElementData('node', nodeId, { config: finalNewConfig });

        if (newType !== 'apiCall') {
            setApiConfigVerification({ 
                loading: false, error: null, successMessage: null, 
                retrievedConfigId: null, retrievedConfigStatus: null 
            });
        } else {
            setApiConfigVerification(prev => ({
                ...prev,
                loading: false, error: null, successMessage: null,
                retrievedConfigId: finalNewConfig.apiConfigId,
                retrievedConfigStatus: finalNewConfig.apiConfigStatus,
            }));
        }
    };

    const handleSearchSimilarConfigs = async () => {
        const currentApiUrl = apiUrlString || config?.apiUrl;
        const currentApiMethod = config?.apiMethod || 'POST';

        if (!currentApiUrl) {
            setSearchError('Please enter an API URL first to search for similar configurations.');
            return;
        }

        setSearchLoading(true);
        setSearchError(null);

        try {
            const response = await workflowService.searchSimilarApiConfigs(currentApiUrl, currentApiMethod);
            if (response && response.data) {
                setSearchResults(response.data);
                setShowSearchResults(true);
                if (response.data.length === 0) {
                    setSearchError('No similar configurations found. You can create a new one.');
                }
            }
        } catch (error) {
            console.error('[ATP] Error searching similar configs:', error);
            setSearchError(error.response?.data?.message || 'Failed to search for similar configurations.');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleUseExistingConfig = (existingConfig) => {
        const updatedConfig = {
            ...(internalConfigRef.current || config || {}),
            apiConfigId: existingConfig._id,
            apiConfigStatus: existingConfig.status,
            apiConfigName: existingConfig.name,
            apiUrl: existingConfig.apiUrl,
            apiMethod: existingConfig.apiMethod,
            apiHeaders: existingConfig.headersTemplate || {},
            apiConfigDescription: existingConfig.description || '',
        };

        setApiConfigNameString(existingConfig.name);
        setApiUrlString(existingConfig.apiUrl);
        setApiHeadersString(formatConfigObjectForTextarea(existingConfig.headersTemplate));
        setApiConfigDescriptionString(existingConfig.description || '');

        internalConfigRef.current = updatedConfig;
        updateElementData('node', nodeId, { config: updatedConfig });

        setApiConfigVerification({
            loading: false,
            error: null,
            successMessage: `Linked to existing configuration: ${existingConfig.name}`,
            retrievedConfigId: existingConfig._id,
            retrievedConfigStatus: existingConfig.status,
        });

        setShowSearchResults(false);
    };

    const handleVerifyAndLinkApiConfig = async () => {
        const currentApiConfigName = apiConfigNameString || config?.apiConfigName;
        const currentApiUrl = apiUrlString || config?.apiUrl;
        const currentApiHeaders = apiHeadersString;
        const currentApiConfigDescription = apiConfigDescriptionString || config?.apiConfigDescription;
        const currentApiMethod = config?.apiMethod || 'POST';

        setApiConfigVerification({ 
            loading: true, error: null, successMessage: null, 
            retrievedConfigId: config?.apiConfigId, 
            retrievedConfigStatus: config?.apiConfigStatus 
        });

        const apiDetails = {
            name: currentApiConfigName,
            apiUrl: currentApiUrl,
            apiMethod: currentApiMethod,
            headersTemplate: currentApiHeaders,
            description: currentApiConfigDescription,
        };

        if (!apiDetails.name || !apiDetails.apiUrl || !apiDetails.apiMethod) {
            setApiConfigVerification({
                loading: false,
                error: 'API Config Name, API Endpoint URL, and HTTP Method are required.',
                successMessage: null,
                retrievedConfigId: config?.apiConfigId, 
                retrievedConfigStatus: config?.apiConfigStatus, 
            });
            return;
        }

        try {
            const result = await workflowService.findOrCreateApiConfig(apiDetails);
            if (result && result.data?._id) {
                const newConfigData = {
                    ...(internalConfigRef.current || config || {}),
                    apiConfigId: result.data._id,
                    apiConfigStatus: result.data.status,
                };
                updateElementData('node', nodeId, { config: newConfigData });

                const isNewConfig = result.status === 201;
                const message = isNewConfig 
                    ? `New API Configuration created successfully. Status: ${result.data.status}`
                    : `Existing API Configuration linked successfully. Status: ${result.data.status}`;

                setApiConfigVerification({ 
                    loading: false, error: null,
                    successMessage: message,
                    retrievedConfigId: result.data._id,
                    retrievedConfigStatus: result.data.status,
                });
            } else {
                throw new Error("Invalid response from API configuration service.");
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message || 'Failed to link API configuration.';
            setApiConfigVerification({
                loading: false, error: errorMessage, successMessage: null,
                retrievedConfigId: config?.apiConfigId, 
                retrievedConfigStatus: config?.apiConfigStatus, 
            });
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor={`autoTaskType-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                    Automated Task Type:
                </label>
                <select
                    id={`autoTaskType-${nodeId}`}
                    name="taskType"
                    value={localTaskType} 
                    onChange={handleTaskTypeChange}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                >
                    <option value="apiCall">API Call</option>
                    <option value="setContext">Set Context Variable(s)</option>
                    <option value="log">Log Message (Backend Console)</option>
                </select>
            </div>

            {localTaskType === 'apiCall' && (
                <>
                    <div className="p-3 border border-gray-300 rounded-md bg-gray-50 space-y-3">
                        <div className="flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-gray-700">API Connection Details</h5>
                            <button
                                type="button"
                                onClick={handleSearchSimilarConfigs}
                                disabled={searchLoading}
                                className="flex items-center px-2 py-1 text-xs border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            >
                                {searchLoading ? <Loader2 className="animate-spin mr-1 h-3 w-3" /> : <Search className="mr-1 h-3 w-3" />}
                                Find Similar
                            </button>
                        </div>
                        
                        {showSearchResults && (
                            <div className="mt-3 p-3 border border-blue-200 rounded-md bg-blue-50">
                                <div className="flex items-center justify-between mb-2">
                                    <h6 className="text-xs font-medium text-blue-800">Similar Configurations Found</h6>
                                    <button
                                        type="button"
                                        onClick={() => setShowSearchResults(false)}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                        Hide
                                    </button>
                                </div>
                                {searchResults.length > 0 ? (
                                    <div className="space-y-2">
                                        {searchResults.map((config) => (
                                            <div key={config._id} className="p-2 border border-blue-200 rounded bg-white">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-xs font-medium text-gray-900">{config.name}</p>
                                                        <p className="text-xs text-gray-600">{config.apiMethod} {config.apiUrl}</p>
                                                        {config.description && (
                                                            <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                                                        )}
                                                        <div className="flex items-center mt-1 space-x-2">
                                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                                                config.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                                {config.status}
                                                            </span>
                                                            {config.isShared && (
                                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                                    Shared
                                                                </span>
                                                            )}
                                                            {config.usageCount > 0 && (
                                                                <span className="text-xs text-gray-500">Used {config.usageCount} times</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUseExistingConfig(config)}
                                                        className="ml-2 flex items-center px-2 py-1 text-xs border border-blue-300 rounded-md shadow-sm text-blue-700 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <ExternalLink className="mr-1 h-3 w-3" />
                                                        Use This
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-blue-700">No similar configurations found.</p>
                                )}
                            </div>
                        )}

                        {searchError && (
                            <div className="mt-2 flex items-center text-xs text-amber-700 bg-amber-50 p-2 rounded-md">
                                <AlertCircle className="h-4 w-4 mr-1.5 flex-shrink-0" /> {searchError}
                            </div>
                        )}

                        <p className="text-xs text-gray-500 mb-2">
                            Define the API connection. This will be stored as a reusable configuration that can be shared with other workflow designers.
                        </p>
                        <div>
                            <label htmlFor={`autoTaskApiConfigName-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">API Configuration Name:</label>
                            <input
                                id={`autoTaskApiConfigName-${nodeId}`}
                                type="text"
                                name="apiConfigName"
                                value={apiConfigNameString}
                                onChange={(e) => handleStringInputChange(setApiConfigNameString, e.target.value)} 
                                onBlur={() => saveStringInput('apiConfigName', apiConfigNameString)} 
                                placeholder="e.g., CRM User Update Service"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label htmlFor={`autoTaskApiConfigDesc-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">API Config Description (Optional):</label>
                            <textarea
                                id={`autoTaskApiConfigDesc-${nodeId}`}
                                name="apiConfigDescription"
                                rows={2}
                                value={apiConfigDescriptionString}
                                onChange={(e) => handleStringInputChange(setApiConfigDescriptionString, e.target.value)} 
                                onBlur={() => saveStringInput('apiConfigDescription', apiConfigDescriptionString)} 
                                placeholder="Briefly describe this API configuration"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label htmlFor={`autoTaskApiUrl-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">API Endpoint URL:</label>
                            <input
                                id={`autoTaskApiUrl-${nodeId}`} 
                                type="url" 
                                name="apiUrl" 
                                value={apiUrlString}
                                onChange={(e) => handleStringInputChange(setApiUrlString, e.target.value)} 
                                onBlur={() => saveStringInput('apiUrl', apiUrlString)} 
                                placeholder="https://api.example.com/resource"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            />
                        </div>
                        <div>
                            <label htmlFor={`autoTaskApiMethod-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">HTTP Method:</label>
                            <select
                                id={`autoTaskApiMethod-${nodeId}`}
                                name="apiMethod" 
                                value={config?.apiMethod || 'POST'}
                                onChange={handleDirectConfigChange}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            >
                                <option value="POST">POST</option>
                                <option value="GET">GET</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor={`autoTaskApiHeaders-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">Headers Template (JSON):</label>
                            <textarea
                                id={`autoTaskApiHeaders-${nodeId}`}
                                name="apiHeaders" 
                                rows={3}
                                value={apiHeadersString} 
                                onChange={(e) => handleStringInputChange(setApiHeadersString, e.target.value)}
                                onBlur={() => parseAndSaveJsonTextarea('apiHeaders', apiHeadersString)}
                                placeholder={'{\n  "Content-Type": "application/json"\n}'}
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white text-gray-900"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleVerifyAndLinkApiConfig}
                            disabled={apiConfigVerification.loading}
                            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {apiConfigVerification.loading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
                            {apiConfigVerification.retrievedConfigId ? 'Refresh/Re-link API Config' : 'Link API Configuration'}
                        </button>
                        {apiConfigVerification.successMessage && (
                            <div className="mt-2 flex items-center text-xs text-green-600 bg-green-50 p-2 rounded-md">
                                <CheckCircle2 className="h-4 w-4 mr-1.5 flex-shrink-0" /> {apiConfigVerification.successMessage}
                            </div>
                        )}
                        {apiConfigVerification.error && (
                            <div className="mt-2 flex items-center text-xs text-red-700 bg-red-50 p-2 rounded-md">
                                <AlertCircle className="h-4 w-4 mr-1.5 flex-shrink-0" /> {apiConfigVerification.error}
                            </div>
                        )}
                    </div>

                    {apiConfigVerification.retrievedConfigId && (
                        <div className="mt-3 p-2 border border-dashed border-gray-300 rounded-md bg-gray-50 text-xs">
                            <p className="font-medium text-gray-700">Linked API Config ID: <span className="font-normal text-indigo-600">{apiConfigVerification.retrievedConfigId}</span></p>
                            <p className="font-medium text-gray-700">Status: <span className={`font-normal ${apiConfigVerification.retrievedConfigStatus === 'Approved' ? 'text-green-600' : 'text-amber-600'}`}>{apiConfigVerification.retrievedConfigStatus || 'N/A'}</span></p>
                        </div>
                    )}
                    
                    <div className="border-t border-gray-200 pt-4">
                        <label htmlFor={`autoTaskApiPayload-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">Request Body Template (JSON):</label>
                        <textarea
                            id={`autoTaskApiPayload-${nodeId}`}
                            name="apiBodyTemplate"
                            rows={5}
                            value={apiBodyTemplateString} 
                            onChange={(e) => handleStringInputChange(setApiBodyTemplateString, e.target.value)}
                            onBlur={() => parseAndSaveJsonTextarea('apiBodyTemplate', apiBodyTemplateString)}
                            placeholder={'{\n  "workflowStepData": "{{context.someValue}}",\n  "customField": "someStaticValue"\n}'}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">Use {'{{context.variableName}}'} for dynamic data. Specific to this step.</p>
                    </div>

                    <div className="pt-4">
                        <label htmlFor={`autoTaskSaveResponseTo-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                            Save API Response To Context Key (Optional):
                        </label>
                        <input
                            id={`autoTaskSaveResponseTo-${nodeId}`}
                            type="text"
                            name="saveResponseTo"
                            value={saveResponseToString}
                            onChange={(e) => handleStringInputChange(setSaveResponseToString, e.target.value)} 
                            onBlur={() => saveStringInput('saveResponseTo', saveResponseToString)} 
                            placeholder="e.g., myExternalApiResult (no spaces)"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">If set, the full API response data will be saved to this key in the workflow context.</p>
                    </div>
                </>
            )}

            {localTaskType === 'setContext' && (
                <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                        <Edit2 size={16} className="mr-2 text-gray-500"/> Set Context Variables
                    </h4>
                    <p className="text-xs text-gray-500 mb-2">Define key-value pairs to update the workflow context. Values can be static, use `{"{{templates}}"}`, or `EXPRESSION:your_math_or_logic`.</p>
                    <label htmlFor={`autoTaskContextUpdates-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                        Context Updates (JSON Object):
                    </label>
                    <textarea
                        id={`autoTaskContextUpdates-${nodeId}`}
                        name="contextUpdates" 
                        rows={8}
                        value={contextUpdatesString} 
                        onChange={(e) => handleStringInputChange(setContextUpdatesString, e.target.value)}
                        onBlur={() => parseAndSaveJsonTextarea('contextUpdates', contextUpdatesString)}
                        placeholder={'{\n  "queryCountryCode": "{{initialCountryCode}}",\n  "queryYear": "EXPRESSION: initialYear ? initialYear : CURRENT_YEAR"\n}'}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono bg-white text-gray-900"
                    />
                </div>
            )}

            {localTaskType === 'log' && (
                <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center">
                        <LogIcon size={16} className="mr-2 text-gray-500"/> Log Message
                    </h4>
                    <label htmlFor={`autoTaskLogMessage-${nodeId}`} className="block text-xs font-medium text-gray-700 mb-1">
                        Log Message Template:
                    </label>
                    <textarea
                        id={`autoTaskLogMessage-${nodeId}`}
                        name="logMessageTemplate"
                        rows={3}
                        value={logMessageTemplateString}
                        onChange={(e) => handleStringInputChange(setLogMessageTemplateString, e.target.value)} 
                        onBlur={() => saveStringInput('logMessageTemplate', logMessageTemplateString)} 
                        placeholder="e.g., Instance {{instanceId}} reached node {{nodeId}}."
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">This message will be logged to the backend console.</p>
                </div>
            )}
        </div>
    );
};