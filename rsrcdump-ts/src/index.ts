/**
 * rsrcdump-ts public API
 * TypeScript port of rsrcdump with Result/Err error handling
 */

import type { ResourceFork } from "./resfork.js";
import { resourceForkFromBytes, packResourceFork } from "./resfork.js";
import { unpackAdf, packAdf, ADF_ENTRYNUM_RESOURCEFORK } from "./adf.js";
import { resourceForkToJsonString, jsonToResourceFork, type JsonOptions, type JsonBlob } from "./jsonio.js";
import { getConverters, getConvertersSync } from "./converter-factory.js";
import { isRecord, isNumber } from "./buffer-utils.js";
import { parseTypeName } from "./textio.js";
import type { Result } from "./result.js";
import { ok, isOk, err } from "./result.js";

function isJsonBlob(value: unknown): value is JsonBlob {
  if (!isRecord(value)) return false;
  const metadata = value._metadata;
  if (!isRecord(metadata)) return false;
  return isNumber(metadata.junk1) && isNumber(metadata.junk2) && isNumber(metadata.file_attributes);
}

export type { Ok, Err, Result } from "./result.js";
export { ok, err, isOk, isErr, unwrap, map, andThen } from "./result.js";

export type { Resource, ResourceFork, ResType } from "./resfork.js";
export {
  resourceForkFromBytes,
  packResourceFork,
  createResource,
  createResourceFork,
  resourceDesc,
  resourceTypeStr,
  resourceNameStr,
  orderedFlatList,
  getResourceType,
  resourceForkToString,
} from "./resfork.js";

export {
  unpackAdf,
  packAdf,
  ADF_MAGIC,
  ADF_VERSION,
  ADF_ENTRYNUM_RESOURCEFORK,
} from "./adf.js";

export { resourceForkToJsonString, jsonToResourceFork } from "./jsonio.js";

export type { ResourceConverter } from "./resconverters.js";
export {
  getStandardConverters,
  Base16Converter,
  StructConverter,
  SingleStringConverter,
  StringListConverter,
  TextConverter,
} from "./resconverters.js";

export type { StructTemplate } from "./structtemplate.js";
export {
  structTemplateFromString,
  structTemplateFromStringWithTypename,
  unpackRecord,
  pack as packStruct,
} from "./structtemplate.js";

export {
  getGlobalEncoding,
  setGlobalEncoding,
  sanitizeTypeName,
  parseTypeName,
  sanitizeResourceName,
  decode,
  encode,
} from "./textio.js";

// TypeScript type generation
export {
  generateTypesFromSpecs,
  generateTypeFromTemplate,
} from "./typegen.js";

// JSON struct specs
export type { StructSpecJson, StructFieldJson } from "./jsonspecs.js";
export {
  jsonSpecToString,
  jsonSpecsToStrings,
  parseJsonSpecs,
} from "./jsonspecs.js";

// JSON options
export type { JsonOptions } from "./jsonio.js";

/**
 * Loads a resource fork from bytes
 * For browser compatibility, this function only accepts Uint8Array.
 * Use your own file reading mechanism to load data first.
 */
export function load(
  data: Uint8Array,
): Result<ResourceFork, string> {
  // Try to unpack as ADF first
  const adfResult = unpackAdf(data);
  if (isOk(adfResult)) {
    const entries = adfResult.value;
    const resforkData = entries.get(ADF_ENTRYNUM_RESOURCEFORK);
    if (resforkData) {
      return resourceForkFromBytes(resforkData);
    }
  }

  // Fall back to raw resource fork
  return resourceForkFromBytes(data);
}

/**
 * Converts a resource fork to JSON string
 */
export async function saveToJson(
  data: Uint8Array,
  structSpecs: string[] = [],
  includeTypes: string[] = [],
  excludeTypes: string[] = [],
  options?: JsonOptions,
): Promise<Result<string, string>> {
  const loadResult = load(data);
  if (!loadResult.ok) {
    return loadResult;
  }

  const fork = loadResult.value;
  const converters = await getConverters(structSpecs);

  const includeTypeBytes = includeTypes.map((t) => parseTypeName(t));
  const excludeTypeBytes = excludeTypes.map((t) => parseTypeName(t));

  return resourceForkToJsonString(
    fork,
    includeTypeBytes,
    excludeTypeBytes,
    converters,
    {},
    options,
  );
}

/**
 * Loads bytes from JSON (async version with struct specs support)
 */
export async function loadBytesFromJsonAsync(
  jsonBlob: unknown,
  structSpecs: string[] = [],
  onlyTypes: string[] = [],
  skipTypes: string[] = [],
  adf = true,
): Promise<Result<Uint8Array, string>> {
  if (!isJsonBlob(jsonBlob)) {
    return err("Invalid JSON blob: missing or invalid _metadata");
  }

  const converters = await getConverters(structSpecs);

  const onlyTypeBytes = onlyTypes.map((t) => parseTypeName(t));
  const skipTypeBytes = skipTypes.map((t) => parseTypeName(t));

  const forkResult = jsonToResourceFork(
    jsonBlob,
    converters,
    onlyTypeBytes,
    skipTypeBytes,
  );

  if (!forkResult.ok) {
    return forkResult;
  }

  const fork = forkResult.value;
  const packResult = packResourceFork(fork);

  if (!packResult.ok) {
    return packResult;
  }

  const binaryFork = packResult.value;

  if (adf) {
    const adfEntries = new Map<number, Uint8Array>();
    adfEntries.set(ADF_ENTRYNUM_RESOURCEFORK, binaryFork);
    return packAdf(adfEntries);
  }

  return ok(binaryFork);
}

/**
 * Loads bytes from JSON (sync version, no struct specs)
 */
export function loadBytesFromJson(
  jsonBlob: unknown,
  structSpecs: string[] = [],
  onlyTypes: string[] = [],
  skipTypes: string[] = [],
  adf = true,
): Result<Uint8Array, string> {
  if (!isJsonBlob(jsonBlob)) {
    return err("Invalid JSON blob: missing or invalid _metadata");
  }

  const converters = getConvertersSync(structSpecs);

  const onlyTypeBytes = onlyTypes.map((t) => parseTypeName(t));
  const skipTypeBytes = skipTypes.map((t) => parseTypeName(t));

  const forkResult = jsonToResourceFork(
    jsonBlob,
    converters,
    onlyTypeBytes,
    skipTypeBytes,
  );

  if (!forkResult.ok) {
    return forkResult;
  }

  const fork = forkResult.value;
  const packResult = packResourceFork(fork);

  if (!packResult.ok) {
    return packResult;
  }

  const binaryFork = packResult.value;

  if (adf) {
    const adfEntries = new Map<number, Uint8Array>();
    adfEntries.set(ADF_ENTRYNUM_RESOURCEFORK, binaryFork);
    return packAdf(adfEntries);
  }

  return ok(binaryFork);
}
