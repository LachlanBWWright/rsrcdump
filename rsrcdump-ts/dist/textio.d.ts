/**
 * Text encoding and resource type name utilities
 */
export declare function getGlobalEncoding(): string;
export declare function setGlobalEncoding(encoding: string): void;
/**
 * Sanitizes a resource type name for use in filenames/URLs
 */
export declare function sanitizeTypeName(restype: Uint8Array): string;
/**
 * Parses a sanitized type name back to bytes
 */
export declare function parseTypeName(saneName: string): Uint8Array;
/**
 * Sanitizes a resource name for use in filenames
 */
export declare function sanitizeResourceName(name: string | Uint8Array): string;
/**
 * Decodes bytes to string using the global encoding
 */
export declare function decode(bytes: Uint8Array, _errors?: 'replace' | 'ignore'): string;
/**
 * Encodes string to bytes using the global encoding
 */
export declare function encode(text: string, _errors?: 'replace' | 'ignore'): Uint8Array;
//# sourceMappingURL=textio.d.ts.map