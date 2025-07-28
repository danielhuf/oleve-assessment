import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { promptService } from '../services/api';

interface AgentProgressProps {
  prompt: Prompt;
}

interface Session {
  id: string;
  prompt_id: string;
  stage: 'warmup' | 'scraping' | 'validation';
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  log: string[];
}

const AgentProgress: React.FC<AgentProgressProps> = ({ prompt }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentStage, setCurrentStage] = useState<'warmup' | 'scraping' | 'validation'>('warmup');
  const [currentMessage, setCurrentMessage] = useState<string>('Initializing...');
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const pollProgress = async () => {
      if (!isPolling) return;
      
      try {
        // Get sessions for real-time progress
        const fetchedSessions = await promptService.getSessions(prompt.id);
        setSessions(fetchedSessions);
        
        // Get updated prompt status
        const updatedPrompt = await promptService.getPrompt(prompt.id);
        
        if (updatedPrompt.status === 'completed') {
          setCurrentMessage('Workflow completed! 🎉');
          setIsPolling(false);
          return;
        }
        
        if (updatedPrompt.status === 'error') {
          setCurrentMessage('Workflow failed ❌');
          setIsPolling(false);
          return;
        }
        
        // Determine current stage and message from sessions
        if (fetchedSessions.length > 0) {
          const latestSession = fetchedSessions[fetchedSessions.length - 1];
          setCurrentStage(latestSession.stage);
          
          // Get the latest log message
          if (latestSession.log && latestSession.log.length > 0) {
            setCurrentMessage(latestSession.log[latestSession.log.length - 1]);
          } else {
            setCurrentMessage(getDefaultMessage(latestSession.stage));
          }
        }
        
      } catch (error) {
        console.error('Error polling progress:', error);
        setCurrentMessage('Error checking progress');
      }
    };

    // Initial poll
    pollProgress();
    
    // Set up polling interval (every 2 seconds)
    pollInterval = setInterval(pollProgress, 2000);
    
    // Cleanup
    return () => {
      clearInterval(pollInterval);
      setIsPolling(false);
    };
  }, [prompt.id, isPolling]);

  const getDefaultMessage = (stage: string): string => {
    switch (stage) {
      case 'warmup':
        return 'Warming up Pinterest account...';
      case 'scraping':
        return 'Scraping Pinterest pins...';
      case 'validation':
        return 'Validating images with AI...';
      default:
        return 'Processing...';
    }
  };

  const getStageIcon = (stage: string) => {
    switch (stage) {
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

  const getStageDescription = (stage: string) => {
    switch (stage) {
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

  const isStageCompleted = (stage: string): boolean => {
    return sessions.some(s => s.stage === stage && s.status === 'completed');
  };

  const isStageActive = (stage: string): boolean => {
    return currentStage === stage && isPolling;
  };

  const getStageStatus = (stage: string): 'completed' | 'active' | 'pending' => {
    if (isStageCompleted(stage)) return 'completed';
    if (isStageActive(stage)) return 'active';
    return 'pending';
  };

  return (
    <div className="agent-progress">
      <div className="progress-header">
        <h3>Agent Progress</h3>
        <div className="progress-status">
          <span className="status-message">{currentMessage}</span>
          {isPolling && <span className="pulse-dot">●</span>}
        </div>
      </div>
      
      <div className="progress-stages">
        <div className={`stage ${getStageStatus('warmup')}`}>
          <div className="stage-icon">🔥</div>
          <div className="stage-info">
            <div className="stage-name">Warm-up</div>
            <div className="stage-desc">Aligning Pinterest recommendations</div>
            {isStageActive('warmup') && (
              <div className="stage-logs">
                {sessions
                  .filter(s => s.stage === 'warmup')
                  .flatMap(s => s.log)
                  .slice(-3)
                  .map((log, i) => (
                    <div key={i} className="log-entry">• {log}</div>
                  ))}
              </div>
            )}
          </div>
        </div>
        
        <div className={`stage ${getStageStatus('scraping')}`}>
          <div className="stage-icon">🔍</div>
          <div className="stage-info">
            <div className="stage-name">Scraping</div>
            <div className="stage-desc">Extracting relevant pins</div>
            {isStageActive('scraping') && (
              <div className="stage-logs">
                {sessions
                  .filter(s => s.stage === 'scraping')
                  .flatMap(s => s.log)
                  .slice(-3)
                  .map((log, i) => (
                    <div key={i} className="log-entry">• {log}</div>
                  ))}
              </div>
            )}
          </div>
        </div>
        
        <div className={`stage ${getStageStatus('validation')}`}>
          <div className="stage-icon">🤖</div>
          <div className="stage-info">
            <div className="stage-name">AI Validation</div>
            <div className="stage-desc">Analyzing image quality</div>
            {isStageActive('validation') && (
              <div className="stage-logs">
                {sessions
                  .filter(s => s.stage === 'validation')
                  .flatMap(s => s.log)
                  .slice(-3)
                  .map((log, i) => (
                    <div key={i} className="log-entry">• {log}</div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="current-stage-info">
        <div className="stage-icon-large">{getStageIcon(currentStage)}</div>
        <div className="stage-details">
          <h4>Current Stage: {currentStage.charAt(0).toUpperCase() + currentStage.slice(1)}</h4>
          <p>{getStageDescription(currentStage)}</p>
        </div>
      </div>
      
      <div className="progress-note">
        <p>⏱️ This process typically takes 3-5 minutes. Please don't close this page.</p>
        {isPolling && <p className="live-indicator">🔄 Live updates enabled</p>}
      </div>
    </div>
  );
};

export default AgentProgress; 