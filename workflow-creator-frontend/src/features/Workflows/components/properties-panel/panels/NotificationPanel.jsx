import React from 'react';

export const NotificationPanel = ({ config, handleConfigChange, handleConfigBlur }) => {
    const notificationType = config?.notificationType || 'log';

    const templateHelpText = "Use {{variableName}} to insert workflow data (e.g., {{instanceId}}, {{workflowName}}, or any custom context variable like {{customer.name}}).";

    return (
        <div className="space-y-6">
            <div>
                <label htmlFor="notificationType" className="block text-sm font-medium text-gray-700 mb-1">
                    Notification Type:
                </label>
                <select
                    id="notificationType"
                    name="notificationType"
                    value={notificationType}
                    onChange={handleConfigChange}
                    onBlur={handleConfigBlur}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                >
                    <option value="log">Log Message (to system console)</option>
                    <option value="email">Send Email</option>
                </select>
            </div>

            {notificationType === 'email' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800">Email Configuration</h4>
                    <div>
                        <label htmlFor="recipientType" className="block text-xs font-medium text-gray-700 mb-1">
                            Recipient Type:
                        </label>
                        <select
                            id="recipientType"
                            name="recipientType"
                            value={config?.recipientType || 'initiator'}
                            onChange={handleConfigChange}
                            onBlur={handleConfigBlur}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        >
                            <option value="initiator">Workflow Initiator</option>
                            <option value="specificEmail">Specific Email Address</option>
                            <option value="userById">User by ID (from Context)</option>
                            <option value="role">Users in Role</option>
                            <option value="fromContext">Email Address from Context</option>
                        </select>
                    </div>

                    {['specificEmail', 'userById', 'role', 'fromContext'].includes(config?.recipientType) && (
                        <div>
                            <label htmlFor="recipientValue" className="block text-xs font-medium text-gray-700 mb-1">
                                {config?.recipientType === 'specificEmail' && 'Email Address:'}
                                {config?.recipientType === 'userById' && 'User ID or Context Path (e.g., {{userIdVar}}):'}
                                {config?.recipientType === 'role' && 'Role Name (e.g., manager):'}
                                {config?.recipientType === 'fromContext' && 'Context Path to Email (e.g., {{customer.email}}):'}
                            </label>
                            <input
                                type="text"
                                id="recipientValue"
                                name="recipientValue"
                                value={config?.recipientValue || ''}
                                onChange={handleConfigChange}
                                onBlur={handleConfigBlur}
                                placeholder={
                                    config?.recipientType === 'specificEmail' ? 'Enter email address' :
                                    config?.recipientType === 'userById' ? 'user_id or {{context.userId}}' :
                                    config?.recipientType === 'role' ? 'manager' :
                                    config?.recipientType === 'fromContext' ? '{{applicant.emailAddress}}' : ''
                                }
                                className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="subjectTemplate" className="block text-xs font-medium text-gray-700 mb-1">
                            Subject:
                        </label>
                        <input
                            type="text"
                            id="subjectTemplate"
                            name="subjectTemplate"
                            value={config?.subjectTemplate || ''}
                            onChange={handleConfigChange}
                            onBlur={handleConfigBlur}
                            placeholder="e.g., Action Required for {{workflowName}}"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">{templateHelpText}</p>
                    </div>

                    <div>
                        <label htmlFor="bodyTemplate" className="block text-xs font-medium text-gray-700 mb-1">
                            Body:
                        </label>
                        <textarea
                            id="bodyTemplate"
                            name="bodyTemplate"
                            rows={6}
                            value={config?.bodyTemplate || ''}
                            onChange={handleConfigChange}
                            onBlur={handleConfigBlur}
                            placeholder="e.g., Hello,\nAn action is needed for instance {{instanceId}}.\nDetails: {{someContextData}}"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">{templateHelpText}</p>
                    </div>
                </div>
            )}

            {notificationType === 'log' && (
                <div className="space-y-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800">Log Configuration</h4>
                    <div>
                        <label htmlFor="logMessageTemplate" className="block text-xs font-medium text-gray-700 mb-1">
                            Log Message:
                        </label>
                        <textarea
                            id="logMessageTemplate"
                            name="logMessageTemplate"
                            rows={5}
                            value={config?.logMessageTemplate || 'Instance {{instanceId}} of workflow {{workflowName}} reached notification node {{nodeId}}.'}
                            onChange={handleConfigChange}
                            onBlur={handleConfigBlur}
                            placeholder="Enter log message..."
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        />
                        <p className="mt-1 text-xs text-gray-500">{templateHelpText}</p>
                    </div>
                </div>
            )}
        </div>
    );
};