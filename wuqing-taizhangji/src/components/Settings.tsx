import React, { useState } from 'react';
import './Settings.css';

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you'd save this to localStorage or a backend
    console.log('Alibaba Cloud API Key saved:', apiKey);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="settings">
      <h2 className="settings__title">Settings</h2>
      <form className="settings__form" onSubmit={handleSubmit}>
        <div className="settings__field">
          <label htmlFor="apiKey" className="settings__label">
            Alibaba Cloud API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Alibaba Cloud API Key"
            className="settings__input"
          />
        </div>
        <button type="submit" className="settings__button">
          Save
        </button>
        {isSaved && <p className="settings__success">Settings saved successfully!</p>}
      </form>
    </div>
  );
};

export default Settings;
