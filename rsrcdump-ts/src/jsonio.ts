/**
 * JSON I/O for resource forks
 */

import type { Resource, ResourceFork } from "./resfork.js";
import {
  resourceNameStr,
  createResource,
  createResourceFork,
} from "./resfork.js";
import { ResourceConverter, Base16Converter } from "./resconverters.js";
import { decode, encode, parseTypeName } from "./textio.js";
import { Result, ok, err } from "./result.js";
import { bytesToBinary, binaryToBytes } from "./buffer-utils.js";

interface ResourceWrapper {
  name?: string;
  flags?: number;
  junk?: number;
  order?: number;
  data?: string;
  obj?: unknown;
  file?: string;
  conversion_error?: string;
  [key: string]: unknown;
}

interface JsonBlob {
  _metadata: {
    junk1: number;
    junk2: number;
    file_attributes: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface JsonOptions {
  useBacktickArrays?: boolean;
}

/**
 * Converts a resource fork to JSON
 */
export function resourceForkToJson(
  fork: ResourceFork,
  includeTypes: Uint8Array[] = [],
  excludeTypes: Uint8Array[] = [],
  converters: Map<string, ResourceConverter>,
  metadata: Record<string, unknown> = {},
  options: JsonOptions = {}
): Result<JsonBlob, string> {
  const metadataObj: Record<string, unknown> = {
    junk1: fork.junkNextresmap,
    junk2: fork.junkFilerefnum,
    file_attributes: fork.fileAttributes,
    ...metadata,
  };
  
  const jsonBlob: JsonBlob = {
    _metadata: metadataObj as JsonBlob['_metadata'],
  };

  const includeTypeKeys = new Set(
    includeTypes.map((t) => bytesToBinary(t)),
  );
  const excludeTypeKeys = new Set(
    excludeTypes.map((t) => bytesToBinary(t)),
  );

  for (const [typeKey, typeMap] of fork.tree) {
    if (excludeTypeKeys.has(typeKey)) {
      continue;
    }
    if (includeTypeKeys.size > 0 && !includeTypeKeys.has(typeKey)) {
      continue;
    }

    const resType = binaryToBytes(typeKey);
    const resTypeKey = decode(resType, "replace");

    const typeObj: Record<string, ResourceWrapper> = {};

    const converter = converters.get(typeKey) || new Base16Converter();

    for (const [resId, res] of typeMap) {
      const wrapper: ResourceWrapper = {};

      if (res.name.length > 0) {
        wrapper.name = resourceNameStr(res);
      }

      if (res.flags !== 0) {
        wrapper.flags = res.flags;
      }

      if (res.junk !== 0) {
        wrapper.junk = res.junk;
      }

      if (res.order !== 0xffffffff) {
        wrapper.order = res.order;
      }

      const unpackResult = converter.unpack(res, fork, options);
      if (!unpackResult.ok) {
        // Keep conversion_error to indicate struct conversion failed
        wrapper.conversion_error = unpackResult.error;
        // Still fall back to base16 for usability
        const base16Result = new Base16Converter().unpack(res, fork);
        if (base16Result.ok) {
          wrapper.data = base16Result.value;
        }
      } else {
        wrapper[converter.jsonKey] = unpackResult.value;
      }

      typeObj[resId.toString()] = wrapper;
    }

    jsonBlob[resTypeKey] = typeObj;
  }

  return ok(jsonBlob);
}

/**
 * Converts JSON to a resource fork
 */
export function jsonToResourceFork(
  jsonBlob: JsonBlob,
  converters: Map<string, ResourceConverter>,
  onlyTypes: Uint8Array[] = [],
  skipTypes: Uint8Array[] = [],
): Result<ResourceFork, string> {
  const fork = createResourceFork();

  const metadata = jsonBlob._metadata;
  if (!metadata) {
    return err("Missing _metadata in JSON");
  }

  fork.fileAttributes = metadata.file_attributes as number;
  fork.junkNextresmap = metadata.junk1 as number;
  fork.junkFilerefnum = metadata.junk2 as number;

  const onlyTypeKeys = new Set(
    onlyTypes.map((t) => bytesToBinary(t)),
  );
  const skipTypeKeys = new Set(
    skipTypes.map((t) => bytesToBinary(t)),
  );

  for (const [typeName, typeRecords] of Object.entries(jsonBlob)) {
    if (typeName.startsWith("_")) {
      continue; // Skip metadata
    }

    if (typeName.length > 4) {
      continue; // Probably not a resource type
    }

    const resType = parseTypeName(typeName);
    const typeKey = bytesToBinary(resType);

    if (skipTypeKeys.has(typeKey)) {
      continue;
    }
    if (onlyTypeKeys.size > 0 && !onlyTypeKeys.has(typeKey)) {
      continue;
    }

    const typeMap = new Map<number, Resource>();
    fork.tree.set(typeKey, typeMap);

    const converter = converters.get(typeKey) || new Base16Converter();

    if (typeof typeRecords !== "object" || typeRecords === null) {
      return err(`Type ${typeName} is not an object`);
    }

    for (const [resIdStr, resBlob] of Object.entries(
      typeRecords as Record<string, unknown>,
    )) {
      if (typeof resBlob !== "object" || resBlob === null) {
        return err(`Resource ${typeName} #${resIdStr} is not an object`);
      }

      const wrapper = resBlob as ResourceWrapper;

      const resNum = parseInt(resIdStr, 10);
      const resName = encode(wrapper.name || "", "replace");
      const resFlags = wrapper.flags || 0;
      const resJunk = wrapper.junk || 0;
      const resOrder = wrapper.order !== undefined ? wrapper.order : -1;

      // Prefer converter-specific JSON key (e.g., 'obj'), but fall back to base16 'data' when present
      const dataBlob = wrapper[converter.jsonKey];
      let packResult;

      if (dataBlob === undefined && wrapper.data !== undefined) {
        // The converter-specific value is missing (unpacked failed earlier); use base16 fallback
        const base16Pack = new Base16Converter().pack(wrapper.data);
        if (!base16Pack.ok) {
          return err(
            `Failed to pack ${typeName} #${resIdStr} from base16 fallback: ${base16Pack.error}`,
          );
        }
        packResult = base16Pack;
      } else {
        packResult = converter.pack(dataBlob);
      }

      if (!packResult.ok) {
        return err(
          `Failed to pack ${typeName} #${resIdStr}: ${packResult.error}`,
        );
      }

      const res = createResource(
        resType,
        resNum,
        packResult.value,
        resName,
        resFlags,
        resJunk,
        resOrder,
      );

      typeMap.set(resNum, res);
    }
  }

  return ok(fork);
}

/**
 * Converts a resource fork to a JSON string
 */
export function resourceForkToJsonString(
  fork: ResourceFork,
  includeTypes: Uint8Array[] = [],
  excludeTypes: Uint8Array[] = [],
  converters: Map<string, ResourceConverter>,
  metadata: Record<string, unknown> = {},
  options: JsonOptions = {}
): Result<string, string> {
  const jsonResult = resourceForkToJson(
    fork,
    includeTypes,
    excludeTypes,
    converters,
    metadata,
    options,
  );

  if (!jsonResult.ok) {
    return jsonResult;
  }

  try {
    return ok(JSON.stringify(jsonResult.value, null, "\t"));
  } catch (e) {
    return err(`Failed to stringify JSON: ${e}`);
  }
}

/**
 * Parses a JSON string to a resource fork
 */
export function jsonStringToResourceFork(
  jsonString: string,
  converters: Map<string, ResourceConverter>,
  onlyTypes: Uint8Array[] = [],
  skipTypes: Uint8Array[] = [],
): Result<ResourceFork, string> {
  let jsonBlob: JsonBlob;

  try {
    jsonBlob = JSON.parse(jsonString);
  } catch (e) {
    return err(`Failed to parse JSON: ${e}`);
  }

  return jsonToResourceFork(jsonBlob, converters, onlyTypes, skipTypes);
}
