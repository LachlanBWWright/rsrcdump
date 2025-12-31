/**
 * Browser-compatible buffer utilities to replace Node.js Buffer usage.
 * These functions provide cross-platform encoding/decoding without depending on the Buffer API.
 */

/**
 * Type guard: asserts value is a number from unpack result
 */
export function asNumber(value: number | Uint8Array | boolean | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error(`Expected number but got ${typeof value}`);
}

/**
 * Type guard: asserts value is a Uint8Array from unpack result
 */
export function asUint8Array(value: number | Uint8Array | boolean | undefined): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  throw new Error(`Expected Uint8Array but got ${typeof value}`);
}

/**
 * Type guard: asserts value is a boolean from unpack result  
 */
export function asBoolean(value: number | Uint8Array | boolean | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  throw new Error(`Expected boolean but got ${typeof value}`);
}

/**
 * Type guard for pack values: asserts value is a Uint8Array
 */
export function asPackUint8Array(value: number | Uint8Array | bigint | undefined): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  throw new Error(`Expected Uint8Array but got ${typeof value}`);
}

/**
 * Type guard for pack values: asserts value is a number
 */
export function asPackNumber(value: number | Uint8Array | bigint | undefined): number {
  if (typeof value === 'number') {
    return value;
  }
  throw new Error(`Expected number but got ${typeof value}`);
}

/**
 * Type guard for pack values: asserts value is a number or bigint, returns as number or bigint
 */
export function asPackNumberOrBigint(value: number | Uint8Array | bigint | undefined): number | bigint {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return value;
  }
  throw new Error(`Expected number or bigint but got ${typeof value}`);
}

/**
 * Type guard: checks if value is a record (plain object)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard: checks if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard: checks if value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Type guard: checks if value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Convert bytes to hex string
 */
export function bytesToHex(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert bytes to binary string (latin1 mapping)
 * This creates a string where each character's code point equals the byte value (0-255)
 */
export function bytesToBinary(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return String.fromCharCode(...bytes);
}

/**
 * Convert binary string (latin1) to Uint8Array
 * Reverses bytesToBinary by taking character codes
 */
export function binaryToBytes(str: string): Uint8Array {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode bytes as latin1 (ISO-8859-1)
 */
export function latin1Decode(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return String.fromCharCode(...bytes);
}

/**
 * Encode string as latin1 (ISO-8859-1)
 */
export function latin1Encode(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i] = code > 255 ? 0x3f : code; // Replace out-of-range with '?'
  }
  return bytes;
}

/**
 * Allocate a new Uint8Array with optional fill value
 */
export function allocate(size: number, fill?: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (fill !== undefined) {
    bytes.fill(fill);
  }
  return bytes;
}

/**
 * Decode bytes using the specified encoding
 */
export function decode(data: Uint8Array | ArrayBuffer, encoding: string): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

  switch (encoding.toLowerCase()) {
    case "hex":
      return bytesToHex(bytes);
    case "binary":
      return bytesToBinary(bytes);
    case "latin1":
    case "iso-8859-1":
      return latin1Decode(bytes);
    case "utf8":
    case "utf-8":
      return new TextDecoder("utf-8").decode(bytes);
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}

/**
 * Encode string using the specified encoding
 */
export function encode(text: string, encoding: string): Uint8Array {
  switch (encoding.toLowerCase()) {
    case "hex":
      return hexToBytes(text);
    case "binary":
      return binaryToBytes(text);
    case "latin1":
    case "iso-8859-1":
      return latin1Encode(text);
    case "utf8":
    case "utf-8":
      return new TextEncoder().encode(text);
    default:
      throw new Error(`Unsupported encoding: ${encoding}`);
  }
}
