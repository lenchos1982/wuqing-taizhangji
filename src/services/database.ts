import Database from '@tauri-apps/plugin-sql';
import type { 
  Project, 
  Document, 
  ExtractedField, 
  Template, 
  TemplateField, 
  SynonymMapping 
} from '../types';

let db: Database | null = null;

const DB_PATH = 'sqlite:taizhangji.db';

export async function initializeDatabase(): Promise<void> {
  db = await Database.load(DB_PATH);
  
  // Create tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK(file_type IN ('pdf', 'jpg', 'png')),
      page_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'processing' CHECK(status IN ('processing', 'completed', 'failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('invoice', 'contract', 'custom')),
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS template_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      field_name TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK(field_type IN ('text', 'number', 'date', 'currency')),
      is_required BOOLEAN DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      synonyms TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS extracted_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      template_field_id INTEGER,
      field_name TEXT NOT NULL,
      field_value TEXT,
      confidence REAL DEFAULT 0,
      status TEXT DEFAULT 'pending' CHECK(status IN ('confirmed', 'pending', 'rejected')),
      page_number INTEGER DEFAULT 1,
      bbox TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (template_field_id) REFERENCES template_fields(id) ON DELETE SET NULL
    )
  `);
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS synonym_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      standard_name TEXT NOT NULL,
      synonyms TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);
  
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_fields_document_id ON extracted_fields(document_id);
    CREATE INDEX IF NOT EXISTS idx_extracted_fields_status ON extracted_fields(status);
    CREATE INDEX IF NOT EXISTS idx_template_fields_template_id ON template_fields(template_id);
    CREATE INDEX IF NOT EXISTS idx_synonym_mappings_project_id ON synonym_mappings(project_id);
  `);
  
  console.log('Database initialized successfully');
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Project operations
export async function createProject(name: string, description?: string): Promise<Project> {
  const db = getDatabase();
  const result = await db.execute(
    'INSERT INTO projects (name, description) VALUES (?, ?)',
    [name, description || null]
  );
  
  const project = await db.select<Project[]>(
    'SELECT * FROM projects WHERE id = ?',
    [result.lastInsertId]
  );
  
  return project[0];
}

export async function getProjects(): Promise<Project[]> {
  const db = getDatabase();
  return await db.select<Project[]>('SELECT * FROM projects ORDER BY updated_at DESC');
}

export async function getProject(id: number): Promise<Project | null> {
  const db = getDatabase();
  const projects = await db.select<Project[]>('SELECT * FROM projects WHERE id = ?', [id]);
  return projects[0] || null;
}

export async function updateProject(id: number, name: string, description?: string): Promise<void> {
  const db = getDatabase();
  await db.execute(
    'UPDATE projects SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, description || null, id]
  );
}

export async function deleteProject(id: number): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM projects WHERE id = ?', [id]);
}

// Document operations
export async function createDocument(
  projectId: number, 
  fileName: string, 
  filePath: string, 
  fileType: 'pdf' | 'jpg' | 'png',
  pageCount: number = 1
): Promise<Document> {
  const db = getDatabase();
  const result = await db.execute(
    'INSERT INTO documents (project_id, file_name, file_path, file_type, page_count) VALUES (?, ?, ?, ?, ?)',
    [projectId, fileName, filePath, fileType, pageCount]
  );
  
  const documents = await db.select<Document[]>(
    'SELECT * FROM documents WHERE id = ?',
    [result.lastInsertId]
  );
  
  return documents[0];
}

export async function getDocumentsByProject(projectId: number): Promise<Document[]> {
  const db = getDatabase();
  return await db.select<Document[]>(
    'SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

export async function updateDocumentStatus(id: number, status: 'processing' | 'completed' | 'failed'): Promise<void> {
  const db = getDatabase();
  await db.execute(
    'UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, id]
  );
}

export async function deleteDocument(id: number): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM documents WHERE id = ?', [id]);
}

// ExtractedField operations
export async function createExtractedField(
  documentId: number,
  fieldName: string,
  fieldValue: string,
  confidence: number,
  pageNumber: number = 1,
  bbox?: { x: number; y: number; width: number; height: number },
  templateFieldId?: number
): Promise<ExtractedField> {
  const db = getDatabase();
  const result = await db.execute(
    `INSERT INTO extracted_fields 
     (document_id, template_field_id, field_name, field_value, confidence, page_number, bbox) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      documentId, 
      templateFieldId || null, 
      fieldName, 
      fieldValue, 
      confidence, 
      pageNumber,
      bbox ? JSON.stringify(bbox) : null
    ]
  );
  
  const fields = await db.select<ExtractedField[]>(
    'SELECT * FROM extracted_fields WHERE id = ?',
    [result.lastInsertId]
  );
  
  return fields[0];
}

export async function getExtractedFieldsByDocument(documentId: number): Promise<ExtractedField[]> {
  const db = getDatabase();
  return await db.select<ExtractedField[]>(
    'SELECT * FROM extracted_fields WHERE document_id = ? ORDER BY page_number, field_name',
    [documentId]
  );
}

export async function getPendingFields(threshold: number = 80): Promise<ExtractedField[]> {
  const db = getDatabase();
  return await db.select<ExtractedField[]>(
    `SELECT ef.*, d.file_name, d.file_path 
     FROM extracted_fields ef
     JOIN documents d ON ef.document_id = d.id
     WHERE ef.confidence < ? AND ef.status = 'pending'
     ORDER BY ef.confidence ASC, ef.created_at DESC`,
    [threshold]
  );
}

export async function updateFieldStatus(
  id: number, 
  status: 'confirmed' | 'pending' | 'rejected',
  fieldValue?: string
): Promise<void> {
  const db = getDatabase();
  if (fieldValue !== undefined) {
    await db.execute(
      'UPDATE extracted_fields SET status = ?, field_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, fieldValue, id]
    );
  } else {
    await db.execute(
      'UPDATE extracted_fields SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
  }
}

// Template operations
export async function createTemplate(
  projectId: number,
  name: string,
  type: 'invoice' | 'contract' | 'custom',
  description?: string
): Promise<Template> {
  const db = getDatabase();
  const result = await db.execute(
    'INSERT INTO templates (project_id, name, type, description) VALUES (?, ?, ?, ?)',
    [projectId, name, type, description || null]
  );
  
  const templates = await db.select<Template[]>(
    'SELECT * FROM templates WHERE id = ?',
    [result.lastInsertId]
  );
  
  return templates[0];
}

export async function getTemplatesByProject(projectId: number): Promise<Template[]> {
  const db = getDatabase();
  return await db.select<Template[]>(
    'SELECT * FROM templates WHERE project_id = ? ORDER BY name',
    [projectId]
  );
}

// TemplateField operations
export async function createTemplateField(
  templateId: number,
  fieldName: string,
  fieldType: 'text' | 'number' | 'date' | 'currency',
  isRequired: boolean = false,
  orderIndex: number = 0,
  synonyms?: string[]
): Promise<TemplateField> {
  const db = getDatabase();
  const result = await db.execute(
    'INSERT INTO template_fields (template_id, field_name, field_type, is_required, order_index, synonyms) VALUES (?, ?, ?, ?, ?, ?)',
    [templateId, fieldName, fieldType, isRequired ? 1 : 0, orderIndex, synonyms ? JSON.stringify(synonyms) : null]
  );
  
  const fields = await db.select<TemplateField[]>(
    'SELECT * FROM template_fields WHERE id = ?',
    [result.lastInsertId]
  );
  
  return fields[0];
}

export async function getTemplateFields(templateId: number): Promise<TemplateField[]> {
  const db = getDatabase();
  return await db.select<TemplateField[]>(
    'SELECT * FROM template_fields WHERE template_id = ? ORDER BY order_index',
    [templateId]
  );
}

// SynonymMapping operations
export async function createSynonymMapping(
  projectId: number,
  standardName: string,
  synonyms: string[]
): Promise<SynonymMapping> {
  const db = getDatabase();
  const result = await db.execute(
    'INSERT INTO synonym_mappings (project_id, standard_name, synonyms) VALUES (?, ?, ?)',
    [projectId, standardName, JSON.stringify(synonyms)]
  );
  
  const mappings = await db.select<SynonymMapping[]>(
    'SELECT * FROM synonym_mappings WHERE id = ?',
    [result.lastInsertId]
  );
  
  return mappings[0];
}

export async function getSynonymMappingsByProject(projectId: number): Promise<SynonymMapping[]> {
  const db = getDatabase();
  return await db.select<SynonymMapping[]>(
    'SELECT * FROM synonym_mappings WHERE project_id = ?',
    [projectId]
  );
}

export async function getAllSynonymsByProject(projectId: number): Promise<Map<string, string[]>> {
  const mappings = await getSynonymMappingsByProject(projectId);
  const synonymMap = new Map<string, string[]>();
  
  for (const mapping of mappings) {
    const synonyms = JSON.parse(mapping.synonyms) as string[];
    synonymMap.set(mapping.standard_name, synonyms);
    // Also map synonyms back to standard name
    for (const synonym of synonyms) {
      synonymMap.set(synonym, [mapping.standard_name]);
    }
  }
  
  return synonymMap;
}

export async function deleteSynonymMapping(id: number): Promise<void> {
  const db = getDatabase();
  await db.execute('DELETE FROM synonym_mappings WHERE id = ?', [id]);
}

// Export operations
export async function getExportData(projectId: number, includePending: boolean = false): Promise<any[]> {
  const db = getDatabase();
  const statusFilter = includePending ? '' : "AND ef.status = 'confirmed'";
  
  return await db.select(
    `SELECT 
      d.file_name as document_name,
      d.file_type,
      ef.field_name,
      ef.field_value,
      ef.confidence,
      ef.status,
      ef.page_number
     FROM documents d
     JOIN extracted_fields ef ON d.id = ef.document_id
     WHERE d.project_id = ? ${statusFilter}
     ORDER BY d.file_name, ef.page_number, ef.field_name`,
    [projectId]
  );
}
