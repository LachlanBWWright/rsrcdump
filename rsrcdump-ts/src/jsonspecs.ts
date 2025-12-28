/**
 * JSON format for struct spec definitions
 */

import { Result, ok, err } from './result.js';

/**
 * JSON representation of a struct field
 */
export interface StructFieldJson {
  /** Field name (optional) */
  name?: string;
  /** Field type: 'byte', 'short', 'int', 'long', 'float', 'double', 'string', 'padding' */
  type: string;
  /** For strings: length in bytes; For padding: number of bytes; For others: repeat count */
  count?: number;
  /** Whether field is signed (for integers) */
  signed?: boolean;
}

/**
 * JSON representation of a struct spec
 */
export interface StructSpecJson {
  /** Resource type code (e.g., "Hedr", "Itms") */
  resourceType: string;
  /** Whether this is a list/array of records */
  isList?: boolean;
  /** Byte order: 'big' (default) or 'little' */
  endian?: 'big' | 'little';
  /** Fields in the struct */
  fields: StructFieldJson[];
}

/**
 * Maps JSON type names to struct format characters
 */
function jsonTypeToFormatChar(
  type: string,
  signed: boolean = false,
  count: number = 1
): Result<string, string> {
  const typeMap: Record<string, { signed: string; unsigned: string }> = {
    byte: { signed: 'b', unsigned: 'B' },
    short: { signed: 'h', unsigned: 'H' },
    int: { signed: 'i', unsigned: 'I' },
    long: { signed: 'l', unsigned: 'L' },
    quad: { signed: 'q', unsigned: 'Q' },
  };
  
  if (type === 'float') {
    return ok('f');
  }
  
  if (type === 'double') {
    return ok('d');
  }
  
  if (type === 'string') {
    return ok(`${count}s`);
  }
  
  if (type === 'padding') {
    return ok(`${count}x`);
  }
  
  const mapping = typeMap[type];
  if (mapping) {
    const formatChar = signed ? mapping.signed : mapping.unsigned;
    return ok(count > 1 ? `${count}${formatChar}` : formatChar);
  }
  
  return err(`Unknown type: ${type}`);
}

/**
 * Converts JSON struct spec to legacy string format
 */
export function jsonSpecToString(spec: StructSpecJson): Result<string, string> {
  const parts: string[] = [];
  
  // Endianness prefix
  const endianPrefix = spec.endian === 'little' ? '<' : '>';
  parts.push(endianPrefix);
  
  // Build format string
  const formatParts: string[] = [];
  const names: string[] = [];
  
  for (const field of spec.fields) {
    const formatResult = jsonTypeToFormatChar(
      field.type,
      field.signed,
      field.count || 1
    );
    
    if (!formatResult.ok) {
      return formatResult;
    }
    
    formatParts.push(formatResult.value);
    
    // Handle field names
    if (field.name) {
      if (field.count && field.count > 1 && field.type !== 'string' && field.type !== 'padding') {
        // Multi-field macro: fieldName[count]
        names.push(`${field.name}[${field.count}]`);
      } else {
        names.push(field.name);
      }
    } else {
      names.push('');
    }
  }
  
  const format = parts.join('') + formatParts.join('');
  
  // Add list suffix
  const finalFormat = spec.isList ? format + '+' : format;
  
  // Combine with field names
  const fieldNames = names.join(',');
  const result = fieldNames ? `${finalFormat}:${fieldNames}` : finalFormat;
  
  return ok(result);
}

/**
 * Converts multiple JSON specs to a map of string specs
 */
export function jsonSpecsToStrings(
  specs: StructSpecJson[]
): Result<Map<string, string>, string> {
  const result = new Map<string, string>();
  
  for (const spec of specs) {
    const stringResult = jsonSpecToString(spec);
    
    if (!stringResult.ok) {
      return err(`Failed to convert spec for ${spec.resourceType}: ${stringResult.error}`);
    }
    
    result.set(spec.resourceType, stringResult.value);
  }
  
  return ok(result);
}

/**
 * Loads struct specs from a JSON file
 */
export async function loadJsonSpecs(
  filePath: string
): Promise<Result<Map<string, string>, string>> {
  try {
    const fs = await import('fs/promises');
    const content = await fs.readFile(filePath, 'utf-8');
    const specs = JSON.parse(content) as StructSpecJson[];
    
    return jsonSpecsToStrings(specs);
  } catch (e) {
    return err(`Failed to load JSON specs: ${e}`);
  }
}
