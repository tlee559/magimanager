/**
 * CSV Parser for Identity Profile batch import
 */

export interface CSVIdentityRow {
  fullName: string;
  dob: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  geo: string;
  website?: string;
  documentUrl?: string;
}

export interface CSVValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ParsedCSVResult {
  rows: CSVIdentityRow[];
  errors: { row: number; message: string }[];
}

const REQUIRED_COLUMNS = ['fullName', 'dob', 'address', 'city', 'state', 'zipcode', 'geo'] as const;

/**
 * Parse CSV content into identity rows
 */
export function parseIdentityCSV(csvContent: string): ParsedCSVResult {
  const lines = csvContent.trim().split(/\r?\n/);

  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: 'CSV must have a header row and at least one data row' }] };
  }

  // Parse header row
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

  // Map headers to expected column names
  const columnMap = mapHeaders(headers);

  // Check for missing required columns
  const missingColumns = REQUIRED_COLUMNS.filter(col => columnMap[col] === undefined);
  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [{ row: 0, message: `Missing required columns: ${missingColumns.join(', ')}` }]
    };
  }

  const rows: CSVIdentityRow[] = [];
  const errors: { row: number; message: string }[] = [];

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    const values = parseCSVLine(line);

    try {
      const row: CSVIdentityRow = {
        fullName: values[columnMap.fullName]?.trim() || '',
        dob: values[columnMap.dob]?.trim() || '',
        address: values[columnMap.address]?.trim() || '',
        city: values[columnMap.city]?.trim() || '',
        state: values[columnMap.state]?.trim() || '',
        zipcode: values[columnMap.zipcode]?.trim() || '',
        geo: values[columnMap.geo]?.trim() || '',
        website: columnMap.website !== undefined ? values[columnMap.website]?.trim() || undefined : undefined,
        documentUrl: columnMap.documentUrl !== undefined ? values[columnMap.documentUrl]?.trim() || undefined : undefined,
      };

      const validation = validateCSVRow(row);
      if (validation.valid) {
        rows.push(row);
      } else {
        errors.push({ row: i + 1, message: validation.errors.join('; ') });
      }
    } catch (e) {
      errors.push({ row: i + 1, message: `Failed to parse row: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
  }

  return { rows, errors };
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
      } else if (char === ',') {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }

  // Don't forget the last field
  result.push(current);

  return result;
}

/**
 * Map header names to column indices (case-insensitive, flexible naming)
 */
function mapHeaders(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};

  headers.forEach((header, index) => {
    const h = header.toLowerCase().replace(/[_\s-]/g, '');

    // Map various header names to standard column names
    if (h === 'fullname' || h === 'name') {
      map.fullName = index;
    } else if (h === 'dob' || h === 'dateofbirth' || h === 'birthdate' || h === 'birthday') {
      map.dob = index;
    } else if (h === 'address' || h === 'streetaddress' || h === 'street') {
      map.address = index;
    } else if (h === 'city') {
      map.city = index;
    } else if (h === 'state') {
      map.state = index;
    } else if (h === 'zipcode' || h === 'zip' || h === 'postalcode') {
      map.zipcode = index;
    } else if (h === 'geo' || h === 'country' || h === 'region') {
      map.geo = index;
    } else if (h === 'website' || h === 'url' || h === 'site') {
      map.website = index;
    } else if (h === 'documenturl' || h === 'docurl' || h === 'document' || h === 'drivelink' || h === 'googledrivelink') {
      map.documentUrl = index;
    }
  });

  return map;
}

/**
 * Validate a single CSV row
 */
export function validateCSVRow(row: CSVIdentityRow): CSVValidationResult {
  const errors: string[] = [];

  // Check required fields
  if (!row.fullName) errors.push('fullName is required');
  if (!row.dob) errors.push('dob is required');
  if (!row.address) errors.push('address is required');
  if (!row.city) errors.push('city is required');
  if (!row.state) errors.push('state is required');
  if (!row.zipcode) errors.push('zipcode is required');
  if (!row.geo) errors.push('geo is required');

  // Validate date format
  if (row.dob && !isValidDate(row.dob)) {
    errors.push('dob must be a valid date (YYYY-MM-DD or MM/DD/YYYY)');
  }

  // Validate state (2-letter code)
  if (row.state && row.state.length !== 2) {
    errors.push('state must be a 2-letter code');
  }

  // Validate document URL if provided
  if (row.documentUrl && !isValidGoogleDriveUrl(row.documentUrl)) {
    errors.push('documentUrl must be a valid Google Drive share link');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string is a valid date
 */
function isValidDate(dateStr: string): boolean {
  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const date = new Date(dateStr + 'T00:00:00');
    return !isNaN(date.getTime());
  }

  // Try MM/DD/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return !isNaN(date.getTime()) && date.getMonth() === month - 1;
  }

  return false;
}

/**
 * Check if a URL is a valid Google Drive share link
 */
function isValidGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)/.test(url);
}

/**
 * Normalize date string to YYYY-MM-DD format
 */
export function normalizeDateString(dateStr: string): string {
  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert MM/DD/YYYY to YYYY-MM-DD
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [month, day, year] = dateStr.split('/').map(Number);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return dateStr;
}
