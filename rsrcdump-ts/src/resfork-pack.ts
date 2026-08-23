import { Packer } from "./packutils.js";
import { bytesToBinary, binaryToBytes } from "./buffer-utils.js";
import { err, ok, type Result } from "./result.js";
import type { Resource, ResourceFork } from "./resfork.js";

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
