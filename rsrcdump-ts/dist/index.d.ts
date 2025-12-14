/**
 * rsrcdump-ts public API
 * TypeScript port of rsrcdump with Result/Err error handling
 */
import type { ResourceFork } from './resfork.js';
import type { Result } from './result.js';
export type { Ok, Err, Result } from './result.js';
export { ok, err, isOk, isErr, unwrap, map, andThen } from './result.js';
export type { Resource, ResourceFork, ResType } from './resfork.js';
export { resourceForkFromBytes, packResourceFork, createResource, createResourceFork, resourceDesc, resourceTypeStr, resourceNameStr, orderedFlatList, getResourceType, resourceForkToString, } from './resfork.js';
export { unpackAdf, packAdf, ADF_MAGIC, ADF_VERSION, ADF_ENTRYNUM_RESOURCEFORK, } from './adf.js';
export { resourceForkToJsonString, jsonToResourceFork, } from './jsonio.js';
export type { ResourceConverter } from './resconverters.js';
export { getStandardConverters, Base16Converter, StructConverter, SingleStringConverter, StringListConverter, TextConverter, } from './resconverters.js';
export type { StructTemplate } from './structtemplate.js';
export { structTemplateFromString, structTemplateFromStringWithTypename, unpackRecord, pack as packStruct, } from './structtemplate.js';
export { getGlobalEncoding, setGlobalEncoding, sanitizeTypeName, parseTypeName, sanitizeResourceName, decode, encode, } from './textio.js';
/**
 * Loads a resource fork from a file path or bytes
 */
export declare function load(pathOrData: string | Uint8Array): Promise<Result<ResourceFork, string>>;
/**
 * Saves a resource fork to JSON
 */
export declare function saveToJson(data: Uint8Array, structSpecs?: string[], includeTypes?: string[], excludeTypes?: string[]): Promise<Result<string, string>>;
/**
 * Loads bytes from JSON (async version with struct specs support)
 */
export declare function loadBytesFromJsonAsync(jsonBlob: unknown, structSpecs?: string[], onlyTypes?: string[], skipTypes?: string[], adf?: boolean): Promise<Result<Uint8Array, string>>;
/**
 * Loads bytes from JSON (sync version, no struct specs)
 */
export declare function loadBytesFromJson(jsonBlob: unknown, structSpecs?: string[], onlyTypes?: string[], skipTypes?: string[], adf?: boolean): Result<Uint8Array, string>;
//# sourceMappingURL=index.d.ts.map