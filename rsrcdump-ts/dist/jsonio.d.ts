/**
 * JSON I/O for resource forks
 */
import type { ResourceFork } from './resfork.js';
import { ResourceConverter } from './resconverters.js';
import { Result } from './result.js';
interface JsonBlob {
    _metadata: {
        junk1: number;
        junk2: number;
        file_attributes: number;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}
/**
 * Converts a resource fork to JSON
 */
export declare function resourceForkToJson(fork: ResourceFork, includeTypes: Uint8Array[] | undefined, excludeTypes: Uint8Array[] | undefined, converters: Map<string, ResourceConverter>, metadata?: Record<string, unknown>): Result<JsonBlob, string>;
/**
 * Converts JSON to a resource fork
 */
export declare function jsonToResourceFork(jsonBlob: JsonBlob, converters: Map<string, ResourceConverter>, onlyTypes?: Uint8Array[], skipTypes?: Uint8Array[]): Result<ResourceFork, string>;
/**
 * Converts a resource fork to a JSON string
 */
export declare function resourceForkToJsonString(fork: ResourceFork, includeTypes: Uint8Array[] | undefined, excludeTypes: Uint8Array[] | undefined, converters: Map<string, ResourceConverter>, metadata?: Record<string, unknown>): Result<string, string>;
/**
 * Parses a JSON string to a resource fork
 */
export declare function jsonStringToResourceFork(jsonString: string, converters: Map<string, ResourceConverter>, onlyTypes?: Uint8Array[], skipTypes?: Uint8Array[]): Result<ResourceFork, string>;
export {};
//# sourceMappingURL=jsonio.d.ts.map