import { Unpacker } from "./packutils.js";
import { bytesToHex } from "./buffer-utils.js";
import { err, ok, type Result } from "./result.js";
import type { BacktickGroup, StructTemplate } from "./structtemplate.js";

type TaggedValue = number | boolean | Uint8Array;
type TaggedRecord = Record<string, TaggedValue | string | unknown[]>;

function jsonValue(value: TaggedValue): number | boolean | string {
  return value instanceof Uint8Array ? bytesToHex(value) : value;
}

function groupItem(
  template: StructTemplate,
  values: TaggedValue[],
  group: BacktickGroup,
  itemIndex: number,
  usedIndices: Set<number>,
): unknown {
  const item: Record<string, number | boolean | string> = {};

  for (let fieldIndex = 0; fieldIndex < group.fieldsPerItem; fieldIndex++) {
    const valueIndex = group.startIndex + itemIndex * group.fieldsPerItem + fieldIndex;
    const fieldName = template.fieldNames[valueIndex];
    const value = values[valueIndex];
    if (fieldName == null || value === undefined) continue;

    const underscore = fieldName.lastIndexOf("_");
    const baseName = underscore > 0 ? fieldName.slice(0, underscore) : fieldName;
    item[baseName] = jsonValue(value);
    usedIndices.add(valueIndex);
  }

  if (group.fieldsPerItem === 1 && Object.keys(item).length === 1) {
    return Object.values(item)[0];
  }
  return item;
}

function addBacktickGroups(
  record: TaggedRecord,
  template: StructTemplate,
  values: TaggedValue[],
  usedIndices: Set<number>,
): void {
  for (const group of template.backtickGroups) {
    const items: unknown[] = [];
    for (let itemIndex = 0; itemIndex < group.count; itemIndex++) {
      items.push(groupItem(template, values, group, itemIndex, usedIndices));
    }
    record[group.baseName] = items;
  }
}

function addRegularFields(
  record: TaggedRecord,
  template: StructTemplate,
  values: TaggedValue[],
  usedIndices: Set<number>,
): void {
  for (let index = 0; index < template.fieldNames.length; index++) {
    if (usedIndices.has(index)) continue;
    const name = template.fieldNames[index];
    const value = values[index];
    if (name == null || value === undefined) continue;
    record[name] = jsonValue(value);
  }
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
function tagValues(template: StructTemplate, values: TaggedValue[], useBacktickArrays = true): unknown {
  const hasRealFieldNames = template.fieldNames.length > 0 && 
    !template.fieldNames.every(name => !name || name.startsWith('.field'));
  if (!hasRealFieldNames) {
    return template.isScalar ? values[0] : values.map(jsonValue);
  }
  if (template.fieldNames.length !== values.length) {
    throw new Error(
      `Number of field names (${template.fieldNames.length}) does not match number of values (${values.length})`,
    );
  }

  const record: TaggedRecord = {};
  const usedIndices = new Set<number>();
  if (useBacktickArrays) {
    addBacktickGroups(record, template, values, usedIndices);
  }
  addRegularFields(record, template, values, usedIndices);
  return record;
}
