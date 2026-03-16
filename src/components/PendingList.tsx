import React, { useState, useCallback } from 'react';
import { ExtractedField, Document } from '../types';
import './PendingList.css';

interface PendingItem extends ExtractedField {
  document?: Document;
  thumbnailUrl?: string;
}

interface PendingListProps {
  items: PendingItem[];
  confidenceThreshold?: number;
  onConfirm: (item: ExtractedField, correctedValue: string) => void;
  onReject: (item: ExtractedField) => void;
  onEdit: (item: ExtractedField, newValue: string) => void;
}

export const PendingList: React.FC<PendingListProps> = ({
  items,
  confidenceThreshold = 80,
  onConfirm,
  onReject,
  onEdit,
}) => {
  const [editingValues, setEditingValues] = useState<Record<number, string>>({});

  const pendingItems = items.filter(
    (item) => item.confidence < confidenceThreshold && item.status !== 'rejected'
  );

  const handleValueChange = useCallback((itemId: number, value: string) => {
    setEditingValues((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  }, []);

  const handleConfirm = useCallback(
    (item: PendingItem) => {
      const correctedValue = editingValues[item.id] ?? item.field_value;
      onConfirm(item, correctedValue);
      setEditingValues((prev) => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
    },
    [editingValues, onConfirm]
  );

  const handleReject = useCallback(
    (item: PendingItem) => {
      onReject(item);
      setEditingValues((prev) => {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      });
    },
    [onReject]
  );

  const handleBlur = useCallback(
    (item: PendingItem) => {
      const newValue = editingValues[item.id];
      if (newValue !== undefined && newValue !== item.field_value) {
        onEdit(item, newValue);
      }
    },
    [editingValues, onEdit]
  );

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 60) return 'pending-list__confidence--medium';
    if (confidence >= 40) return 'pending-list__confidence--low';
    return 'pending-list__confidence--critical';
  };

  if (pendingItems.length === 0) {
    return (
      <div className="pending-list">
        <div className="pending-list__empty">
          <svg
            className="pending-list__empty-icon"
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <p className="pending-list__empty-text">No items pending review</p>
          <p className="pending-list__empty-hint">
            All extracted fields have been reviewed or have high confidence scores
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-list">
      <div className="pending-list__header">
        <h2 className="pending-list__title">
          Pending Review
          <span className="pending-list__count">{pendingItems.length}</span>
        </h2>
        <p className="pending-list__subtitle">
          Items below {confidenceThreshold}% confidence need verification
        </p>
      </div>

      <div className="pending-list__items">
        {pendingItems.map((item) => (
          <div
            key={item.id}
            className={`pending-list__item ${
              item.status === 'confirmed' ? 'pending-list__item--confirmed' : ''
            }`}
          >
            <div className="pending-list__thumbnail">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={`Page ${item.page_number}`}
                  className="pending-list__thumbnail-img"
                />
              ) : (
                <div className="pending-list__thumbnail-placeholder">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
              <span className="pending-list__page-number">
                Page {item.page_number}
              </span>
            </div>

            <div className="pending-list__content">
              <div className="pending-list__field-header">
                <span className="pending-list__field-name">{item.field_name}</span>
                <span
                  className={`pending-list__confidence ${getConfidenceColor(
                    item.confidence
                  )}`}
                >
                  {item.confidence.toFixed(1)}%
                </span>
              </div>

              <div className="pending-list__field-input-wrapper">
                <input
                  type="text"
                  className="pending-list__field-input"
                  value={editingValues[item.id] ?? item.field_value}
                  onChange={(e) => handleValueChange(item.id, e.target.value)}
                  onBlur={() => handleBlur(item)}
                  placeholder="Enter corrected value..."
                  disabled={item.status === 'confirmed'}
                />
                {item.status === 'confirmed' && (
                  <span className="pending-list__confirmed-badge">✓ Confirmed</span>
                )}
              </div>

              {item.document && (
                <div className="pending-list__document-info">
                  <span className="pending-list__document-name">
                    {item.document.file_name}
                  </span>
                </div>
              )}
            </div>

            <div className="pending-list__actions">
              <button
                className="pending-list__btn pending-list__btn--confirm"
                onClick={() => handleConfirm(item)}
                disabled={item.status === 'confirmed'}
                title="Confirm this value is correct"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Confirm
              </button>
              <button
                className="pending-list__btn pending-list__btn--reject"
                onClick={() => handleReject(item)}
                disabled={item.status === 'confirmed'}
                title="Reject this extraction"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingList;
