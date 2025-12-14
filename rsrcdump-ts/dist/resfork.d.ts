/**
 * Resource fork data structures and parsing
 */
import { Result } from './result.js';
export type ResType = Uint8Array;
export interface Resource {
    type: ResType;
    num: number;
    data: Uint8Array;
    name: Uint8Array;
    flags: number;
    junk: number;
    order: number;
}
export interface ResourceFork {
    tree: Map<string, Map<number, Resource>>;
    junkNextresmap: number;
    junkFilerefnum: number;
    fileAttributes: number;
}
export declare function createResource(type: ResType, num: number, data: Uint8Array, name?: Uint8Array, flags?: number, junk?: number, order?: number): Resource;
export declare function createResourceFork(): ResourceFork;
export declare function resourceDesc(res: Resource): string;
export declare function resourceTypeStr(res: Resource): string;
export declare function resourceNameStr(res: Resource): string;
/**
 * Parses a resource fork from bytes
 */
export declare function resourceForkFromBytes(data: Uint8Array): Result<ResourceFork, string>;
/**
 * Gets an ordered flat list of all resources
 */
export declare function orderedFlatList(fork: ResourceFork): Resource[];
/**
 * Packs a resource fork to bytes
 */
export declare function packResourceFork(fork: ResourceFork): Result<Uint8Array, string>;
/**
 * Gets a resource type from the fork
 */
export declare function getResourceType(fork: ResourceFork, key: string | Uint8Array): Result<Map<number, Resource>, string>;
/**
 * Gets a string representation of the resource fork
 */
export declare function resourceForkToString(fork: ResourceFork): string;
//# sourceMappingURL=resfork.d.ts.map