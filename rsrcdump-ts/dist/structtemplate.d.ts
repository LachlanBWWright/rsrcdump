/**
 * Struct template parsing for custom resource formats
 */
import { Result } from './result.js';
export interface StructTemplate {
    format: string;
    recordLength: number;
    fieldFormats: string[];
    fieldNames: Array<string | null>;
    isList: boolean;
    isScalar: boolean;
}
/**
 * Creates a struct template from a template string
 */
export declare function structTemplateFromString(template: string): Result<StructTemplate, string>;
/**
 * Unpacks a single record using a struct template
 */
export declare function unpackRecord(template: StructTemplate, data: Uint8Array, offset: number): Result<unknown, string>;
/**
 * Packs data using a struct template
 */
export declare function pack(template: StructTemplate, obj: unknown): Result<Uint8Array, string>;
/**
 * Creates a struct template from a template string with typename
 */
export declare function structTemplateFromStringWithTypename(templateArg: string): Promise<Result<{
    converter: StructTemplate;
    restype: Uint8Array;
}, string>>;
//# sourceMappingURL=structtemplate.d.ts.map