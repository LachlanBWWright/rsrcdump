/**
 * Resource fork data structures and parsing
 */
import { Unpacker, Packer, calcsize } from './packutils.js';
import { decode, sanitizeTypeName, parseTypeName } from './textio.js';
import { ok, err } from './result.js';
export function createResource(type, num, data, name = new Uint8Array(0), flags = 0, junk = 0, order = 0xFFFFFFFF) {
    return { type, num, data, name, flags, junk, order };
}
export function createResourceFork() {
    return {
        tree: new Map(),
        junkNextresmap: 0,
        junkFilerefnum: 0,
        fileAttributes: 0,
    };
}
export function resourceDesc(res) {
    return `${sanitizeTypeName(res.type)}#${res.num}`;
}
export function resourceTypeStr(res) {
    return decode(res.type, 'replace');
}
export function resourceNameStr(res) {
    return decode(res.name, 'replace');
}
/**
 * Parses a resource fork from bytes
 */
export function resourceForkFromBytes(data) {
    if (data.length === 0) {
        return ok(createResourceFork());
    }
    const fork = createResourceFork();
    const headerSize = calcsize('>LLLL16x');
    if (data.length < headerSize) {
        return err('data is too small to contain a valid resource fork header');
    }
    const u = new Unpacker(data);
    const header = u.unpack('>LLLL16x');
    const dataOffset = header[0];
    const mapOffset = header[1];
    const dataLength = header[2];
    const mapLength = header[3];
    if (dataOffset + dataLength > data.length || mapOffset + mapLength > data.length) {
        return err('offsets/lengths in header are nonsense');
    }
    const uData = new Unpacker(data.slice(dataOffset, dataOffset + dataLength));
    const uMap = new Unpacker(data.slice(mapOffset, mapOffset + mapLength));
    uMap.skip(16); // skip copy of resource header
    const mapHeader = uMap.unpack('>LHH');
    fork.junkNextresmap = mapHeader[0];
    fork.junkFilerefnum = mapHeader[1];
    fork.fileAttributes = mapHeader[2];
    const typeInfo = uMap.unpack('>HHH');
    const typelistOffsetInMap = typeInfo[0];
    const namelistOffsetInMap = typeInfo[1];
    let numTypes = typeInfo[2] + 1;
    const mapData = data.slice(mapOffset, mapOffset + mapLength);
    const uTypes = new Unpacker(mapData.slice(typelistOffsetInMap));
    const uNames = new Unpacker(mapData.slice(namelistOffsetInMap));
    const order = [];
    for (let i = 0; i < numTypes; i++) {
        const typeRec = uMap.unpack('>4sHH');
        const resType = typeRec[0];
        let resCount = typeRec[1] + 1;
        const reslistOffset = typeRec[2];
        const typeKey = Buffer.from(resType).toString('binary');
        if (fork.tree.has(typeKey)) {
            return err(`${typeKey} already seen`);
        }
        fork.tree.set(typeKey, new Map());
        uTypes.seek(reslistOffset);
        for (let j = 0; j < resCount; j++) {
            const resRec = uTypes.unpack('>hHLL');
            const resId = resRec[0];
            const resNameOffset = resRec[1];
            const resPackedAttr = resRec[2];
            const resJunk = resRec[3];
            // unpack attributes
            const resFlags = (resPackedAttr & 0xFF000000) >>> 24;
            const resDataOffset = resPackedAttr & 0x00FFFFFF;
            order.push({ type: resType, id: resId, offset: resDataOffset });
            // check compressed flag
            if ((resFlags & 1) !== 0) {
                return err('compressed resources are not supported');
            }
            // fetch name
            let resName = new Uint8Array(0);
            if (resNameOffset !== 0xFFFF) {
                uNames.seek(resNameOffset);
                const nameLength = uNames.unpack('>B')[0];
                const resNameRaw = uNames.read(nameLength);
                resName = new Uint8Array(resNameRaw);
            }
            // fetch resource data from data section
            uData.seek(resDataOffset);
            const resSize = uData.unpack('>i')[0];
            const resDataRaw = uData.read(resSize);
            const resData = new Uint8Array(resDataRaw);
            const res = createResource(resType, resId, resData, resName, resFlags, resJunk);
            const typeMap = fork.tree.get(typeKey);
            if (!typeMap) {
                return err('Internal error: type map not found');
            }
            if (typeMap.has(resId)) {
                return err(`Duplicate resource ID ${resId} for type ${typeKey}`);
            }
            typeMap.set(resId, res);
        }
    }
    // Set order
    order.sort((a, b) => a.offset - b.offset);
    for (let i = 0; i < order.length; i++) {
        const item = order[i];
        if (!item)
            continue;
        const typeKey = Buffer.from(item.type).toString('binary');
        const typeMap = fork.tree.get(typeKey);
        if (typeMap) {
            const res = typeMap.get(item.id);
            if (res) {
                res.order = i;
            }
        }
    }
    return ok(fork);
}
/**
 * Gets an ordered flat list of all resources
 */
export function orderedFlatList(fork) {
    const flat = [];
    for (const typeMap of fork.tree.values()) {
        for (const res of typeMap.values()) {
            flat.push(res);
        }
    }
    return flat.sort((a, b) => a.order - b.order);
}
/**
 * Packs a resource fork to bytes
 */
export function packResourceFork(fork) {
    const buffers = [];
    let position = 0;
    // Helper to write bytes
    const write = (data) => {
        buffers.push(data);
        position += data.length;
    };
    // Helper to get current position
    const tell = () => position;
    // Resource fork header
    const resForkOffset = tell();
    const packer = new Packer();
    // Placeholders for offsets and lengths (we'll calculate these later)
    const dataOffsetPos = buffers.length;
    write(packer.pack('>L', 0)); // data offset placeholder
    const mapOffsetPos = buffers.length;
    write(packer.pack('>L', 0)); // map offset placeholder
    const dataLengthPos = buffers.length;
    write(packer.pack('>L', 0)); // data length placeholder
    const mapLengthPos = buffers.length;
    write(packer.pack('>L', 0)); // map length placeholder
    write(new Uint8Array(112 + 128)); // system-reserved + app-reserved
    // Write data section
    const dataSectionOffset = tell();
    const resDataOffsets = new Map();
    for (const res of orderedFlatList(fork)) {
        const key = `${Buffer.from(res.type).toString('binary')}:${res.num}`;
        resDataOffsets.set(key, tell());
        write(packer.pack('>i', res.data.length));
        write(res.data);
    }
    const dataSectionLength = tell() - dataSectionOffset;
    // Write map section
    const mapSectionOffset = tell();
    // Copy of resource header (placeholder for now)
    const copyHeaderPos = buffers.length;
    write(new Uint8Array(16));
    write(packer.pack('>LHH', fork.junkNextresmap, fork.junkFilerefnum, fork.fileAttributes));
    const typesOffsetPos = buffers.length;
    write(packer.pack('>H', 0)); // types offset placeholder
    const namesOffsetPos = buffers.length;
    write(packer.pack('>H', 0)); // names offset placeholder
    // Write resource types
    const resListOffset = tell();
    write(packer.pack('>H', fork.tree.size - 1)); // number of types minus one
    const typeOffsets = new Map();
    for (const [typeKey] of fork.tree) {
        const resType = Buffer.from(typeKey, 'binary');
        const typeMap = fork.tree.get(typeKey);
        if (!typeMap || typeMap.size === 0) {
            return err(`Can't write resource types that contain 0 resources`);
        }
        write(new Uint8Array(resType));
        write(packer.pack('>H', typeMap.size - 1)); // count minus one
        const offsetPos = buffers.length;
        typeOffsets.set(typeKey, offsetPos);
        write(packer.pack('>H', 0)); // offset placeholder
    }
    // Write resource lists
    const nameOffsets = new Map();
    for (const [typeKey, typeMap] of fork.tree) {
        // Update type offset
        const typeOffsetPos = typeOffsets.get(typeKey);
        if (typeOffsetPos !== undefined) {
            const relOffset = tell() - resListOffset;
            const offsetBytes = packer.pack('>H', relOffset);
            buffers[typeOffsetPos] = offsetBytes;
        }
        for (const [resId, res] of typeMap) {
            write(packer.pack('>h', resId));
            const nameOffsetPos = buffers.length;
            nameOffsets.set(`${typeKey}:${resId}`, nameOffsetPos);
            write(packer.pack('>H', 0)); // name offset placeholder
            const key = `${typeKey}:${resId}`;
            const dataOffset = resDataOffsets.get(key);
            if (dataOffset === undefined) {
                return err('Internal error: data offset not found');
            }
            const relOffset = dataOffset - dataSectionOffset;
            const packedAttr = (res.flags << 24) | relOffset;
            write(packer.pack('>L', packedAttr));
            write(packer.pack('>L', res.junk));
        }
    }
    // Write resource names
    const resNamesOffset = tell();
    for (const res of orderedFlatList(fork)) {
        const typeKey = Buffer.from(res.type).toString('binary');
        const key = `${typeKey}:${res.num}`;
        const nameOffsetPos = nameOffsets.get(key);
        if (res.name.length > 0) {
            if (nameOffsetPos !== undefined) {
                const relOffset = tell() - resNamesOffset;
                const offsetBytes = packer.pack('>H', relOffset);
                buffers[nameOffsetPos] = offsetBytes;
            }
            write(packer.pack('>B', res.name.length));
            write(res.name);
        }
        else {
            if (nameOffsetPos !== undefined) {
                const offsetBytes = packer.pack('>H', 0xFFFF);
                buffers[nameOffsetPos] = offsetBytes;
            }
        }
    }
    const mapSectionLength = tell() - mapSectionOffset;
    // Update placeholders
    buffers[dataOffsetPos] = packer.pack('>L', dataSectionOffset - resForkOffset);
    buffers[mapOffsetPos] = packer.pack('>L', mapSectionOffset - resForkOffset);
    buffers[dataLengthPos] = packer.pack('>L', dataSectionLength);
    buffers[mapLengthPos] = packer.pack('>L', mapSectionLength);
    // Update copy of header
    const headerCopy = new Uint8Array(16);
    headerCopy.set(buffers[dataOffsetPos].slice(0, 4), 0);
    headerCopy.set(buffers[mapOffsetPos].slice(0, 4), 4);
    headerCopy.set(buffers[dataLengthPos].slice(0, 4), 8);
    headerCopy.set(buffers[mapLengthPos].slice(0, 4), 12);
    buffers[copyHeaderPos] = headerCopy;
    // Update types and names offsets in map
    buffers[typesOffsetPos] = packer.pack('>H', resListOffset - mapSectionOffset);
    buffers[namesOffsetPos] = packer.pack('>H', resNamesOffset - mapSectionOffset);
    // Concatenate all buffers
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return ok(result);
}
/**
 * Gets a resource type from the fork
 */
export function getResourceType(fork, key) {
    let typeKey;
    if (typeof key === 'string') {
        const parsed = parseTypeName(key);
        typeKey = Buffer.from(parsed).toString('binary');
    }
    else {
        if (key.length !== 4) {
            return err('restype isn\'t 4 bytes');
        }
        typeKey = Buffer.from(key).toString('binary');
    }
    const typeMap = fork.tree.get(typeKey);
    if (!typeMap) {
        return err(`Resource type ${key} not found`);
    }
    return ok(typeMap);
}
/**
 * Gets a string representation of the resource fork
 */
export function resourceForkToString(fork) {
    const typeCounts = [];
    for (const [typeKey, typeMap] of fork.tree) {
        const resType = Buffer.from(typeKey, 'binary');
        const sanitized = sanitizeTypeName(new Uint8Array(resType));
        typeCounts.push([sanitized, typeMap.size]);
    }
    const parts = typeCounts.map(([type, count]) => `${count} ${type}`);
    return `ResourceFork(${parts.join(', ')})`;
}
//# sourceMappingURL=resfork.js.map