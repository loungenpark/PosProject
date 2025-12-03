import React from 'react';

interface ToggleSwitchProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ label, enabled, onChange, description }) => {
  const handleToggle = () => {
    onChange(!enabled);
  };

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-700 last:border-b-0">
      <div>
        <label htmlFor={label} className="text-lg font-medium text-white">
          {label}
        </label>
        {description && <p className="text-sm text-gray-400 max-w-md">{description}</p>}
      </div>
      <div
        onClick={handleToggle}
        className={`relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 ${
          enabled ? 'bg-green-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-300 ease-in-out ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
    </div>
  );
};

export default ToggleSwitch;