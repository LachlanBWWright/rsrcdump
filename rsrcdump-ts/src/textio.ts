/**
 * Text encoding and resource type name utilities
 */

let GLOBAL_ENCODING = 'macroman';

export function getGlobalEncoding(): string {
  return GLOBAL_ENCODING;
}

export function setGlobalEncoding(encoding: string): void {
  GLOBAL_ENCODING = encoding;
}

/**
 * Sanitizes a resource type name for use in filenames/URLs
 */
export function sanitizeTypeName(restype: Uint8Array): string {
  if (restype.length !== 4) {
    throw new Error(`restype isn't 4 bytes`);
  }
  
  let trimmed = restype;
  if (!isAllSpaces(restype)) {
    // Remove trailing spaces
    let end = 4;
    while (end > 0 && trimmed[end - 1] === 0x20) {
      end--;
    }
    trimmed = restype.slice(0, end);
  }
  
  return encodeURIComponent(Buffer.from(trimmed).toString('binary'));
}

function isAllSpaces(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] !== 0x20) {
      return false;
    }
  }
  return true;
}

/**
 * Parses a sanitized type name back to bytes
 */
export function parseTypeName(saneName: string): Uint8Array {
  const decoded = decodeURIComponent(saneName);
  const bytes = Buffer.from(decoded, 'binary');
  
  // Pad to 4 bytes with spaces
  const padded = Buffer.alloc(4, 0x20);
  bytes.copy(padded, 0, 0, Math.min(bytes.length, 4));
  
  if (bytes.length > 4) {
    throw new Error(`decoded restype doesn't work out to 4 bytes`);
  }
  
  return new Uint8Array(padded);
}

/**
 * Sanitizes a resource name for use in filenames
 */
export function sanitizeResourceName(name: string | Uint8Array): string {
  const str = typeof name === 'string' ? name : Buffer.from(name).toString();
  let sanitized = '';
  
  for (const c of str) {
    if (/[A-Za-z0-9_-]/.test(c)) {
      sanitized += c;
    }
  }
  
  return sanitized;
}

/**
 * Decodes bytes to string using the global encoding
 */
export function decode(bytes: Uint8Array, _errors: 'replace' | 'ignore' = 'replace'): string {
  // For macroman, we use a simple approximation with latin1
  // A full macroman decoder would be more complex
  if (GLOBAL_ENCODING === 'macroman') {
    return Buffer.from(bytes).toString('latin1');
  }
  return Buffer.from(bytes).toString(GLOBAL_ENCODING as BufferEncoding);
}

/**
 * Encodes string to bytes using the global encoding
 */
export function encode(text: string, _errors: 'replace' | 'ignore' = 'replace'): Uint8Array {
  if (GLOBAL_ENCODING === 'macroman') {
    return new Uint8Array(Buffer.from(text, 'latin1'));
  }
  return new Uint8Array(Buffer.from(text, GLOBAL_ENCODING as BufferEncoding));
}
