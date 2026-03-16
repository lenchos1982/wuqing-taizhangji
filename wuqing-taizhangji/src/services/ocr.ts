import type { OCRResult, OCRPageResult, OCROptions, TicketRegion } from '../types';

// Alibaba Cloud OCR API integration
// Documentation: https://help.aliyun.com/document_detail/60760.html

const DEFAULT_CONFIDENCE_THRESHOLD = 80;

interface AlibabaOCRResponse {
  code: string;
  message: string;
  data?: {
    prism_version?: string;
    prism_wnum?: number;
    prism_wordsInfo?: Array<{
      word: string;
      confidence: number;
      pos: Array<{ x: number; y: number }>;
    }>;
    content?: string;
    height: number;
    width: number;
    orgHeight: number;
    orgWidth: number;
  };
}

export class OCRService {
  private apiKey: string;
  private endpoint: string;
  private confidenceThreshold: number;

  constructor(options: OCROptions) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint;
    this.confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD;
  }

  setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = threshold;
  }

  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }

  // Convert image file to base64
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Extract text from image using Alibaba OCR
  async extractTextFromImage(imageBase64: string, options?: {
    detectMultiTickets?: boolean;
    detectTables?: boolean;
  }): Promise<OCRPageResult> {
    try {
      // Build the API URL for Alibaba Cloud
      // Common OCR endpoint: https://ocr.aliyuncs.com/
      const apiUrl = `${this.endpoint}/action/RecognizeCharacter`;
      
      const requestBody = {
        ImageURL: imageBase64,
        OutputProbability: true,
        MinHeight: 10,
        ...options,
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`OCR API error: ${response.status} ${response.statusText}`);
      }

      const data: AlibabaOCRResponse = await response.json();

      if (data.code !== '200' && data.code !== '0') {
        throw new Error(`OCR API error: ${data.message}`);
      }

      return this.parseOCRResponse(data, 1, options?.detectMultiTickets);
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw error;
    }
  }

  // Extract text from PDF (convert to images first)
  async extractTextFromPDF(
    pdfFile: File, 
    options?: { 
      detectMultiTickets?: boolean;
      detectTables?: boolean;
    }
  ): Promise<OCRPageResult[]> {
    // For MVP, we'll use a simplified approach
    // In production, you would use pdf-lib or similar to split PDF into pages
    const results: OCRPageResult[] = [];
    
    // For now, treat the PDF as a single image
    // TODO: Implement proper PDF page splitting
    const base64 = await this.fileToBase64(pdfFile);
    const result = await this.extractTextFromImage(base64, options);
    results.push(result);
    
    return results;
  }

  // Parse OCR response from Alibaba Cloud
  private parseOCRResponse(
    response: AlibabaOCRResponse, 
    pageNumber: number,
    detectMultiTickets?: boolean
  ): OCRPageResult {
    const fields: OCRResult[] = [];
    let fullText = '';
    const tickets: TicketRegion[] = [];

    if (response.data?.prism_wordsInfo) {
      fullText = response.data.content || '';
      
      for (const wordInfo of response.data.prism_wordsInfo) {
        if (wordInfo.pos && wordInfo.pos.length >= 2) {
          const bbox = {
            x: Math.min(...wordInfo.pos.map(p => p.x)),
            y: Math.min(...wordInfo.pos.map(p => p.y)),
            width: Math.max(...wordInfo.pos.map(p => p.x)) - Math.min(...wordInfo.pos.map(p => p.x)),
            height: Math.max(...wordInfo.pos.map(p => p.y)) - Math.min(...wordInfo.pos.map(p => p.y)),
          };

          fields.push({
            text: wordInfo.word,
            confidence: wordInfo.confidence * 100, // Convert to percentage
            bbox,
          });
        }
      }
    }

    // Detect multiple tickets if enabled
    if (detectMultiTickets && fields.length > 0) {
      const detectedTickets = this.detectMultipleTickets(fields);
      tickets.push(...detectedTickets);
    }

    return {
      pageNumber,
      text: fullText,
      fields,
      tickets: tickets.length > 0 ? tickets : undefined,
    };
}

  // Detect multiple tickets on a single page
  private detectMultipleTickets(fields: OCRResult[]): TicketRegion[] {
    const tickets: TicketRegion[] = [];
    
    // Simple heuristic: group fields by vertical position
    // Invoices/tickets typically have clear vertical separation
    const yGroups = new Map<number, OCRResult[]>();
    
    for (const field of fields) {
      const yKey = Math.round(field.bbox.y / 100) * 100; // Group by 100px intervals
      if (!yGroups.has(yKey)) {
        yGroups.set(yKey, []);
      }
      yGroups.get(yKey)!.push(field);
    }
    
    // Create ticket regions from groups
    let ticketIndex = 0;
    for (const [_y, groupFields] of yGroups.entries()) {
      if (groupFields.length > 5) { // Minimum fields for a ticket
        const minX = Math.min(...groupFields.map(f => f.bbox.x));
        const minY = Math.min(...groupFields.map(f => f.bbox.y));
        const maxX = Math.max(...groupFields.map(f => f.bbox.x + f.bbox.width));
        const maxY = Math.max(...groupFields.map(f => f.bbox.y + f.bbox.height));
        
        tickets.push({
          ticketIndex,
          bbox: {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
          },
          fields: groupFields,
        });
        ticketIndex++;
      }
    }
    
    return tickets.length > 1 ? tickets : [];
  }

  // Match extracted fields with template fields using synonym mapping
  matchFieldsWithTemplate(
    ocrFields: OCRResult[],
    templateFields: Array<{ field_name: string; field_type: string; synonyms?: string | null }>,
    synonymMap: Map<string, string[]>
  ): Array<{ fieldName: string; fieldValue: string; confidence: number; matched: boolean }> {
    const results: Array<{ fieldName: string; fieldValue: string; confidence: number; matched: boolean }> = [];
    
    for (const templateField of templateFields) {
      const synonyms = templateField.synonyms ? JSON.parse(templateField.synonyms) as string[] : [];
      const allPossibleNames = [templateField.field_name, ...synonyms];
      
      // Add synonym mappings
      for (const name of allPossibleNames) {
        const mappedSynonyms = synonymMap.get(name);
        if (mappedSynonyms) {
          allPossibleNames.push(...mappedSynonyms);
        }
      }
      
      // Find best matching field
      let bestMatch: OCRResult | null = null;
      let bestScore = 0;
      
      for (const ocrField of ocrFields) {
        const score = this.calculateFieldMatchScore(ocrField.text, allPossibleNames);
        if (score > bestScore && score > 0.6) { // 60% similarity threshold
          bestScore = score;
          bestMatch = ocrField;
        }
      }
      
      if (bestMatch) {
        results.push({
          fieldName: templateField.field_name,
          fieldValue: bestMatch.text,
          confidence: bestMatch.confidence * bestScore,
          matched: true,
        });
      } else {
        results.push({
          fieldName: templateField.field_name,
          fieldValue: '',
          confidence: 0,
          matched: false,
        });
      }
    }
    
    return results;
  }

  // Calculate similarity score between text and field names
  private calculateFieldMatchScore(text: string, possibleNames: string[]): number {
    const normalizedText = text.toLowerCase().replace(/\s+/g, '');
    let maxScore = 0;
    
    for (const name of possibleNames) {
      const normalizedName = name.toLowerCase().replace(/\s+/g, '');
      
      // Exact match
      if (normalizedText === normalizedName) {
        return 1.0;
      }
      
      // Contains match
      if (normalizedText.includes(normalizedName) || normalizedName.includes(normalizedText)) {
        maxScore = Math.max(maxScore, 0.8);
      }
      
      // Calculate Levenshtein distance similarity
      const similarity = this.calculateSimilarity(normalizedText, normalizedName);
      maxScore = Math.max(maxScore, similarity);
    }
    
    return maxScore;
  }

  // Calculate string similarity using Levenshtein distance
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    
    return 1 - distance / maxLength;
  }
}

// Create OCR service instance
let ocrService: OCRService | null = null;

export function initializeOCRService(options: OCROptions): OCRService {
  ocrService = new OCRService(options);
  return ocrService;
}

export function getOCRService(): OCRService {
  if (!ocrService) {
    throw new Error('OCR service not initialized. Call initializeOCRService() first.');
  }
  return ocrService;
}

export function setConfidenceThreshold(threshold: number): void {
  if (ocrService) {
    ocrService.setConfidenceThreshold(threshold);
  }
}

export function getConfidenceThreshold(): number {
  return ocrService ? ocrService.getConfidenceThreshold() : DEFAULT_CONFIDENCE_THRESHOLD;
}
