import { Packer } from "./packutils.js";
import { hexToBytes, isRecord } from "./buffer-utils.js";
import { err, ok, type Result } from "./result.js";
import type { BacktickGroup, StructTemplate } from "./structtemplate.js";

type PackedValue = number | Uint8Array;

function processJsonField(fieldFormat: string, fieldValue: unknown): PackedValue {
  if (fieldFormat.endsWith('s')) {
    if (typeof fieldValue === 'string') return hexToBytes(fieldValue);
    if (fieldValue instanceof Uint8Array) return fieldValue;
    throw new Error(`Expected string or Uint8Array for field format ${fieldFormat}`);
  }
  if (fieldFormat === '?') {
    if (typeof fieldValue === 'boolean') return fieldValue ? 1 : 0;
    if (typeof fieldValue === 'number') return fieldValue !== 0 ? 1 : 0;
    throw new Error(`Expected boolean for field format ${fieldFormat}`);
  }
  if (typeof fieldValue === 'number') return fieldValue;
  if (typeof fieldValue === 'boolean') return fieldValue ? 1 : 0;
  throw new Error(`Expected number for field format ${fieldFormat}`);
}

function groupFieldValue(
  group: BacktickGroup,
  item: unknown,
  fieldName: string,
): unknown {
  if (group.fieldsPerItem === 1) return item;
  if (!isRecord(item)) return undefined;
  const underscore = fieldName.lastIndexOf('_');
  const baseName = underscore > 0 ? fieldName.slice(0, underscore) : fieldName;
  return item[baseName];
}

function addBacktickValues(
  template: StructTemplate,
  object: Record<string, unknown>,
  values: PackedValue[],
  processedIndices: Set<number>,
): void {
  for (const group of template.backtickGroups) {
    const array = object[group.baseName];
    if (!Array.isArray(array)) continue;

    for (let itemIndex = 0; itemIndex < group.count; itemIndex++) {
      for (let fieldIndex = 0; fieldIndex < group.fieldsPerItem; fieldIndex++) {
        const valueIndex = group.startIndex + itemIndex * group.fieldsPerItem + fieldIndex;
        const format = template.fieldFormats[valueIndex];
        const name = template.fieldNames[valueIndex];
        if (!format || !name) continue;

        const fieldValue = groupFieldValue(group, array[itemIndex], name);
        if (fieldValue === undefined) continue;
        values[valueIndex] = processJsonField(format, fieldValue);
        processedIndices.add(valueIndex);
      }
    }
  }
}

function packNamedRecord(
  packer: Packer,
  template: StructTemplate,
  object: Record<string, unknown>,
): Uint8Array {
  const values: PackedValue[] = new Array(template.fieldFormats.length);
  const processedIndices = new Set<number>();
  addBacktickValues(template, object, values, processedIndices);

  for (let index = 0; index < template.fieldFormats.length; index++) {
    if (processedIndices.has(index)) continue;
    const format = template.fieldFormats[index];
    const name = template.fieldNames[index];
    if (!format || !name) continue;
    values[index] = processJsonField(format, object[name]);
  }

  return packer.pack(template.format, ...values.filter((value) => value !== undefined));
}


/**
 * Packs data using a struct template
 */
export function pack(template: StructTemplate, obj: unknown): Result<Uint8Array, string> {
  if (!template.isList) return packRecord(template, obj);
  if (!Array.isArray(obj)) return err('Expected array for list template');

  const buffers: Uint8Array[] = [];
  for (const item of obj) {
    const result = packRecord(template, item);
    if (!result.ok) return result;
    buffers.push(result.value);
  }

  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }

  return ok(result);
}

/**
 * Packs a single record
 */
function packRecord(template: StructTemplate, jsonObj: unknown): Result<Uint8Array, string> {
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
      if (!isRecord(jsonObj)) return err('Expected object for named fields');
      return ok(packNamedRecord(packer, template, jsonObj));
    }

    if (!Array.isArray(jsonObj)) return err('Expected array for unnamed fields');
    const values = template.fieldFormats.flatMap((format, index) =>
      format ? [processJsonField(format, jsonObj[index])] : [],
    );
    return ok(packer.pack(template.format, ...values));
  } catch (e) {
    return err(`Failed to pack record: ${e}`);
  }
}
