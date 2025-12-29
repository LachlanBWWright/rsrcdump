/**
 * Resource fork data structures and parsing
 */

import { Unpacker, Packer, calcsize } from './packutils.js';
import { decode, sanitizeTypeName, parseTypeName } from './textio.js';
import { Result, ok, err } from './result.js';
import { bytesToBinary, binaryToBytes } from './buffer-utils.js';

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

export function createResource(
  type: ResType,
  num: number,
  data: Uint8Array,
  name: Uint8Array = new Uint8Array(0),
  flags: number = 0,
  junk: number = 0,
  order: number = 0xFFFFFFFF
): Resource {
  return { type, num, data, name, flags, junk, order };
}

export function createResourceFork(): ResourceFork {
  return {
    tree: new Map(),
    junkNextresmap: 0,
    junkFilerefnum: 0,
    fileAttributes: 0,
  };
}

export function resourceDesc(res: Resource): string {
  return `${sanitizeTypeName(res.type)}#${res.num}`;
}

export function resourceTypeStr(res: Resource): string {
  return decode(res.type, 'replace');
}

export function resourceNameStr(res: Resource): string {
  return decode(res.name, 'replace');
}

/**
 * Parses a resource fork from bytes
 */
export function resourceForkFromBytes(data: Uint8Array): Result<ResourceFork, string> {
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
  const dataOffset = header[0] as number;
  const mapOffset = header[1] as number;
  const dataLength = header[2] as number;
  const mapLength = header[3] as number;

  if (dataOffset + dataLength > data.length || mapOffset + mapLength > data.length) {
    return err('offsets/lengths in header are nonsense');
  }

  const uData = new Unpacker(data.slice(dataOffset, dataOffset + dataLength));
  const uMap = new Unpacker(data.slice(mapOffset, mapOffset + mapLength));

  uMap.skip(16); // skip copy of resource header
  const mapHeader = uMap.unpack('>LHH');
  fork.junkNextresmap = mapHeader[0] as number;
  fork.junkFilerefnum = mapHeader[1] as number;
  fork.fileAttributes = mapHeader[2] as number;

  const typeInfo = uMap.unpack('>HHH');
  const typelistOffsetInMap = typeInfo[0] as number;
  const namelistOffsetInMap = typeInfo[1] as number;
  const numTypes = (typeInfo[2] as number) + 1;

  const mapData = data.slice(mapOffset, mapOffset + mapLength);
  const uTypes = new Unpacker(mapData.slice(typelistOffsetInMap));
  const uNames = new Unpacker(mapData.slice(namelistOffsetInMap));

  const order: Array<{ type: ResType; id: number; offset: number }> = [];

  for (let i = 0; i < numTypes; i++) {
    const typeRec = uMap.unpack('>4sHH');
    const resType = typeRec[0] as Uint8Array;
    const resCount = (typeRec[1] as number) + 1;
    const reslistOffset = typeRec[2] as number;

    const typeKey = bytesToBinary(resType);

    if (fork.tree.has(typeKey)) {
      return err(`${typeKey} already seen`);
    }
    
    fork.tree.set(typeKey, new Map());

    uTypes.seek(reslistOffset);
    
    for (let j = 0; j < resCount; j++) {
      const resRec = uTypes.unpack('>hHLL');
      const resId = resRec[0] as number;
      const resNameOffset = resRec[1] as number;
      const resPackedAttr = resRec[2] as number;
      const resJunk = resRec[3] as number;

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
        const nameLength = uNames.unpack('>B')[0] as number;
        const resNameRaw = uNames.read(nameLength);
        resName = new Uint8Array(resNameRaw);
      }

      // fetch resource data from data section
      uData.seek(resDataOffset);
      const resSize = uData.unpack('>i')[0] as number;
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
    if (!item) continue;
    const typeKey = bytesToBinary(item.type);
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
export function orderedFlatList(fork: ResourceFork): Resource[] {
  const flat: Resource[] = [];
  
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
export function packResourceFork(fork: ResourceFork): Result<Uint8Array, string> {
  const buffers: Uint8Array[] = [];
  let position = 0;

  // Helper to write bytes
  const write = (data: Uint8Array) => {
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
  const resDataOffsets = new Map<string, number>();

  for (const res of orderedFlatList(fork)) {
    const key = `${bytesToBinary(res.type)}:${res.num}`;
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

  const typeOffsets = new Map<string, number>();
  
  for (const [typeKey] of fork.tree) {
    const resType = binaryToBytes(typeKey);
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
  const nameOffsets = new Map<string, number>();
  
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
    const typeKey = bytesToBinary(res.type);
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
    } else {
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
  const dataOffsetBuf = buffers[dataOffsetPos];
  const mapOffsetBuf = buffers[mapOffsetPos];
  const dataLengthBuf = buffers[dataLengthPos];
  const mapLengthBuf = buffers[mapLengthPos];
  
  if (!dataOffsetBuf || !mapOffsetBuf || !dataLengthBuf || !mapLengthBuf) {
    return err('Failed to pack resource fork header');
  }
  
  headerCopy.set(dataOffsetBuf.slice(0, 4), 0);
  headerCopy.set(mapOffsetBuf.slice(0, 4), 4);
  headerCopy.set(dataLengthBuf.slice(0, 4), 8);
  headerCopy.set(mapLengthBuf.slice(0, 4), 12);
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
export function getResourceType(fork: ResourceFork, key: string | Uint8Array): Result<Map<number, Resource>, string> {
  let typeKey: string;
  
  if (typeof key === 'string') {
    const parsed = parseTypeName(key);
    typeKey = bytesToBinary(parsed);
  } else {
    if (key.length !== 4) {
      return err('restype isn\'t 4 bytes');
    }
    typeKey = bytesToBinary(key);
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
export function resourceForkToString(fork: ResourceFork): string {
  const typeCounts: Array<[string, number]> = [];
  
  for (const [typeKey, typeMap] of fork.tree) {
    const resType = binaryToBytes(typeKey);
    const sanitized = sanitizeTypeName(resType);
    typeCounts.push([sanitized, typeMap.size]);
  }
  
  const parts = typeCounts.map(([type, count]) => `${count} ${type}`);
  return `ResourceFork(${parts.join(', ')})`;
}
