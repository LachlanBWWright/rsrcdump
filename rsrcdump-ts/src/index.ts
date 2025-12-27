/**
 * rsrcdump-ts public API
 * TypeScript port of rsrcdump with Result/Err error handling
 */

import { readFile } from "fs/promises";
import type { ResourceFork } from "./resfork.js";
import { resourceForkFromBytes, packResourceFork } from "./resfork.js";
import { unpackAdf, packAdf, ADF_ENTRYNUM_RESOURCEFORK } from "./adf.js";
import { resourceForkToJsonString, jsonToResourceFork } from "./jsonio.js";
import { getStandardConverters, StructConverter } from "./resconverters.js";
import {
  structTemplateFromString,
  structTemplateFromStringWithTypename,
} from "./structtemplate.js";
import { parseTypeName } from "./textio.js";
import type { Result } from "./result.js";
import { ok, err, isOk } from "./result.js";

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

/**
 * Loads a resource fork from a file path or bytes
 */
export async function load(
  pathOrData: string | Uint8Array,
): Promise<Result<ResourceFork, string>> {
  let data: Uint8Array;

  if (typeof pathOrData === "string") {
    try {
      const buffer = await readFile(pathOrData);
      data = new Uint8Array(buffer);
    } catch (e) {
      return err(`Failed to read file: ${e}`);
    }
  } else {
    data = pathOrData;
  }

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
 * Saves a resource fork to JSON
 */
export async function saveToJson(
  data: Uint8Array,
  structSpecs: string[] = [],
  includeTypes: string[] = [],
  excludeTypes: string[] = [],
): Promise<Result<string, string>> {
  const loadResult = await load(data);
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
  adf: boolean = true,
): Promise<Result<Uint8Array, string>> {
  const converters = await getConverters(structSpecs);

  const onlyTypeBytes = onlyTypes.map((t) => parseTypeName(t));
  const skipTypeBytes = skipTypes.map((t) => parseTypeName(t));

  const forkResult = jsonToResourceFork(
    jsonBlob as any,
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
  adf: boolean = true,
): Result<Uint8Array, string> {
  const converters = getConvertersSync(structSpecs);

  const onlyTypeBytes = onlyTypes.map((t) => parseTypeName(t));
  const skipTypeBytes = skipTypes.map((t) => parseTypeName(t));

  const forkResult = jsonToResourceFork(
    jsonBlob as any,
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
 * Gets converters with custom struct specs
 */
async function getConverters(structSpecs: string[]): Promise<Map<string, any>> {
  const converters = getStandardConverters();

  for (const templateArg of structSpecs) {
    const result = await structTemplateFromStringWithTypename(templateArg);
    if (isOk(result)) {
      const { converter, restype } = result.value;
      const typeKey = Buffer.from(restype).toString("binary");
      converters.set(typeKey, new StructConverter(converter));
    }
  }

  return converters;
}

/**
 * Gets converters synchronously
 */
function getConvertersSync(structSpecs: string[]): Map<string, any> {
  const converters = getStandardConverters();

  for (const templateArg of structSpecs) {
    try {
      const trimmed = templateArg.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;

      const colonIdx = trimmed.indexOf(":");
      if (colonIdx === -1) continue;

      const restypeStr = trimmed.slice(0, colonIdx);
      const formatStr = trimmed.slice(colonIdx + 1);
      if (!restypeStr || !formatStr) continue;

      const restype = parseTypeName(restypeStr);
      const templateResult = structTemplateFromString(formatStr);
      if (!templateResult.ok) {
        // Skip invalid templates
        // eslint-disable-next-line no-console
        console.warn(
          `Skipping invalid struct spec: ${templateArg} -> ${templateResult.error}`,
        );
        continue;
      }

      const typeKey = Buffer.from(restype).toString("binary");
      converters.set(typeKey, new StructConverter(templateResult.value));
    } catch (e) {
      // Ignore errors during parsing of struct specs
      // eslint-disable-next-line no-console
      console.warn(`Failed to parse struct spec '${templateArg}': ${e}`);
      continue;
    }
  }

  return converters;
}
