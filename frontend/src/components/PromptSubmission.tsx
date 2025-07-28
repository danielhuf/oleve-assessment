import React, { useState } from 'react';

interface PromptSubmissionProps {
  onSubmit: (text: string) => void;
  loading: boolean;
}

const PromptSubmission: React.FC<PromptSubmissionProps> = ({ onSubmit, loading }) => {
  const [promptText, setPromptText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promptText.trim()) {
      onSubmit(promptText.trim());
      setPromptText('');
    }
  };

  return (
    <div className="prompt-submission">
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="cozy industrial home office"
            disabled={loading}
            className="prompt-input"
          />
          <button 
            type="submit" 
            disabled={loading || !promptText.trim()}
            className="submit-btn"
          >
            {loading ? 'Starting Agent...' : 'Start Agent'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PromptSubmission; 