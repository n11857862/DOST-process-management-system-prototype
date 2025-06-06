import React from 'react';

export const DefaultPanel = ({ formData, handleChange, handleBlur, handleConfigChange, handleConfigBlur }) => {
  return (
    <>
      <p style={{ fontSize: '0.9em', color: '#666' }}>No specific configuration available for type: <strong>{formData.type}</strong>.</p>
      <label>Config (JSON):</label>
      <textarea
          name="config"
          rows={5}
          value={typeof formData.config === 'object' ? JSON.stringify(formData.config, null, 2) : formData.config || ''}
          onChange={(e) => {
              try {
                  const parsed = JSON.parse(e.target.value || '{}');
                  handleConfigChange({ target: { name: 'config', value: e.target.value } });
              } catch (err) {
                 handleConfigChange({ target: { name: 'config', value: e.target.value } });
              }
          }}
          onBlur={(e) => {
             handleConfigBlur({ target: { name: 'config' } });
          }}
          style={{ fontFamily: 'monospace', fontSize: '0.85em' }}
      />
    </>
  );
};
