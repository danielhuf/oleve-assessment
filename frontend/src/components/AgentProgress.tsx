import React, { useState, useEffect } from 'react';
import { Prompt } from '../types';
import { promptService } from '../services/api';

interface AgentProgressProps {
  prompt: Prompt;
  onWorkflowComplete?: () => void;
}

interface Session {
  id: string;
  prompt_id: string;
  stage: 'warmup' | 'scraping' | 'validation';
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  log: string[];
}

const AgentProgress: React.FC<AgentProgressProps> = ({ prompt, onWorkflowComplete }) => {
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
          // Notify parent to load pins immediately
          if (onWorkflowComplete) {
            onWorkflowComplete();
          }
          return;
        }
        
        if (updatedPrompt.status === 'error') {
          setCurrentMessage('Workflow failed ❌');
          setIsPolling(false);
          return;
        }
        
        // Determine current stage and message from sessions
        if (fetchedSessions.length > 0) {
          console.log('Sessions:', fetchedSessions); // Debug log
          
          // Find the current active stage (not completed)
          const activeSession = fetchedSessions.find(s => s.status === 'pending');
          const latestSession = fetchedSessions[fetchedSessions.length - 1];
          
          if (activeSession) {
            setCurrentStage(activeSession.stage);
            // Get the latest log message from active session
            if (activeSession.log && activeSession.log.length > 0) {
              const latestLog = activeSession.log[activeSession.log.length - 1];
              console.log(`Active session log: ${latestLog}`); // Debug log
              setCurrentMessage(latestLog);
            } else {
              setCurrentMessage(getDefaultMessage(activeSession.stage));
            }
          } else if (latestSession) {
            // All stages completed, show the last stage
            setCurrentStage(latestSession.stage);
            if (latestSession.log && latestSession.log.length > 0) {
              const latestLog = latestSession.log[latestSession.log.length - 1];
              console.log(`Latest session log: ${latestLog}`); // Debug log
              setCurrentMessage(latestLog);
            } else {
              setCurrentMessage(getDefaultMessage(latestSession.stage));
            }
          }
        } else {
          // No sessions yet, show initializing
          setCurrentMessage('Initializing...');
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
  }, [prompt.id]);

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

  const getStageStatus = (stage: string): 'completed' | 'active' | 'pending' => {
    // Check if this stage has been completed
    const stageCompleted = sessions.some(s => s.stage === stage && s.status === 'completed');
    
    // Check if this stage is currently active
    const stageActive = currentStage === stage && isPolling;
    
    // Check if we've moved past this stage (completed or failed)
    const stagePassed = sessions.some(s => s.stage === stage && (s.status === 'completed' || s.status === 'failed'));
    
    if (stageCompleted || stagePassed) return 'completed';
    if (stageActive) return 'active';
    return 'pending';
  };

  const stages = [
    { key: 'warmup', label: 'Warm-up', icon: '🔥' },
    { key: 'scraping', label: 'Scraping', icon: '🔍' },
    { key: 'validation', label: 'AI Validation', icon: '🤖' }
  ];

  return (
    <div className="agent-progress">
      <div className="progress-header">
        <h3>Agent Progress</h3>
        {isPolling && <span className="pulse-dot">●</span>}
      </div>
      
      {/* Simple Horizontal Progress Tracker */}
      <div className="progress-tracker">
        {stages.map((stage, index) => {
          const status = getStageStatus(stage.key as any);
          const isLast = index === stages.length - 1;
          
          return (
            <React.Fragment key={stage.key}>
              <div className={`tracker-step ${status}`}>
                <div className="step-icon">
                  {status === 'completed' ? '✓' : stage.icon}
                </div>
                <div className="step-label">{stage.label}</div>
              </div>
              {!isLast && (
                <div className={`tracker-line ${status === 'completed' ? 'completed' : 'pending'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Real-time Log Updates */}
      <div className="log-updates">
        <div className="log-message">
          <span className="log-icon">{getStageIcon(currentStage)}</span>
          <span className="log-text">{currentMessage}</span>
          {isPolling && <span className="live-indicator">●</span>}
        </div>
        
        {/* Show recent log history for debugging */}
        {sessions.length > 0 && (
          <div className="log-history">
            <details>
              <summary>📋 Recent Logs (Click to expand)</summary>
              <div className="log-entries">
                {sessions.map((session, index) => (
                  <div key={index} className="log-session">
                    <div className="log-session-header">
                      <strong>{session.stage}</strong> - {session.status}
                    </div>
                    {session.log && session.log.length > 0 && (
                      <div className="log-session-entries">
                        {session.log.slice(-3).map((logEntry, logIndex) => (
                          <div key={logIndex} className="log-entry">
                            {logEntry}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
      
      <div className="progress-note">
        <p>⏱️ This process typically takes 3-5 minutes. Please don't close this page.</p>
        {isPolling && <p className="live-updates">🔄 Live updates enabled</p>}
      </div>
    </div>
  );
};

export default AgentProgress; 