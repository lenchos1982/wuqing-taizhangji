import React, { useState, useEffect, useCallback } from 'react';
import {
  createSynonymMapping,
  getSynonymMappingsByProject,
  deleteSynonymMapping,
} from '../services/database';
import type { SynonymMapping as SynonymMappingType } from '../types';
import './SynonymMapping.css';

interface SynonymMappingProps {
  projectId: number;
}

export const SynonymMapping: React.FC<SynonymMappingProps> = ({ projectId }) => {
  const [mappings, setMappings] = useState<SynonymMappingType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newStandardName, setNewStandardName] = useState('');
  const [newSynonyms, setNewSynonyms] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStandardName, setEditStandardName] = useState('');
  const [editSynonyms, setEditSynonyms] = useState('');

  const loadMappings = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    try {
      const data = await getSynonymMappingsByProject(projectId);
      setMappings(data);
    } catch (error) {
      console.error('Failed to load synonym mappings:', error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleAddMapping = async () => {
    if (!newStandardName.trim() || !newSynonyms.trim() || !projectId) return;

    try {
      const synonyms = newSynonyms
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await createSynonymMapping(projectId, newStandardName.trim(), synonyms);
      setNewStandardName('');
      setNewSynonyms('');
      await loadMappings();
    } catch (error) {
      console.error('Failed to create synonym mapping:', error);
    }
  };

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('Are you sure you want to delete this synonym mapping?')) return;

    try {
      await deleteSynonymMapping(id);
      await loadMappings();
    } catch (error) {
      console.error('Failed to delete synonym mapping:', error);
    }
  };

  const handleStartEdit = (mapping: SynonymMappingType) => {
    setEditingId(mapping.id);
    setEditStandardName(mapping.standard_name);
    setEditSynonyms(JSON.parse(mapping.synonyms).join(', '));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditStandardName('');
    setEditSynonyms('');
  };

  if (!projectId) {
    return (
      <div className="synonym-mapping">
        <div className="synonym-mapping__empty">
          <p>Please select a project to manage synonym mappings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="synonym-mapping">
      <div className="synonym-mapping__header">
        <h2 className="synonym-mapping__title">Synonym Mapping</h2>
        <p className="synonym-mapping__subtitle">
          Define alternative names for field names to improve OCR matching accuracy
        </p>
      </div>

      {/* Add New Mapping Form */}
      <div className="synonym-mapping__form">
        <h3 className="synonym-mapping__form-title">Add New Mapping</h3>
        <div className="synonym-mapping__form-fields">
          <div className="synonym-mapping__form-field">
            <label className="synonym-mapping__label">Standard Name</label>
            <input
              type="text"
              value={newStandardName}
              onChange={(e) => setNewStandardName(e.target.value)}
              placeholder="e.g., invoice_number"
              className="synonym-mapping__input"
            />
          </div>
          <div className="synonym-mapping__form-field">
            <label className="synonym-mapping__label">Synonyms (comma-separated)</label>
            <input
              type="text"
              value={newSynonyms}
              onChange={(e) => setNewSynonyms(e.target.value)}
              placeholder="e.g., invoice no, bill number, receipt no"
              className="synonym-mapping__input"
            />
          </div>
          <button
            className="synonym-mapping__btn synonym-mapping__btn--primary"
            onClick={handleAddMapping}
            disabled={!newStandardName.trim() || !newSynonyms.trim()}
          >
            Add Mapping
          </button>
        </div>
      </div>

      {/* Mappings List */}
      <div className="synonym-mapping__list">
        <h3 className="synonym-mapping__list-title">
          Existing Mappings ({mappings.length})
        </h3>

        {isLoading ? (
          <div className="synonym-mapping__loading">Loading...</div>
        ) : mappings.length === 0 ? (
          <div className="synonym-mapping__empty-list">
            <p>No synonym mappings found. Add your first mapping above.</p>
          </div>
        ) : (
          <div className="synonym-mapping__items">
            {mappings.map((mapping) => (
              <div key={mapping.id} className="synonym-mapping__item">
                {editingId === mapping.id ? (
                  // Edit Mode
                  <div className="synonym-mapping__edit-form">
                    <input
                      type="text"
                      value={editStandardName}
                      onChange={(e) => setEditStandardName(e.target.value)}
                      className="synonym-mapping__input synonym-mapping__input--small"
                    />
                    <input
                      type="text"
                      value={editSynonyms}
                      onChange={(e) => setEditSynonyms(e.target.value)}
                      className="synonym-mapping__input synonym-mapping__input--small"
                      placeholder="Comma-separated synonyms"
                    />
                    <div className="synonym-mapping__edit-actions">
                      <button
                        className="synonym-mapping__btn synonym-mapping__btn--small"
                        onClick={() => {
                          // In a full implementation, this would call an update function
                          handleCancelEdit();
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="synonym-mapping__btn synonym-mapping__btn--small synonym-mapping__btn--secondary"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <>
                    <div className="synonym-mapping__item-content">
                      <div className="synonym-mapping__standard">
                        <span className="synonym-mapping__standard-label">Standard:</span>
                        <span className="synonym-mapping__standard-value">
                          {mapping.standard_name}
                        </span>
                      </div>
                      <div className="synonym-mapping__synonyms">
                        <span className="synonym-mapping__synonyms-label">Synonyms:</span>
                        <span className="synonym-mapping__synonyms-list">
                          {JSON.parse(mapping.synonyms).join(', ')}
                        </span>
                      </div>
                    </div>
                    <div className="synonym-mapping__item-actions">
                      <button
                        className="synonym-mapping__action-btn"
                        onClick={() => handleStartEdit(mapping)}
                        title="Edit"
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
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        className="synonym-mapping__action-btn synonym-mapping__action-btn--delete"
                        onClick={() => handleDeleteMapping(mapping.id)}
                        title="Delete"
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
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SynonymMapping;
