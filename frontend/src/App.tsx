import React, { useState, useEffect } from 'react';
import { Prompt, Pin } from './types';
import { promptService } from './services/api';
import PromptSubmission from './components/PromptSubmission';
import AgentProgress from './components/AgentProgress';
import ImageReview from './components/ImageReview';
import './App.css';

function App() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load prompts on component mount
  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const fetchedPrompts = await promptService.getPrompts();
      setPrompts(fetchedPrompts);
    } catch (err) {
      setError('Failed to load prompts');
      console.error('Error loading prompts:', err);
    }
  };

  const handleCreatePrompt = async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      const newPrompt = await promptService.createPrompt(text);
      setPrompts(prev => [newPrompt, ...prev]);
      setCurrentPrompt(newPrompt);
    } catch (err) {
      setError('Failed to create prompt');
      console.error('Error creating prompt:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWorkflow = async (promptId: string) => {
    setLoading(true);
    setError(null);
    try {
      await promptService.startWorkflow(promptId);
      // Update prompt status
      setPrompts(prev => prev.map(p => 
        p.id === promptId ? { ...p, status: 'processing' as const } : p
      ));
      setCurrentPrompt(prev => prev?.id === promptId ? { ...prev, status: 'processing' } : prev);
    } catch (err) {
      setError('Failed to start workflow');
      console.error('Error starting workflow:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartValidation = async (promptId: string) => {
    setLoading(true);
    setError(null);
    try {
      await promptService.startValidation(promptId);
      // Update prompt status
      setPrompts(prev => prev.map(p => 
        p.id === promptId ? { ...p, status: 'processing' as const } : p
      ));
      setCurrentPrompt(prev => prev?.id === promptId ? { ...prev, status: 'processing' } : prev);
    } catch (err) {
      setError('Failed to start validation');
      console.error('Error starting validation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadPins = async (promptId: string) => {
    try {
      const fetchedPins = await promptService.getPins(promptId);
      setPins(fetchedPins);
    } catch (err) {
      setError('Failed to load pins');
      console.error('Error loading pins:', err);
    }
  };

  const handleSelectPrompt = (prompt: Prompt) => {
    setCurrentPrompt(prompt);
    if (prompt.status === 'completed') {
      handleLoadPins(prompt.id);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    try {
      await promptService.deletePrompt(promptId);
      setPrompts(prev => prev.filter(p => p.id !== promptId));
      if (currentPrompt?.id === promptId) {
        setCurrentPrompt(null);
        setPins([]);
      }
    } catch (err) {
      setError('Failed to delete prompt');
      console.error('Error deleting prompt:', err);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>⚡ Pinterest AI - Content Discovery</h1>
        <p>AI-powered Pinterest content discovery and validation system</p>
      </header>

      <main className="App-main">
        {error && (
          <div className="error-message">
            {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className="app-layout">
          {/* Left sidebar - Prompt list */}
          <div className="sidebar">
            <h2>Your Prompts</h2>
            <PromptSubmission 
              onSubmit={handleCreatePrompt} 
              loading={loading} 
            />
            
            <div className="prompt-list">
              {prompts.map(prompt => (
                <div 
                  key={prompt.id} 
                  className={`prompt-item ${currentPrompt?.id === prompt.id ? 'active' : ''}`}
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  <div className="prompt-text">{prompt.text}</div>
                  <div className="prompt-status">{prompt.status}</div>
                  <button 
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePrompt(prompt.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main content area */}
          <div className="main-content">
            {currentPrompt ? (
              <>
                <div className="prompt-header">
                  <h2>"{currentPrompt.text}"</h2>
                  <div className="prompt-actions">
                    {currentPrompt.status === 'pending' && (
                      <button 
                        onClick={() => handleStartWorkflow(currentPrompt.id)}
                        disabled={loading}
                        className="btn-primary"
                      >
                        {loading ? 'Starting...' : 'Start Pinterest Workflow'}
                      </button>
                    )}
                    
                    {currentPrompt.status === 'processing' && (
                      <AgentProgress key={currentPrompt.id} prompt={currentPrompt} />
                    )}
                    
                    {currentPrompt.status === 'completed' && pins.length === 0 && (
                      <button 
                        onClick={() => handleLoadPins(currentPrompt.id)}
                        className="btn-secondary"
                      >
                        Load Results
                      </button>
                    )}
                  </div>
                </div>

                {pins.length > 0 && (
                  <ImageReview 
                    pins={pins} 
                    prompt={currentPrompt}
                    onStartValidation={() => handleStartValidation(currentPrompt.id)}
                  />
                )}
              </>
            ) : (
              <div className="empty-state">
                <h3>Select a prompt to get started</h3>
                <p>Create a new prompt or select an existing one to view results</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App; 