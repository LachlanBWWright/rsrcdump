/**
 * Resource fork data structures and parsing
 */

import { Unpacker, calcsize } from './packutils.js';
import { decode, sanitizeTypeName } from './textio.js';
import { Result, ok, err } from './result.js';
import { bytesToBinary, asNumber, asUint8Array } from './buffer-utils.js';

export { orderedFlatList, packResourceFork } from "./resfork-pack.js";
export { getResourceType, resourceForkToString } from "./resfork-query.js";

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
  flags = 0,
  junk = 0,
  order = 0xFFFFFFFF
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
  const dataOffset = asNumber(header[0]);
  const mapOffset = asNumber(header[1]);
  const dataLength = asNumber(header[2]);
  const mapLength = asNumber(header[3]);

  if (dataOffset + dataLength > data.length || mapOffset + mapLength > data.length) {
    return err('offsets/lengths in header are nonsense');
  }

  const uData = new Unpacker(data.slice(dataOffset, dataOffset + dataLength));
  const uMap = new Unpacker(data.slice(mapOffset, mapOffset + mapLength));

  uMap.skip(16); // skip copy of resource header
  const mapHeader = uMap.unpack('>LHH');
  fork.junkNextresmap = asNumber(mapHeader[0]);
  fork.junkFilerefnum = asNumber(mapHeader[1]);
  fork.fileAttributes = asNumber(mapHeader[2]);

  const typeInfo = uMap.unpack('>HHH');
  const typelistOffsetInMap = asNumber(typeInfo[0]);
  const namelistOffsetInMap = asNumber(typeInfo[1]);
  const numTypes = asNumber(typeInfo[2]) + 1;

  const mapData = data.slice(mapOffset, mapOffset + mapLength);
  const uTypes = new Unpacker(mapData.slice(typelistOffsetInMap));
  const uNames = new Unpacker(mapData.slice(namelistOffsetInMap));

  const order: { type: ResType; id: number; offset: number }[] = [];

  for (let i = 0; i < numTypes; i++) {
    const typeRec = uMap.unpack('>4sHH');
    const resType = asUint8Array(typeRec[0]);
    const resCount = asNumber(typeRec[1]) + 1;
    const reslistOffset = asNumber(typeRec[2]);

    const typeKey = bytesToBinary(resType);

    if (fork.tree.has(typeKey)) {
      return err(`${typeKey} already seen`);
    }
    
    fork.tree.set(typeKey, new Map());

    uTypes.seek(reslistOffset);
    
    for (let j = 0; j < resCount; j++) {
      const resRec = uTypes.unpack('>hHLL');
      const resId = asNumber(resRec[0]);
      const resNameOffset = asNumber(resRec[1]);
      const resPackedAttr = asNumber(resRec[2]);
      const resJunk = asNumber(resRec[3]);

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
        const nameLength = asNumber(uNames.unpack('>B')[0]);
        const resNameRaw = uNames.read(nameLength);
        resName = new Uint8Array(resNameRaw);
      }

      // fetch resource data from data section
      uData.seek(resDataOffset);
      const resSize = asNumber(uData.unpack('>i')[0]);
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
