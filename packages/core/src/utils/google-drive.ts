/**
 * Google Drive file download utility
 * Downloads files from Google Drive share links (file must be publicly shared)
 */

export interface GoogleDriveDownloadResult {
  buffer: ArrayBuffer;
  filename: string;
  contentType: string;
}

/**
 * Extract the file ID from a Google Drive share URL
 * Supports various URL formats:
 * - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 */
export function extractGoogleDriveFileId(url: string): string | null {
  // Pattern 1: /file/d/FILE_ID/
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // Pattern 2: ?id=FILE_ID or &id=FILE_ID
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Build a direct download URL from a Google Drive file ID
 */
export function buildGoogleDriveDownloadUrl(fileId: string): string {
  // Use the new drive.usercontent.google.com endpoint with confirm flag
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
}

/**
 * Download a file from a Google Drive share URL
 * The file must be publicly shared ("Anyone with the link")
 *
 * @param shareUrl - Google Drive share URL
 * @returns Download result with buffer, filename, and content type
 * @throws Error if file ID cannot be extracted or download fails
 */
export async function downloadGoogleDriveFile(shareUrl: string): Promise<GoogleDriveDownloadResult> {
  const fileId = extractGoogleDriveFileId(shareUrl);

  if (!fileId) {
    throw new Error('Invalid Google Drive URL: could not extract file ID');
  }

  const downloadUrl = buildGoogleDriveDownloadUrl(fileId);

  const response = await fetch(downloadUrl, {
    redirect: 'follow',
    headers: {
      // Pretend to be a browser to avoid some restrictions
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('File is not publicly shared. Please set sharing to "Anyone with the link"');
    }
    if (response.status === 404) {
      throw new Error('File not found. The file may have been deleted or the link is invalid');
    }
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  // Get content type
  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  // Check if we got an HTML page instead of the file (Google's warning page)
  if (contentType.includes('text/html')) {
    const text = await response.text();
    if (text.includes('Google Drive') && (text.includes('virus scan') || text.includes('confirm'))) {
      // Try alternative download approach
      return await downloadWithConfirmation(fileId);
    }
    throw new Error('File is not publicly accessible or requires sign-in');
  }

  // Get filename from Content-Disposition header or generate one
  const filename = extractFilenameFromHeaders(response.headers, fileId, contentType);

  const buffer = await response.arrayBuffer();

  return {
    buffer,
    filename,
    contentType,
  };
}

/**
 * Attempt download with confirmation for large files
 */
async function downloadWithConfirmation(fileId: string): Promise<GoogleDriveDownloadResult> {
  // Try the legacy endpoint with confirm parameter
  const legacyUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

  const response = await fetch(legacyUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed after retry: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';

  // If still HTML, the file is not accessible
  if (contentType.includes('text/html')) {
    throw new Error('File requires Google account sign-in or is not publicly shared');
  }

  const filename = extractFilenameFromHeaders(response.headers, fileId, contentType);
  const buffer = await response.arrayBuffer();

  return {
    buffer,
    filename,
    contentType,
  };
}

/**
 * Extract filename from response headers or generate a fallback
 */
function extractFilenameFromHeaders(headers: Headers, fileId: string, contentType: string): string {
  const disposition = headers.get('content-disposition');

  if (disposition) {
    // Try to extract filename from Content-Disposition
    // Format: attachment; filename="example.pdf" or filename*=UTF-8''example.pdf
    const filenameMatch = disposition.match(/filename[*]?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
    if (filenameMatch) {
      return decodeURIComponent(filenameMatch[1]);
    }
  }

  // Generate filename based on content type
  const extension = getExtensionFromContentType(contentType);
  return `drive-file-${fileId.substring(0, 8)}${extension}`;
}

/**
 * Get file extension from content type
 */
function getExtensionFromContentType(contentType: string): string {
  const type = contentType.split(';')[0].trim().toLowerCase();

  const extensionMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'text/plain': '.txt',
    'text/csv': '.csv',
  };

  return extensionMap[type] || '';
}

/**
 * Check if a URL is a valid Google Drive URL
 */
export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com\/(file\/d\/|open\?id=|uc\?id=)/.test(url);
}
