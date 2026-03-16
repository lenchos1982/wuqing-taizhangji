import React, { useCallback, useState, useRef } from 'react';
import './DocumentImport.css';

interface DocumentImportProps {
  onFilesSelected: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFileSize?: number; // in bytes
  multiple?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = ['.pdf', '.jpg', '.jpeg', '.png'];
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const DocumentImport: React.FC<DocumentImportProps> = ({
  onFilesSelected,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  multiple = true,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const normalizedAcceptedTypes = acceptedTypes.map(type => 
      type.toLowerCase().startsWith('.') ? type.toLowerCase() : `.${type.toLowerCase()}`
    );
    
    if (!normalizedAcceptedTypes.includes(fileExtension)) {
      return `Invalid file type: ${file.name}. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    
    if (file.size > maxFileSize) {
      return `File too large: ${file.name}. Max size: ${(maxFileSize / 1024 / 1024).toFixed(1)}MB`;
    }
    
    return null;
  };

  const processFiles = useCallback((fileList: FileList | null) => {
    setError(null);
    
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList);
    const validationErrors: string[] = [];
    const validFiles: File[] = [];

    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        validationErrors.push(error);
      } else {
        validFiles.push(file);
      }
    });

    if (validationErrors.length > 0) {
      setError(validationErrors.join('\n'));
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  }, [onFilesSelected, acceptedTypes, maxFileSize]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input so the same file can be selected again
    e.target.value = '';
  }, [processFiles]);

  return (
    <div className="document-import">
      <div
        className={`document-import__dropzone ${isDragging ? 'document-import__dropzone--dragging' : ''}`}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <div className="document-import__content">
          <svg
            className="document-import__icon"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="document-import__text">
            {isDragging ? 'Drop files here' : 'Drag and drop files here, or click to browse'}
          </p>
          <p className="document-import__hint">
            Accepted: {acceptedTypes.join(', ')} (Max: {(maxFileSize / 1024 / 1024).toFixed(0)}MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="document-import__input"
          accept={acceptedTypes.join(',')}
          multiple={multiple}
          onChange={handleFileInputChange}
        />
      </div>
      
      {error && (
        <div className="document-import__error">
          {error.split('\n').map((err, index) => (
            <div key={index}>{err}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentImport;
