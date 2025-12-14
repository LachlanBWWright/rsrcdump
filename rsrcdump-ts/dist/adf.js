/**
 * AppleDouble Format (ADF) support
 */
import { Unpacker, Packer } from './packutils.js';
import { ok, err } from './result.js';
export const ADF_MAGIC = 0x00051607;
export const ADF_VERSION = 0x00020000;
export const ADF_ENTRYNUM_RESOURCEFORK = 2;
/**
 * Unpacks an AppleDouble file
 */
export function unpackAdf(adfData) {
    const u = new Unpacker(adfData);
    const header = u.unpack('>LL16sH');
    const magic = header[0];
    const version = header[1];
    const filler = header[2];
    const numEntries = header[3];
    if (magic !== ADF_MAGIC) {
        return err('AppleDouble magic number not found');
    }
    if (version !== ADF_VERSION) {
        return err(`Only Version 2 ADF is supported (this is version ${version.toString(16).padStart(8, '0')})`);
    }
    const entryOffsets = [];
    for (let i = 0; i < numEntries; i++) {
        const entry = u.unpack('>LLL');
        entryOffsets.push([entry[0], entry[1], entry[2]]);
    }
    const entries = new Map();
    entries.set(0, filler); // Entry #0 is invalid -- use it for the filler
    for (const [entryId, offset, length] of entryOffsets) {
        u.seek(offset);
        entries.set(entryId, u.read(length));
    }
    return ok(entries);
}
/**
 * Packs data into an AppleDouble file
 */
export function packAdf(adfEntries) {
    const hasFakeEntry0 = adfEntries.has(0);
    const filler = adfEntries.get(0) || new Uint8Array(16);
    if (filler.length !== 16) {
        return err('Filler must be exactly 16 bytes');
    }
    let numEntries = adfEntries.size;
    if (hasFakeEntry0) {
        numEntries -= 1;
    }
    const buffers = [];
    const packer = new Packer();
    // Write header
    buffers.push(packer.pack('>LL', ADF_MAGIC, ADF_VERSION));
    buffers.push(filler);
    buffers.push(packer.pack('>H', numEntries));
    // Store positions for offset placeholders
    const offsetPositions = new Map();
    let headerSize = 4 + 4 + 16 + 2; // magic + version + filler + numEntries
    // Write entry descriptors
    for (const [entryNum, entryData] of adfEntries) {
        if (entryNum === 0)
            continue;
        buffers.push(packer.pack('>L', entryNum));
        offsetPositions.set(entryNum, headerSize + 4); // Position of offset field
        buffers.push(packer.pack('>L', 0)); // Offset placeholder
        buffers.push(packer.pack('>L', entryData.length));
        headerSize += 12;
    }
    // Write entry data and update offsets
    const offsetUpdates = new Map();
    let currentPos = headerSize;
    for (const [entryNum, entryData] of adfEntries) {
        if (entryNum === 0)
            continue;
        offsetUpdates.set(entryNum, currentPos);
        buffers.push(entryData);
        currentPos += entryData.length;
    }
    // Combine all buffers
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    // Update offset placeholders
    for (const [entryNum, offsetPos] of offsetPositions) {
        const actualOffset = offsetUpdates.get(entryNum);
        if (actualOffset !== undefined) {
            const offsetBytes = packer.pack('>L', actualOffset);
            result.set(offsetBytes, offsetPos);
        }
    }
    return ok(result);
}
//# sourceMappingURL=adf.js.map