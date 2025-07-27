import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { promptService } from '../services/api';

interface AgentProgressProps {
  prompt: Prompt;
}

const AgentProgress: React.FC<AgentProgressProps> = ({ prompt }) => {
  const [progress, setProgress] = useState<string>('Initializing...');
  const [stage, setStage] = useState<'warmup' | 'scraping' | 'validation'>('warmup');

  useEffect(() => {
    let isPolling = true;
    let pollCount = 0;
    const MAX_POLLS = 60; // Maximum 5 minutes (60 * 5 seconds)
    
    const pollProgress = async () => {
      if (!isPolling || pollCount >= MAX_POLLS) {
        if (pollCount >= MAX_POLLS) {
          setProgress('Workflow timeout - please check manually');
        }
        return;
      }
      
      pollCount++;
      
      try {
        const updatedPrompt = await promptService.getPrompt(prompt.id);
        
        if (updatedPrompt.status === 'completed') {
          setProgress('Workflow completed!');
          isPolling = false;
          return;
        }
        
        if (updatedPrompt.status === 'error') {
          setProgress('Workflow failed');
          isPolling = false;
          return;
        }
        
        // Simulate progress based on time elapsed
        const elapsed = Date.now() - new Date(prompt.created_at).getTime();
        const minutesElapsed = Math.floor(elapsed / 60000);
        
        if (minutesElapsed < 2) {
          setStage('warmup');
          setProgress('Warming up Pinterest account...');
        } else if (minutesElapsed < 4) {
          setStage('scraping');
          setProgress('Scraping Pinterest pins...');
        } else {
          setStage('validation');
          setProgress('Validating images with AI...');
        }
        
        // Continue polling with longer interval
        if (isPolling) {
          setTimeout(pollProgress, 5000);
        }
      } catch (error) {
        console.error('Error polling progress:', error);
        setProgress('Error checking progress');
      }
    };

    pollProgress();
    
    // Cleanup function to stop polling when component unmounts
    return () => {
      isPolling = false;
    };
  }, [prompt.id, prompt.created_at]);

  const getStageIcon = (currentStage: string) => {
    switch (currentStage) {
      case 'warmup':
        return '🔥';
      case 'scraping':
        return '🔍';
      case 'validation':
        return '🤖';
      default:
        return '⏳';
    }
  };

  const getStageDescription = (currentStage: string) => {
    switch (currentStage) {
      case 'warmup':
        return 'Searching Pinterest and engaging with content to align recommendations';
      case 'scraping':
        return 'Extracting relevant pins based on your prompt';
      case 'validation':
        return 'AI is analyzing each image to determine match quality';
      default:
        return 'Processing your request...';
    }
  };

  return (
    <div className="agent-progress">
      <div className="progress-header">
        <h3>Agent Progress</h3>
        <div className="progress-status">{progress}</div>
      </div>
      
      <div className="progress-stages">
        <div className={`stage ${stage === 'warmup' ? 'active' : stage === 'scraping' || stage === 'validation' ? 'completed' : ''}`}>
          <div className="stage-icon">🔥</div>
          <div className="stage-info">
            <div className="stage-name">Warm-up</div>
            <div className="stage-desc">Aligning Pinterest recommendations</div>
          </div>
        </div>
        
        <div className={`stage ${stage === 'scraping' ? 'active' : stage === 'validation' ? 'completed' : ''}`}>
          <div className="stage-icon">🔍</div>
          <div className="stage-info">
            <div className="stage-name">Scraping</div>
            <div className="stage-desc">Extracting relevant pins</div>
          </div>
        </div>
        
        <div className={`stage ${stage === 'validation' ? 'active' : ''}`}>
          <div className="stage-icon">🤖</div>
          <div className="stage-info">
            <div className="stage-name">AI Validation</div>
            <div className="stage-desc">Analyzing image quality</div>
          </div>
        </div>
      </div>
      
      <div className="current-stage-info">
        <div className="stage-icon-large">{getStageIcon(stage)}</div>
        <div className="stage-details">
          <h4>Current Stage: {stage.charAt(0).toUpperCase() + stage.slice(1)}</h4>
          <p>{getStageDescription(stage)}</p>
        </div>
      </div>
      
      <div className="progress-note">
        <p>⏱️ This process typically takes 3-5 minutes. Please don't close this page.</p>
      </div>
    </div>
  );
};

export default AgentProgress; 