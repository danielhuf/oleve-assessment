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
      try {
        // Get sessions for real-time progress
        const fetchedSessions = await promptService.getSessions(prompt.id);
        setSessions(fetchedSessions);
        
        // Get updated prompt status
        const updatedPrompt = await promptService.getPrompt(prompt.id);
        
        if (updatedPrompt.status === 'completed') {
          // Show the most recent detailed log message instead of generic completion
          if (fetchedSessions.length > 0) {
            const latestSession = fetchedSessions[fetchedSessions.length - 1];
            if (latestSession.log && latestSession.log.length > 0) {
              const latestLog = latestSession.log[latestSession.log.length - 1];
              console.log(`Workflow completed, showing latest log: ${latestLog}`);
              setCurrentMessage(latestLog);
            } else {
              setCurrentMessage('Workflow completed! 🎉');
            }
          } else {
            setCurrentMessage('Workflow completed! 🎉');
          }
          
          // Stop polling immediately
          setIsPolling(false);
          console.log('Workflow completed - stopping polling');
          
          // Clear the interval immediately
          if (pollInterval) {
            clearInterval(pollInterval);
            console.log('Cleared polling interval');
          }
          
          // Notify parent to load pins immediately
          if (onWorkflowComplete) {
            onWorkflowComplete();
          }
          return;
        }
        
        if (updatedPrompt.status === 'error') {
          setCurrentMessage('Workflow failed ❌');
          setIsPolling(false);
          console.log('Workflow failed - stopping polling');
          
          // Clear the interval immediately
          if (pollInterval) {
            clearInterval(pollInterval);
            console.log('Cleared polling interval');
          }
          return;
        }
        
        // Determine current stage and message from sessions
        if (fetchedSessions.length > 0) {
          console.log('Sessions:', fetchedSessions); // Debug log
          
          // Find the current active stage (not completed) and the most recent session with logs
          const activeSession = fetchedSessions.find(s => s.status === 'pending');
          const latestSession = fetchedSessions[fetchedSessions.length - 1];
          
          // Find the session with the most recent log message
          let sessionWithLatestLog = null;
          let latestLogMessage = '';
          
          for (const session of fetchedSessions) {
            if (session.log && session.log.length > 0) {
              const lastLog = session.log[session.log.length - 1];
              if (!latestLogMessage || session.timestamp > sessionWithLatestLog.timestamp) {
                latestLogMessage = lastLog;
                sessionWithLatestLog = session;
              }
            }
          }
          
          console.log('Active session:', activeSession?.stage, activeSession?.status);
          console.log('Latest session:', latestSession?.stage, latestSession?.status);
          
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
          } else if (sessionWithLatestLog) {
            // Show the most recent log message from any session
            setCurrentStage(sessionWithLatestLog.stage);
            console.log(`Most recent log: ${latestLogMessage}`); // Debug log
            setCurrentMessage(latestLogMessage);
          } else if (latestSession) {
            // Fallback to latest session
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
    
    // Set up polling interval (every 2 seconds) only if still polling
    pollInterval = setInterval(() => {
      if (isPolling) {
        pollProgress();
      } else {
        clearInterval(pollInterval);
        console.log('Stopped polling due to isPolling = false');
      }
    }, 2000);
    
    // Cleanup
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        console.log('Cleaning up polling interval');
      }
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
        
        {/* Show recent log history */}
        {sessions.length > 0 && (
          <div className="log-history">
            <details>
              <summary>📋 Log History</summary>
              <div className="log-entries">
                {sessions.map((session, index) => (
                  <div key={index} className="log-session">
                    <div className="log-session-header">
                      {session.stage} - {session.status}
                    </div>
                    {session.log && session.log.length > 0 && (
                      <div className="log-session-entries">
                        {session.log.slice(-2).map((logEntry, logIndex) => (
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