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
  const [scoreThreshold, setScoreThreshold] = useState<number>(0.0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  const approvedPins = pins.filter(pin => pin.status === 'approved');
  const disqualifiedPins = pins.filter(pin => pin.status === 'disqualified');

  const filteredPins = pins
    .filter(pin => {
      // Apply status filter
      if (filter === 'approved' && pin.status !== 'approved') return false;
      if (filter === 'disqualified' && pin.status !== 'disqualified') return false;
      
      // Apply score threshold filter
      if (pin.match_score < scoreThreshold) return false;
      
      return true;
    });

  // Pagination logic
  const totalPages = Math.ceil(filteredPins.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPins = filteredPins.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, scoreThreshold]);

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.8) return '#10b981'; // green
    if (score >= 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
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
          <div className="control-group">
            <label className="ai-reasonings-toggle">
              <input
                type="checkbox"
                checked={showExplanations}
                onChange={(e) => setShowExplanations(e.target.checked)}
              />
              Show AI reasonings
            </label>
            
            <div className="score-threshold-control">
              <label>
                Min Score: {Math.round(scoreThreshold * 100)}%
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(scoreThreshold * 100)}
                  onChange={(e) => setScoreThreshold(parseInt(e.target.value) / 100)}
                  className="score-slider"
                />
              </label>
            </div>
            
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
          </div>
        </div>
      </div>

      {filteredPins.length === 0 ? (
        <div className="no-results">
          <p>No pins match the current filter.</p>
        </div>
      ) : (
        <>
          <div className="pins-grid">
            {currentPins.map((pin) => (
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
                    <div className="match-score-badge">
                      <span 
                        className="match-score-text"
                        style={{ 
                          backgroundColor: getMatchScoreColor(pin.match_score),
                          color: '#ffffff'
                        }}
                      >
                        {Math.round(pin.match_score * 100)}% Match
                      </span>
                    </div>
                  </div>

                                  {pin.title && pin.title.trim() && (
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

          {/* Pagination Controls - Outside the grid */}
          {totalPages > 1 && (
            <div className="pagination-controls">
              <div className="pagination-info">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredPins.length)} of {filteredPins.length} pins
              </div>
              
              <div className="pagination-buttons">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  ← Previous
                </button>
                
                <div className="page-numbers">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`page-btn ${currentPage === pageNum ? 'active' : ''}`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
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