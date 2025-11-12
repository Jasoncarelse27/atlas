// File Validation Utility
// Validates file uploads before processing (PDF, DOCX, TXT, MP3, MP4)

import { logger } from '../lib/logger';

interface FileValidationOptions {
  maxSizeMB?: number;
  allowedTypes?: string[];
}

/**
 * Supported file types and their MIME types
 */
export const SUPPORTED_FILE_TYPES = {
  // Documents
  pdf: ['application/pdf'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  doc: ['application/msword'],
  txt: ['text/plain'],
  // Audio
  mp3: ['audio/mpeg', 'audio/mp3'],
  mp4: ['audio/mp4', 'video/mp4'],
  // Additional audio formats
  wav: ['audio/wav', 'audio/wave'],
  ogg: ['audio/ogg'],
} as const;

/**
 * File size limits by type (in MB)
 */
export const FILE_SIZE_LIMITS = {
  document: 20, // PDF, DOCX, TXT - 20MB max
  audio: 50,    // MP3, MP4 - 50MB max
  video: 100,   // Video files - 100MB max
} as const;

/**
 * Get file category based on MIME type
 */
function getFileCategory(mimeType: string): 'document' | 'audio' | 'video' | 'unknown' {
  if (mimeType.startsWith('text/') || 
      mimeType.includes('pdf') || 
      mimeType.includes('wordprocessingml') ||
      mimeType.includes('msword')) {
    return 'document';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  return 'unknown';
}

/**
 * Check if file extension matches MIME type
 */
function validateFileExtension(fileName: string, mimeType: string): boolean {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  // Map extensions to expected MIME types
  const extensionMap: Record<string, string[]> = {
    pdf: ['application/pdf'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    doc: ['application/msword'],
    txt: ['text/plain'],
    mp3: ['audio/mpeg', 'audio/mp3'],
    mp4: ['audio/mp4', 'video/mp4'],
    wav: ['audio/wav', 'audio/wave'],
    ogg: ['audio/ogg'],
  };
  
  const expectedTypes = extensionMap[extension];
  if (!expectedTypes) return false;
  
  return expectedTypes.some(type => mimeType.includes(type.split('/')[1]) || mimeType === type);
}

/**
 * Validate file before upload
 * 
 * @param file - File to validate
 * @param options - Validation options
 * @returns Validation result with error message if invalid
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions = {}
): Promise<{ valid: boolean; error?: string }> {
  const {
    maxSizeMB,
    allowedTypes = ['pdf', 'docx', 'txt', 'mp3', 'mp4'],
  } = options;

  // Check file name
  if (!file.name || file.name.trim().length === 0) {
    return { valid: false, error: 'File name is required.' };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  const category = getFileCategory(file.type);
  
  // Determine size limit
  let sizeLimitMB: number;
  if (maxSizeMB) {
    sizeLimitMB = maxSizeMB;
  } else {
    switch (category) {
      case 'document':
        sizeLimitMB = FILE_SIZE_LIMITS.document;
        break;
      case 'audio':
        sizeLimitMB = FILE_SIZE_LIMITS.audio;
        break;
      case 'video':
        sizeLimitMB = FILE_SIZE_LIMITS.video;
        break;
      default:
        sizeLimitMB = 20; // Default 20MB
    }
  }

  if (fileSizeMB > sizeLimitMB) {
    return { 
      valid: false, 
      error: `File too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${sizeLimitMB}MB.` 
    };
  }

  // Check minimum size (prevent empty files)
  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' };
  }

  // Check file type
  const fileExtension = file.name.toLowerCase().split('.').pop() || '';
  const isValidExtension = allowedTypes.some(type => 
    fileExtension === type || 
    (type === 'docx' && fileExtension === 'doc')
  );

  if (!isValidExtension) {
    return { 
      valid: false, 
      error: `Unsupported file type. Supported formats: ${allowedTypes.join(', ').toUpperCase()}.` 
    };
  }

  // Validate MIME type matches extension
  if (file.type && !validateFileExtension(file.name, file.type)) {
    logger.warn(`[FileValidation] MIME type mismatch: ${file.type} for ${file.name}`);
    // Don't fail validation, but log warning
  }

  // Additional validation for specific file types
  if (fileExtension === 'pdf') {
    // Check if PDF starts with PDF header
    const arrayBuffer = await file.slice(0, 4).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const pdfHeader = String.fromCharCode(...uint8Array);
    if (pdfHeader !== '%PDF') {
      return { valid: false, error: 'Invalid PDF file. File may be corrupted.' };
    }
  }

  // Check for suspicious file names (e.g., executable extensions)
  const dangerousExtensions = ['.exe', '.bat', '.sh', '.js', '.jar', '.dmg', '.pkg'];
  const hasDangerousExtension = dangerousExtensions.some(ext => 
    file.name.toLowerCase().endsWith(ext)
  );
  
  if (hasDangerousExtension) {
    return { 
      valid: false, 
      error: 'Executable files are not allowed. Please upload documents or media files only.' 
    };
  }

  return { valid: true };
}

/**
 * Get file type category for display
 */
export function getFileTypeCategory(file: File): 'document' | 'audio' | 'video' | 'image' | 'unknown' {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.toLowerCase().split('.').pop() || '';
  
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(extension)) return 'audio';
  if (mimeType.startsWith('video/') || extension === 'mp4') return 'video';
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text') || 
      ['pdf', 'docx', 'doc', 'txt'].includes(extension)) return 'document';
  
  return 'unknown';
}

/**
 * Get human-readable file type name
 */
export function getFileTypeName(file: File): string {
  const extension = file.name.toLowerCase().split('.').pop() || '';
  
  const typeMap: Record<string, string> = {
    pdf: 'PDF Document',
    docx: 'Word Document',
    doc: 'Word Document',
    txt: 'Text File',
    mp3: 'MP3 Audio',
    mp4: 'MP4 Audio/Video',
    wav: 'WAV Audio',
    ogg: 'OGG Audio',
  };
  
  return typeMap[extension] || 'File';
}

