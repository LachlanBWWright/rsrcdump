/**
 * Text encoding and resource type name utilities
 */

import { bytesToBinary, binaryToBytes, latin1Decode, latin1Encode, allocate, decode as bufDecode, encode as bufEncode } from './buffer-utils.js';

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
  
  return encodeURIComponent(bytesToBinary(trimmed));
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
  const bytes = binaryToBytes(decoded);

  // Pad to 4 bytes with spaces
  const padded = allocate(4, 0x20);
  padded.set(bytes.slice(0, Math.min(bytes.length, 4)), 0);

  if (bytes.length > 4) {
    throw new Error(`decoded restype doesn't work out to 4 bytes`);
  }

  return padded;
}

/**
 * Sanitizes a resource name for use in filenames
 */
export function sanitizeResourceName(name: string | Uint8Array): string {
  const str = typeof name === 'string' ? name : latin1Decode(name);
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
    return latin1Decode(bytes);
  }
  return bufDecode(bytes, GLOBAL_ENCODING);
}

/**
 * Encodes string to bytes using the global encoding
 */
export function encode(text: string, _errors: 'replace' | 'ignore' = 'replace'): Uint8Array {
  if (GLOBAL_ENCODING === 'macroman') {
    return latin1Encode(text);
  }
  return bufEncode(text, GLOBAL_ENCODING);
}
