import { useState, useEffect } from "react";
import "./App.css";

// Import all components
import DocumentImport from "./components/DocumentImport";
import FieldDefinition from "./components/FieldDefinition";
import SynonymMappingComponent from "./components/SynonymMapping";
import PendingList from "./components/PendingList";
import ExcelExport from "./components/ExcelExport";
import Settings from "./components/Settings";

// Import types
import type { Project, Document, ExtractedField } from "./types";
// Import database functions (lazy loaded)
import { initializeDatabase, getProjects, createProject, getDocumentsByProject, getExtractedFieldsByDocument, updateFieldStatus } from "./services/database";

type TabType = 'import' | 'fields' | 'synonyms' | 'pending' | 'export' | 'settings';

interface AppState {
  isDbReady: boolean;
  activeTab: TabType;
  projects: Project[];
  currentProject: Project | null;
  documents: Document[];
  extractedFields: ExtractedField[];
  pendingFields: ExtractedField[];
  apiKey: string;
}

function App() {
  const [state, setState] = useState<AppState>({
    isDbReady: false,
    activeTab: 'import',
    projects: [],
    currentProject: null,
    documents: [],
    extractedFields: [],
    pendingFields: [],
    apiKey: '',
  });
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Initialize database on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        const projects = await getProjects();
        setState(prev => ({ ...prev, isDbReady: true, projects }));
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    init();
  }, []);

  // Load project data when currentProject changes
  useEffect(() => {
    const loadProjectData = async () => {
      if (!state.currentProject) {
        setState(prev => ({ ...prev, documents: [], extractedFields: [], pendingFields: [] }));
        return;
      }
      try {
        const documents = await getDocumentsByProject(state.currentProject.id);
        
        // Get all extracted fields from all documents
        const allFields: ExtractedField[] = [];
        for (const doc of documents) {
          const fields = await getExtractedFieldsByDocument(doc.id);
          allFields.push(...fields);
        }
        
        // Get pending fields
        const pendingFields = allFields.filter(f => f.status === 'pending' && f.confidence < 80);
        
        setState(prev => ({
          ...prev,
          documents,
          extractedFields: allFields,
          pendingFields
        }));
      } catch (error) {
        console.error('Failed to load project data:', error);
      }
    };
    loadProjectData();
  }, [state.currentProject]);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setIsCreatingProject(true);
    try {
      const project = await createProject(newProjectName.trim());
      setState(prev => ({
        ...prev,
        projects: [project, ...prev.projects],
        currentProject: project
      }));
      setNewProjectName('');
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    setState(prev => ({ ...prev, currentProject: project }));
  };

  const handleFilesSelected = async (files: File[]) => {
    if (!state.currentProject) {
      alert('Please select or create a project first');
      return;
    }
    
    // In a real implementation, this would upload files and process them
    console.log('Files selected:', files);
    alert(`Selected ${files.length} file(s). OCR processing would happen here.`);
  };

  const handleConfirmField = async (item: ExtractedField, correctedValue: string) => {
    try {
      await updateFieldStatus(item.id, 'confirmed', correctedValue);
      setState(prev => ({
        ...prev,
        pendingFields: prev.pendingFields.filter(f => f.id !== item.id),
        extractedFields: prev.extractedFields.map(f => 
          f.id === item.id ? { ...f, status: 'confirmed' as const, field_value: correctedValue } : f
        )
      }));
    } catch (error) {
      console.error('Failed to confirm field:', error);
    }
  };

  const handleRejectField = async (item: ExtractedField) => {
    try {
      await updateFieldStatus(item.id, 'rejected');
      setState(prev => ({
        ...prev,
        pendingFields: prev.pendingFields.filter(f => f.id !== item.id),
        extractedFields: prev.extractedFields.map(f => 
          f.id === item.id ? { ...f, status: 'rejected' as const } : f
        )
      }));
    } catch (error) {
      console.error('Failed to reject field:', error);
    }
  };

  const handleEditField = async (item: ExtractedField, newValue: string) => {
    // Just update local state, the value will be confirmed when user clicks confirm
    setState(prev => ({
      ...prev,
      extractedFields: prev.extractedFields.map(f =>
        f.id === item.id ? { ...f, field_value: newValue } : f
      )
    }));
  };

  const setActiveTab = (tab: TabType) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  };

  const renderTabContent = () => {
    switch (state.activeTab) {
      case 'import':
        return (
          <div className="tab-content">
            <div className="project-selector">
              <h3>Select Project</h3>
              {state.projects.length === 0 ? (
                <p className="no-projects">No projects yet. Create one below.</p>
              ) : (
                <div className="project-list">
                  {state.projects.map(project => (
                    <button
                      key={project.id}
                      className={`project-item ${state.currentProject?.id === project.id ? 'active' : ''}`}
                      onClick={() => handleSelectProject(project)}
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="new-project-form">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name..."
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                />
                <button onClick={handleCreateProject} disabled={isCreatingProject}>
                  {isCreatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </div>
            <div className="import-section">
              <h3>Import Documents</h3>
              {state.currentProject ? (
                <DocumentImport
                  onFilesSelected={handleFilesSelected}
                  acceptedTypes={[".pdf", ".jpg", ".jpeg", ".png"]}
                  maxFileSize={100 * 1024 * 1024}
                />
              ) : (
                <p className="hint">Select a project to import documents</p>
              )}
            </div>
            {state.documents.length > 0 && (
              <div className="documents-list">
                <h4>Documents in {state.currentProject?.name}</h4>
                <ul>
                  {state.documents.map(doc => (
                    <li key={doc.id}>
                      <span className={`status-badge ${doc.status}`}>{doc.status}</span>
                      {doc.file_name} ({doc.page_count} pages)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      
      case 'fields':
        return (
          <div className="tab-content">
            {state.currentProject ? (
              <FieldDefinition />
            ) : (
              <p className="hint">Select a project to define fields</p>
            )}
          </div>
        );
      
      case 'synonyms':
        return (
          <div className="tab-content">
            {state.currentProject ? (
              <SynonymMappingComponent projectId={state.currentProject.id} />
            ) : (
              <p className="hint">Select a project to manage synonyms</p>
            )}
          </div>
        );
      
      case 'pending':
        return (
          <div className="tab-content">
            <PendingList
              items={state.pendingFields}
              confidenceThreshold={80}
              onConfirm={handleConfirmField}
              onReject={handleRejectField}
              onEdit={handleEditField}
            />
          </div>
        );
      
      case 'export':
        return (
          <div className="tab-content">
            {state.currentProject ? (
              <div className="export-container">
                <ExcelExport project={state.currentProject} />
                <div className="stats-section">
                  <h3>Project Statistics</h3>
                  <div className="stat-card">
                    <span className="stat-value">{state.documents.length}</span>
                    <span className="stat-label">Documents</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{state.extractedFields.length}</span>
                    <span className="stat-label">Extracted Fields</span>
                  </div>
                  <div className="stat-card">
                    <span className="stat-value">{state.pendingFields.length}</span>
                    <span className="stat-label">Pending Review</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="hint">Select a project to export data</p>
            )}
          </div>
        );
      
      case 'settings':
        return (
          <div className="tab-content">
            <Settings />
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!state.isDbReady) {
    return (
      <main className="app-loading">
        <div className="spinner"></div>
        <p>Initializing database...</p>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>📋 无情台账机</h1>
        {state.currentProject && (
          <span className="current-project">{state.currentProject.name}</span>
        )}
      </header>
      
      <nav className="app-nav">
        <button
          className={`nav-item ${state.activeTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveTab('import')}
        >
          📥 Import
        </button>
        <button
          className={`nav-item ${state.activeTab === 'fields' ? 'active' : ''}`}
          onClick={() => setActiveTab('fields')}
        >
          🔧 Fields
        </button>
        <button
          className={`nav-item ${state.activeTab === 'synonyms' ? 'active' : ''}`}
          onClick={() => setActiveTab('synonyms')}
        >
          🔤 Synonyms
        </button>
        <button
          className={`nav-item ${state.activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending
          {state.pendingFields.length > 0 && (
            <span className="badge">{state.pendingFields.length}</span>
          )}
        </button>
        <button
          className={`nav-item ${state.activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          📤 Export
        </button>
        <button
          className={`nav-item ${state.activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>
      
      <div className="app-content">
        {renderTabContent()}
      </div>
    </main>
  );
}

export default App;
