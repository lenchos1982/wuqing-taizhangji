import React, { useState } from 'react';
import { getExportData } from '../services/database';
import * as XLSX from 'xlsx';
import './ExportData.css';

interface ExportDataProps {
  projectId: number;
  projectName?: string;
}

export const ExportData: React.FC<ExportDataProps> = ({ projectId, projectName }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [includePending, setIncludePending] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [lastExportTime, setLastExportTime] = useState<string | null>(null);

  const handleExport = async () => {
    if (!projectId) return;
    
    setIsExporting(true);
    try {
      const data = await getExportData(projectId, includePending);
      
      if (data.length === 0) {
        alert('No data available to export');
        return;
      }

      // Transform data for export
      const exportData = data.map((row: any) => ({
        'Document Name': row.document_name,
        'File Type': row.file_type,
        'Field Name': row.field_name,
        'Field Value': row.field_value,
        'Confidence': row.confidence ? `${row.confidence.toFixed(1)}%` : 'N/A',
        'Status': row.status,
        'Page Number': row.page_number,
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Document Name
        { wch: 10 }, // File Type
        { wch: 20 }, // Field Name
        { wch: 30 }, // Field Value
        { wch: 12 }, // Confidence
        { wch: 12 }, // Status
        { wch: 12 }, // Page Number
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Export Data');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = projectName 
        ? `${projectName}_export_${timestamp}` 
        : `export_${timestamp}`;

      // Download file
      if (exportFormat === 'xlsx') {
        XLSX.writeFile(wb, `${filename}.xlsx`);
      } else {
        XLSX.writeFile(wb, `${filename}.csv`);
      }

      setLastExportTime(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-data">
      <div className="export-data__card">
        <div className="export-data__header">
          <svg
            className="export-data__icon"
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <h3 className="export-data__title">Export Data</h3>
        </div>

        <p className="export-data__description">
          Export extracted fields to Excel or CSV format for further analysis or sharing.
        </p>

        <div className="export-data__options">
          <div className="export-data__option">
            <label className="export-data__label">
              <input
                type="checkbox"
                checked={includePending}
                onChange={(e) => setIncludePending(e.target.checked)}
                className="export-data__checkbox"
              />
              <span>Include pending items</span>
            </label>
            <p className="export-data__hint">
              Include fields that haven't been confirmed yet
            </p>
          </div>

          <div className="export-data__option">
            <label className="export-data__label">Export Format</label>
            <div className="export-data__format-buttons">
              <button
                className={`export-data__format-btn ${exportFormat === 'xlsx' ? 'active' : ''}`}
                onClick={() => setExportFormat('xlsx')}
              >
                Excel (.xlsx)
              </button>
              <button
                className={`export-data__format-btn ${exportFormat === 'csv' ? 'active' : ''}`}
                onClick={() => setExportFormat('csv')}
              >
                CSV (.csv)
              </button>
            </div>
          </div>
        </div>

        <button
          className="export-data__btn"
          onClick={handleExport}
          disabled={isExporting || !projectId}
        >
          {isExporting ? (
            <>
              <span className="export-data__spinner"></span>
              Exporting...
            </>
          ) : (
            <>
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export {exportFormat.toUpperCase()}
            </>
          )}
        </button>

        {lastExportTime && (
          <p className="export-data__success">
            ✓ Last exported at {lastExportTime}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExportData;
