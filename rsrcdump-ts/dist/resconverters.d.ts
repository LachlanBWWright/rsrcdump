/**
 * Resource converters for different resource types
 */
import { Resource, ResourceFork } from './resfork.js';
import { StructTemplate } from './structtemplate.js';
import { Result } from './result.js';
export interface ResourceConverter {
    separateFile: string;
    jsonKey: string;
    unpack(res: Resource, fork: ResourceFork): Result<unknown, string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * Base16 (hex) converter for raw data
 */
export declare class Base16Converter implements ResourceConverter {
    separateFile: string;
    jsonKey: string;
    unpack(res: Resource, _fork: ResourceFork): Result<string, string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * Struct-based converter using struct templates
 */
export declare class StructConverter implements ResourceConverter {
    separateFile: string;
    jsonKey: string;
    private template;
    constructor(template: StructTemplate);
    unpack(res: Resource, _fork: ResourceFork): Result<unknown, string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * Single string converter for STR resources
 */
export declare class SingleStringConverter implements ResourceConverter {
    separateFile: string;
    jsonKey: string;
    unpack(res: Resource, _fork: ResourceFork): Result<string, string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * String list converter for STR# resources
 */
export declare class StringListConverter implements ResourceConverter {
    separateFile: string;
    jsonKey: string;
    unpack(res: Resource, _fork: ResourceFork): Result<string[], string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * TEXT resource converter
 */
export declare class TextConverter implements ResourceConverter {
    separateFile: string;
    jsonKey: string;
    unpack(res: Resource, _fork: ResourceFork): Result<string, string>;
    pack(obj: unknown): Result<Uint8Array, string>;
}
/**
 * Standard converters for common resource types
 */
export declare function getStandardConverters(): Map<string, ResourceConverter>;
//# sourceMappingURL=resconverters.d.ts.map