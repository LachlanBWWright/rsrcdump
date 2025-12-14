/**
 * Binary packing and unpacking utilities
 */
/**
 * Unpacker for reading binary data sequentially
 */
export declare class Unpacker {
    private data;
    private offset;
    constructor(data: Uint8Array, offset?: number);
    /**
     * Unpack data using a format string
     * Format: '>' for big-endian, followed by type chars:
     * - B: unsigned byte
     * - b: signed byte
     * - H: unsigned short (2 bytes)
     * - h: signed short (2 bytes)
     * - L: unsigned long (4 bytes)
     * - l/i: signed long (4 bytes)
     * - Q: unsigned long long (8 bytes)
     * - q: signed long long (8 bytes)
     * - f: float (4 bytes)
     * - d: double (8 bytes)
     * - Ns: N bytes as Uint8Array
     */
    unpack(fmt: string): number[] | (number | Uint8Array)[];
    seek(offset: number): void;
    skip(n: number): void;
    read(size: number): Uint8Array;
    unpackRawPstr(): Uint8Array;
    unpackPstr(encoding?: string, _errors?: 'replace' | 'ignore'): string;
    eof(): boolean;
    remaining(): number;
}
/**
 * Packer for writing binary data
 */
export declare class Packer {
    private buffer;
    /**
     * Pack values using a format string
     */
    pack(fmt: string, ...values: (number | Uint8Array | bigint)[]): Uint8Array;
    toUint8Array(): Uint8Array;
}
/**
 * Placeholder for writing values that will be filled in later
 */
export declare class WritePlaceholder {
    private _size;
    private committed;
    constructor(stream: {
        buffer: Uint8Array[];
        position: number;
    }, fmt: string);
    private calcSize;
    commit(_value: number | bigint): void;
}
/**
 * Packs a Pascal string
 */
export declare function packPstr(text: string, padding: number, encoding?: string): Uint8Array;
/**
 * Calculates the size of a struct format
 */
export declare function calcsize(fmt: string): number;
//# sourceMappingURL=packutils.d.ts.map