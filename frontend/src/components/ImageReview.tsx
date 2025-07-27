import React, { useState } from 'react';
import { Prompt, Pin, PinStatus } from '../types';

interface ImageReviewProps {
  pins: Pin[];
  prompt: Prompt;
  onStartValidation: () => void;
}

const ImageReview: React.FC<ImageReviewProps> = ({ pins, prompt, onStartValidation }) => {
  const [filter, setFilter] = useState<PinStatus>('all');
  const [showExplanations, setShowExplanations] = useState(false);

  const approvedPins = pins.filter(pin => pin.status === 'approved');
  const disqualifiedPins = pins.filter(pin => pin.status === 'disqualified');

  const filteredPins = filter === 'all' 
    ? pins 
    : filter === 'approved' 
    ? approvedPins 
    : disqualifiedPins;

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.8) return '#10b981'; // green
    if (score >= 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getMatchScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    return 'Poor';
  };

  return (
    <div className="image-review">
      <div className="review-header">
        <div className="review-stats">
          <div className="stat">
            <span className="stat-number">{pins.length}</span>
            <span className="stat-label">Total Pins</span>
          </div>
          <div className="stat">
            <span className="stat-number approved">{approvedPins.length}</span>
            <span className="stat-label">Approved</span>
          </div>
          <div className="stat">
            <span className="stat-number disqualified">{disqualifiedPins.length}</span>
            <span className="stat-label">Disqualified</span>
          </div>
          <div className="stat">
            <span className="stat-number">
              {pins.length > 0 ? Math.round((approvedPins.length / pins.length) * 100) : 0}%
            </span>
            <span className="stat-label">Approval Rate</span>
          </div>
        </div>

        <div className="review-controls">
          <div className="filter-controls">
            <label>Show:</label>
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as PinStatus)}
              className="filter-select"
            >
              <option value="all">All ({pins.length})</option>
              <option value="approved">Approved ({approvedPins.length})</option>
              <option value="disqualified">Disqualified ({disqualifiedPins.length})</option>
            </select>
          </div>

          <div className="view-controls">
            <label>
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
              />
              Show AI Explanations
            </label>
          </div>
        </div>
      </div>

      {filteredPins.length === 0 ? (
        <div className="no-results">
          <p>No pins match the current filter.</p>
        </div>
      ) : (
        <div className="pins-grid">
          {filteredPins.map((pin) => (
            <div key={pin.id} className={`pin-card ${pin.status}`}>
              <div className="pin-image">
                <img src={pin.image_url} alt={pin.title || 'Pinterest pin'} />
                <div className="pin-overlay">
                  <a 
                    href={pin.pin_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="pin-link"
                  >
                    View on Pinterest
                  </a>
                </div>
              </div>

              <div className="pin-content">
                <div className="pin-header">
                  <div className="pin-status">
                    {pin.status === 'approved' ? '✅ Approved' : '❌ Disqualified'}
                  </div>
                  <div 
                    className="match-score"
                    style={{ color: getMatchScoreColor(pin.match_score) }}
                  >
                    {Math.round(pin.match_score * 100)}% Match
                    <span className="score-label">({getMatchScoreLabel(pin.match_score)})</span>
                  </div>
                </div>

                {pin.title && (
                  <h4 className="pin-title">{pin.title}</h4>
                )}

                {pin.description && (
                  <p className="pin-description">{pin.description}</p>
                )}

                {showExplanations && (
                  <div className="ai-explanation">
                    <h5>AI Analysis:</h5>
                    <p>{pin.ai_explanation}</p>
                  </div>
                )}

                <div className="pin-metadata">
                  <small>Collected: {new Date(pin.metadata.collected_at).toLocaleDateString()}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {prompt.status === 'completed' && pins.length === 0 && (
        <div className="no-pins-message">
          <p>No pins were found for this prompt. You can try starting the workflow again.</p>
          <button onClick={onStartValidation} className="btn-primary">
            Start AI Validation
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageReview; 