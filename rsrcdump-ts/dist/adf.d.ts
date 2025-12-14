/**
 * AppleDouble Format (ADF) support
 */
import { Result } from './result.js';
export declare const ADF_MAGIC = 333319;
export declare const ADF_VERSION = 131072;
export declare const ADF_ENTRYNUM_RESOURCEFORK = 2;
/**
 * Unpacks an AppleDouble file
 */
export declare function unpackAdf(adfData: Uint8Array): Result<Map<number, Uint8Array>, string>;
/**
 * Packs data into an AppleDouble file
 */
export declare function packAdf(adfEntries: Map<number, Uint8Array>): Result<Uint8Array, string>;
//# sourceMappingURL=adf.d.ts.map