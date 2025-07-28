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
          setIsPolling(false);
          console.log('Workflow failed - stopping polling');
          
          // Clear the interval immediately
          if (pollInterval) {
            clearInterval(pollInterval);
            console.log('Cleared polling interval');
          }
          return;
        }
        
              } catch (error) {
          console.error('Error polling progress:', error);
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



  const getStageStatus = (stage: string): 'completed' | 'active' | 'pending' => {
    // Check if this stage has been completed
    const stageCompleted = sessions.some(s => s.stage === stage && s.status === 'completed');
    
    // Check if this stage is currently active (pending status and still polling)
    const stageActive = sessions.some(s => s.stage === stage && s.status === 'pending') && isPolling;
    
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
      
      {/* Show log history */}
      {sessions.length > 0 && (
        <div className="log-history">
          <details open>
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
      
      <div className="progress-note">
        <p>⏱️ This process typically takes 3-5 minutes. Please don't close this page.</p>
        {isPolling && <p className="live-updates">🔄 Live updates enabled</p>}
      </div>
    </div>
  );
};

export default AgentProgress; 