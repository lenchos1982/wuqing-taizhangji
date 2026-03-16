import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { getExportData } from '../services/database';
import type { Project } from '../types';
import './ExcelExport.css';

interface ExcelExportProps {
  project: Project;
  includePending?: boolean;
}

export const ExcelExport: React.FC<ExcelExportProps> = ({
  project,
  includePending = false,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(false);

    try {
      const data = await getExportData(project.id, includePending);

      if (data.length === 0) {
        setError('No data to export for this project');
        setIsExporting(false);
        return;
      }

      // Format data for Excel
      const formattedData = data.map((row: any) => ({
        'Document Name': row.document_name,
        'File Type': row.file_type.toUpperCase(),
        'Page Number': row.page_number,
        'Field Name': row.field_name,
        'Field Value': row.field_value,
        'Confidence': `${(row.confidence * 100).toFixed(1)}%`,
        'Status': row.status.charAt(0).toUpperCase() + row.status.slice(1),
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(formattedData);

      // Set column widths
      const colWidths = [
        { wch: 30 }, // Document Name
        { wch: 10 }, // File Type
        { wch: 12 }, // Page Number
        { wch: 25 }, // Field Name
        { wch: 30 }, // Field Value
        { wch: 12 }, // Confidence
        { wch: 12 }, // Status
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Ledger Data');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${project.name}_export_${timestamp}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Export failed:', err);
      setError('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="excel-export">
      <h3 className="excel-export__title">Export to Excel</h3>
      <div className="excel-export__info">
        <p className="excel-export__project">
          <strong>Project:</strong> {project.name}
        </p>
        <p className="excel-export__description">
          Export all extracted field data for this project to an Excel file.
        </p>
      </div>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className="excel-export__button"
      >
        {isExporting ? 'Exporting...' : 'Export to Excel'}
      </button>

      {error && <p className="excel-export__error">{error}</p>}
      {success && (
        <p className="excel-export__success">
          Export completed successfully!
        </p>
      )}
    </div>
  );
};

export default ExcelExport;
