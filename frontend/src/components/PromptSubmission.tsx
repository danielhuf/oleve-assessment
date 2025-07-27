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
            placeholder="Enter a visual prompt (e.g., 'cozy industrial home office')"
            disabled={loading}
            className="prompt-input"
          />
          <button 
            type="submit" 
            disabled={loading || !promptText.trim()}
            className="submit-btn"
          >
            {loading ? 'Creating...' : 'Create Prompt'}
          </button>
        </div>
      </form>
      
      <div className="prompt-examples">
        <p>Try prompts like:</p>
        <ul>
          <li>"modern minimalist bedroom"</li>
          <li>"boho chic living room"</li>
          <li>"industrial kitchen design"</li>
          <li>"scandinavian home office"</li>
        </ul>
      </div>
    </div>
  );
};

export default PromptSubmission; 