// Database types
export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: number;
  project_id: number;
  file_name: string;
  file_path: string;
  file_type: 'pdf' | 'jpg' | 'png';
  page_count: number;
  status: 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ExtractedField {
  id: number;
  document_id: number;
  template_field_id: number | null;
  field_name: string;
  field_value: string;
  confidence: number;
  status: 'confirmed' | 'pending' | 'rejected';
  page_number: number;
  bbox: string | null; // JSON string of bounding box coordinates
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: number;
  project_id: number;
  name: string;
  type: 'invoice' | 'contract' | 'custom';
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateField {
  id: number;
  template_id: number;
  field_name: string;
  field_type: 'text' | 'number' | 'date' | 'currency';
  is_required: boolean;
  order_index: number;
  synonyms: string | null; // JSON array of synonyms
  created_at: string;
}

export interface SynonymMapping {
  id: number;
  project_id: number;
  standard_name: string;
  synonyms: string; // JSON array of synonyms
  created_at: string;
  updated_at: string;
}

// OCR types
export interface OCROptions {
  apiKey: string;
  apiSecret?: string;
  endpoint: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OCRPageResult {
  pageNumber: number;
  text: string;
  fields: OCRResult[];
  tickets?: TicketRegion[];
}

export interface TicketRegion {
  ticketIndex: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fields: OCRResult[];
}

// App state types
export interface AppState {
  currentProject: Project | null;
  currentDocument: Document | null;
  confidenceThreshold: number;
}

// Export types
export interface ExportOptions {
  projectId: number;
  includePending: boolean;
  format: 'xlsx' | 'csv';
}
