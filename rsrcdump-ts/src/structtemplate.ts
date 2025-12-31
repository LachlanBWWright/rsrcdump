/**
 * Struct template parsing for custom resource formats
 */

import { Unpacker, Packer, calcsize } from './packutils.js';
import { Result, ok, err } from './result.js';
import { bytesToHex, hexToBytes, isRecord } from './buffer-utils.js';

export interface BacktickGroup {
  baseName: string;
  startIndex: number;
  count: number;
  fieldsPerItem: number;
}

export interface StructTemplate {
  format: string;
  recordLength: number;
  fieldFormats: string[];
  fieldNames: (string | null)[];
  isList: boolean;
  isScalar: boolean;
  backtickGroups: BacktickGroup[];
}

/**
 * Splits a struct format into individual field formats
 */
function splitStructFormatFields(fmt: string): string[] {
  const fields: string[] = [];
  let repeat = 0;

  for (const c of fmt) {
    // Ignore endianness markers and whitespace
    if (c === ' ' || c === '@' || c === '!' || c === '>' || c === '<' || c === '=') {
      continue;
    }

    // Parse repeat count
    if (/[0-9]/.test(c)) {
      if (repeat !== 0) {
        repeat *= 10;
      }
      repeat += parseInt(c, 10);
      continue;
    }

    // Handle field types
    if ('CB?HILFQDcbhilfdq'.toUpperCase().includes(c.toUpperCase()) || c === 'x') {
      for (let j = 0; j < Math.max(repeat, 1); j++) {
        fields.push(c);
      }
      repeat = 0;
    } else if (c === 's') {
      fields.push(`${Math.max(repeat, 1)}${c}`);
      repeat = 0;
    } else {
      throw new Error(`Unsupported struct format character '${c}'`);
    }
  }

  return fields;
}

/**
 * Creates a struct template from a template string
 */
export function structTemplateFromString(template: string): Result<StructTemplate, string> {
  const parts = template.split(':', 3);

  let formatStr = parts[0];
  if (!formatStr) {
    return err('Empty format string');
  }

  const fieldNames: string[] = parts[1] ? parts[1].split(',') : [];

  // Add endianness prefix if not present
  if (!formatStr.startsWith('!') && !formatStr.startsWith('>') && 
      !formatStr.startsWith('<') && !formatStr.startsWith('@') && 
      !formatStr.startsWith('=')) {
    formatStr = '>' + formatStr;
  }

  // Check for list suffix
  let isList = false;
  if (formatStr.endsWith('+')) {
    isList = true;
    formatStr = formatStr.slice(0, -1);
  }

  const fieldFormats = splitStructFormatFields(formatStr);
  const recordLength = calcsize(formatStr);

  // Expand field name macros and track backtick groups
  const expandedFieldNames: string[] = [];
  const backtickGroups: BacktickGroup[] = [];
  let currentFieldIndex = 0;
  
  for (const field of fieldNames) {
    if (!field) {
      expandedFieldNames.push('');
      currentFieldIndex++;
      continue;
    }

    // Multi-field macro
    if (field.endsWith(']')) {
      const indexPos = field.indexOf('[');
      if (indexPos === -1) {
        expandedFieldNames.push(field);
        currentFieldIndex++;
        continue;
      }

      const repeatCount = parseInt(field.slice(indexPos + 1, field.lastIndexOf(']')), 10);
      const baseName = field.slice(0, indexPos);
      const fieldValues = baseName.split('`');

      // Check if this is an array macro (single field or backtick macro)
      // Single field with repeat > 1: values[4] -> treat as array
      // Backtick with any repeat: x`y[1] or x`y[2] -> treat as array of objects
      const isBacktickMacro = baseName.includes('`');
      if (repeatCount > 1 || isBacktickMacro) {
        // Store the base name without backticks for single-field arrays
        const groupBaseName = fieldValues.length === 1 ? (fieldValues[0] || baseName) : baseName;
        backtickGroups.push({
          baseName: groupBaseName,
          startIndex: currentFieldIndex,
          count: repeatCount,
          fieldsPerItem: fieldValues.length
        });
      }

      for (let i = 0; i < repeatCount; i++) {
        for (const fv of fieldValues) {
          expandedFieldNames.push(`${fv}_${i}`);
          currentFieldIndex++;
        }
      }
    } else {
      expandedFieldNames.push(field);
      currentFieldIndex++;
    }
  }

  // Match field names to field formats
  const finalFieldNames: (string | null)[] = [];
  let userFieldIdx = 0;

  for (let fieldNumber = 0; fieldNumber < fieldFormats.length; fieldNumber++) {
    const fieldFormat = fieldFormats[fieldNumber];
    if (!fieldFormat) continue;

    if (fieldFormat === 'x') {
      // Skip padding bytes
      continue;
    }

    const fallback = `.field${fieldNumber}`;

    if (userFieldIdx < expandedFieldNames.length) {
      const name = expandedFieldNames[userFieldIdx];
      finalFieldNames.push(name || fallback);
      userFieldIdx++;
    } else {
      finalFieldNames.push(fallback);
    }
  }

  // Determine if scalar: single field and no user-provided names
  const isScalar = fieldFormats.length === 1 && fieldNames.length === 0;

  return ok({
    format: formatStr,
    recordLength,
    fieldFormats,
    fieldNames: isScalar ? [] : finalFieldNames,
    isList,
    isScalar,
    backtickGroups,
  });
}

/**
 * Unpacks a single record using a struct template
 */
export function unpackRecord(
  template: StructTemplate,
  data: Uint8Array,
  offset: number,
  options?: { useCamelCase?: boolean; useBacktickArrays?: boolean }
): Result<unknown, string> {
  try {
    const u = new Unpacker(data, offset);
    const values = u.unpack(template.format);
    const useBacktickArrays = options?.useBacktickArrays ?? true;
    return ok(tagValues(template, values, useBacktickArrays));
  } catch (e) {
    return err(`Failed to unpack record: ${e}`);
  }
}

/**
 * Tags values with field names, supporting backtick macro arrays
 */
function tagValues(template: StructTemplate, values: (number | Uint8Array | boolean)[], useBacktickArrays = true): unknown {
  // Check if we have any real user-provided field names (not just fallbacks)
  const hasRealFieldNames = template.fieldNames.length > 0 && 
    !template.fieldNames.every(name => !name || name.startsWith('.field'));

  if (hasRealFieldNames) {
    if (template.fieldNames.length !== values.length) {
      throw new Error(
        `Number of field names (${template.fieldNames.length}) does not match number of values (${values.length})`
      );
    }

    const record: Record<string, number | boolean | Uint8Array | string | unknown[]> = {};
    const usedIndices = new Set<number>();

    // Handle backtick groups as arrays if enabled
    if (useBacktickArrays && template.backtickGroups.length > 0) {
      for (const group of template.backtickGroups) {
        const arrayItems: unknown[] = [];

        for (let i = 0; i < group.count; i++) {
          const itemData: Record<string, number | boolean | Uint8Array | string> = {};
          
          for (let j = 0; j < group.fieldsPerItem; j++) {
            const valueIndex = group.startIndex + (i * group.fieldsPerItem) + j;
            const fieldName = template.fieldNames[valueIndex];
            const value = values[valueIndex];
            
            if (fieldName != null && value !== undefined) {
              // Extract base field name (remove _N suffix)
              const underscorePos = fieldName.lastIndexOf('_');
              const baseName = underscorePos > 0 ? fieldName.slice(0, underscorePos) : fieldName;
              
              if (value instanceof Uint8Array) {
                itemData[baseName] = bytesToHex(value);
              } else {
                itemData[baseName] = value;
              }
              usedIndices.add(valueIndex);
            }
          }
          
          // If single field per item, just push the value
          if (group.fieldsPerItem === 1 && Object.keys(itemData).length === 1) {
            arrayItems.push(Object.values(itemData)[0]);
          } else {
            arrayItems.push(itemData);
          }
        }
        
        record[group.baseName] = arrayItems;
      }
    }
    
    // Add remaining fields that aren't part of backtick groups
    for (let i = 0; i < template.fieldNames.length; i++) {
      if (usedIndices.has(i)) {
        continue;
      }
      
      const name = template.fieldNames[i];
      const value = values[i];
      if (name != null && value !== undefined) {
        // Convert byte strings to hex for JSON serialization
        if (value instanceof Uint8Array) {
          record[name] = bytesToHex(value);
        } else {
          record[name] = value;
        }
      }
    }
    return record;
  } else if (template.isScalar) {
    return values[0];
  } else {
    // Return array for unnamed multi-field records
    return values.map(v => v instanceof Uint8Array ? bytesToHex(v) : v);
  }
}

/**
 * Packs data using a struct template
 */
export function pack(template: StructTemplate, obj: unknown): Result<Uint8Array, string> {
  if (!template.isList) {
    return packRecord(template, obj);
  } else {
    if (!Array.isArray(obj)) {
      return err('Expected array for list template');
    }

    const buffers: Uint8Array[] = [];
    for (const item of obj) {
      const result = packRecord(template, item);
      if (!result.ok) {
        return result;
      }
      buffers.push(result.value);
    }

    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
      result.set(buf, offset);
      offset += buf.length;
    }

    return ok(result);
  }
}

/**
 * Packs a single record
 */
function packRecord(template: StructTemplate, jsonObj: unknown): Result<Uint8Array, string> {
  function processJsonField(fieldFormat: string, fieldValue: unknown): number | Uint8Array {
    if (fieldFormat.endsWith('s')) {
      // Convert hex string back to bytes
      if (typeof fieldValue === 'string') {
        return hexToBytes(fieldValue);
      }
      if (fieldValue instanceof Uint8Array) {
        return fieldValue;
      }
      throw new Error(`Expected string or Uint8Array for field format ${fieldFormat}`);
    } else if (fieldFormat === '?') {
      // Boolean format - convert to number for packing
      if (typeof fieldValue === 'boolean') {
        return fieldValue ? 1 : 0;
      }
      if (typeof fieldValue === 'number') {
        return fieldValue !== 0 ? 1 : 0;
      }
      throw new Error(`Expected boolean for field format ${fieldFormat}`);
    } else {
      if (typeof fieldValue === 'number') {
        return fieldValue;
      }
      if (typeof fieldValue === 'boolean') {
        return fieldValue ? 1 : 0;
      }
      throw new Error(`Expected number for field format ${fieldFormat}`);
    }
  }

  try {
    const packer = new Packer();
    
    if (template.isScalar) {
      if (Array.isArray(jsonObj) || (typeof jsonObj === 'object' && jsonObj !== null)) {
        return err(`json_obj must not be a list or dict ${jsonObj}`);
      }
      const firstFormat = template.fieldFormats[0];
      if (!firstFormat) {
        return err('Template has no field formats');
      }
      const value = processJsonField(firstFormat, jsonObj);
      return ok(packer.pack(template.format, value));
    }
    
    // Check if we have real user-provided field names
    const hasRealFieldNames = template.fieldNames.length > 0 && 
      !template.fieldNames.every(name => !name || name.startsWith('.field'));
    
    if (hasRealFieldNames) {
      if (!isRecord(jsonObj)) {
        return err('Expected object for named fields');
      }

      const obj = jsonObj;
      const values: (number | Uint8Array)[] = new Array(template.fieldFormats.length);
      const processedIndices = new Set<number>();

      // First, handle backtick arrays by expanding them back into individual fields
      if (template.backtickGroups.length > 0) {
        for (const group of template.backtickGroups) {
          const arrayData = obj[group.baseName];
          if (!Array.isArray(arrayData)) {
            // Backtick array not found in JSON, try reading individual fields
            continue;
          }

          for (let i = 0; i < group.count; i++) {
            const itemData = arrayData[i];
            
            for (let j = 0; j < group.fieldsPerItem; j++) {
              const valueIndex = group.startIndex + (i * group.fieldsPerItem) + j;
              const fieldFormat = template.fieldFormats[valueIndex];
              const fieldName = template.fieldNames[valueIndex];
              
              if (!fieldFormat || !fieldName) continue;
              
              // Extract base field name (remove _N suffix)
              const underscorePos = fieldName.lastIndexOf('_');
              const baseName = underscorePos > 0 ? fieldName.slice(0, underscorePos) : fieldName;
              
              let fieldValue: unknown;
              if (group.fieldsPerItem === 1) {
                // Single field per item, value is directly in array
                fieldValue = itemData;
              } else if (isRecord(itemData)) {
                // Multiple fields per item, value is in object
                fieldValue = itemData[baseName];
              } else {
                fieldValue = undefined;
              }
              
              if (fieldValue !== undefined) {
                values[valueIndex] = processJsonField(fieldFormat, fieldValue);
                processedIndices.add(valueIndex);
              }
            }
          }
        }
      }

      // Then process regular fields that aren't part of backtick groups
      for (let i = 0; i < template.fieldFormats.length; i++) {
        if (processedIndices.has(i)) continue;
        
        const fieldFormat = template.fieldFormats[i];
        const fieldName = template.fieldNames[i];
        if (!fieldFormat || !fieldName) continue;

        const value = obj[fieldName];
        values[i] = processJsonField(fieldFormat, value);
      }

      // Filter out undefined values (from 'x' padding fields)
      const filteredValues = values.filter(v => v !== undefined);
      return ok(packer.pack(template.format, ...filteredValues));
    } else {
      if (!Array.isArray(jsonObj)) {
        return err('Expected array for unnamed fields');
      }

      const values: (number | Uint8Array)[] = [];
      for (let i = 0; i < template.fieldFormats.length; i++) {
        const fieldFormat = template.fieldFormats[i];
        if (!fieldFormat) continue;
        values.push(processJsonField(fieldFormat, jsonObj[i]));
      }

      return ok(packer.pack(template.format, ...values));
    }
  } catch (e) {
    return err(`Failed to pack record: ${e}`);
  }
}

/**
 * Creates a struct template from a template string with typename
 */
export async function structTemplateFromStringWithTypename(
  templateArg: string
): Promise<Result<{ converter: StructTemplate; restype: Uint8Array }, string>> {
  const trimmed = templateArg.trim();
  if (!trimmed || trimmed.startsWith('//')) {
    return err('Empty or comment line');
  }

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx === -1) {
    return err('Template must have format: restype:format:fields');
  }

  const restypeStr = trimmed.slice(0, colonIdx);
  const formatStr = trimmed.slice(colonIdx + 1);

  if (!restypeStr || !formatStr) {
    return err('Invalid template format');
  }

  // Parse resource type
  const { parseTypeName } = await import('./textio.js');
  const restype = parseTypeName(restypeStr);

  const templateResult = structTemplateFromString(formatStr);
  if (!templateResult.ok) {
    return err(templateResult.error);
  }

  return ok({ converter: templateResult.value, restype });
}
