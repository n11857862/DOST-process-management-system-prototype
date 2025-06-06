import React from 'react';

const TIME_UNITS = [
    { value: 'seconds', label: 'Seconds' },
    { value: 'minutes', label: 'Minutes' },
    { value: 'hours', label: 'Hours' },
    { value: 'days', label: 'Days' },
];

export const TimerPanel = ({ config, handleConfigChange, handleConfigBlur }) => {
    const timerType = config?.timerType || 'duration';
    const delayValue = config?.delayValue || '';
    const delayUnit = config?.delayUnit || 'minutes';
    let specificResumeAt = config?.specificResumeAt || '';
    if (config?.specificResumeAt instanceof Date) {
        specificResumeAt = config.specificResumeAt.toISOString().slice(0, 16);
    }
    const resumeAtContextVar = config?.resumeAtContextVar || '';

    const handleTypeChange = (e) => {
        const newType = e.target.value;
        handleConfigChange({ target: { name: 'timerType', value: newType } });
        if (newType === 'duration') {
            handleConfigChange({ target: { name: 'specificResumeAt', value: '' } });
            handleConfigChange({ target: { name: 'resumeAtContextVar', value: '' } });
        } else if (newType === 'specificDateTime') {
            handleConfigChange({ target: { name: 'delayValue', value: '' } });
            handleConfigChange({ target: { name: 'delayUnit', value: 'minutes' } });
            handleConfigChange({ target: { name: 'resumeAtContextVar', value: '' } });
        } else if (newType === 'fromContextVariable') {
            handleConfigChange({ target: { name: 'delayValue', value: '' } });
            handleConfigChange({ target: { name: 'delayUnit', value: 'minutes' } });
            handleConfigChange({ target: { name: 'specificResumeAt', value: '' } });
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="timerTypeSelect" className="block text-xs font-medium text-gray-700 mb-1">
                    Timer Type:
                </label>
                <select
                    id="timerTypeSelect"
                    name="timerType"
                    value={timerType}
                    onChange={handleTypeChange}
                    onBlur={handleConfigBlur}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                >
                    <option value="duration">Wait for a duration</option>
                    <option value="specificDateTime">Wait until a specific date/time</option>
                    <option value="fromContextVariable">Wait until date/time from context variable</option>
                </select>
            </div>

            {timerType === 'duration' && (
                <div>
                    <label htmlFor="timerDelayValue" className="block text-xs font-medium text-gray-700 mb-1">
                        Wait Duration:
                    </label>
                    <div className="flex items-center space-x-2">
                        <input
                            type="number"
                            id="timerDelayValue"
                            name="delayValue"
                            value={delayValue}
                            onChange={(e) => handleConfigChange({ target: { name: 'delayValue', value: parseInt(e.target.value, 10) || '' } })}
                            onBlur={(e) => handleConfigBlur({ target: { name: 'delayValue', value: parseInt(e.target.value, 10) || 0 } })}
                            placeholder="e.g., 30"
                            min="1"
                            className="w-2/3 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        />
                        <select
                            id="timerDelayUnit"
                            name="delayUnit"
                            value={delayUnit}
                            onChange={handleConfigChange}
                            onBlur={handleConfigBlur}
                            className="w-1/3 px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                        >
                            {TIME_UNITS.map(unit => (
                                <option key={unit.value} value={unit.value}>
                                    {unit.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                        Define how long the workflow should pause.
                    </p>
                </div>
            )}

            {timerType === 'specificDateTime' && (
                <div>
                    <label htmlFor="specificResumeAt" className="block text-xs font-medium text-gray-700 mb-1">
                        Resume At Date & Time:
                    </label>
                    <input
                        type="datetime-local"
                        id="specificResumeAt"
                        name="specificResumeAt"
                        value={specificResumeAt}
                        onChange={handleConfigChange}
                        onBlur={handleConfigBlur}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        The workflow will pause until this specified date and time.
                    </p>
                </div>
            )}

            {timerType === 'fromContextVariable' && (
                <div>
                    <label htmlFor="resumeAtContextVar" className="block text-xs font-medium text-gray-700 mb-1">
                        Context Variable for Resume Date/Time:
                    </label>
                    <input
                        type="text"
                        id="resumeAtContextVar"
                        name="resumeAtContextVar"
                        value={resumeAtContextVar}
                        onChange={handleConfigChange}
                        onBlur={handleConfigBlur}
                        placeholder="e.g., {{calculatedDueDate}} or {{nextStepTimestamp}}"
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                        Enter a context variable path (e.g., `{"{{myDateVar}}"}`). The variable should contain an ISO date string (e.g., "2025-12-31T10:00:00.000Z") or a Unix timestamp (milliseconds).
                    </p>
                </div>
            )}

        </div>
    );
};