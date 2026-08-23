/**
 * Struct template parsing for custom resource formats
 */

import { calcsize } from './packutils.js';
import { Result, ok, err } from './result.js';

export { unpackRecord } from "./structtemplate-unpack.js";
export { pack } from "./structtemplate-pack.js";

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
