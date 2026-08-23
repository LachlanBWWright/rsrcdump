import { bytesToBinary, binaryToBytes } from "./buffer-utils.js";
import { err, ok, type Result } from "./result.js";
import type { Resource, ResourceFork } from "./resfork.js";
import { parseTypeName, sanitizeTypeName } from "./textio.js";

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
  const typeCounts: [string, number][] = [];
  
  for (const [typeKey, typeMap] of fork.tree) {
    const resType = binaryToBytes(typeKey);
    const sanitized = sanitizeTypeName(resType);
    typeCounts.push([sanitized, typeMap.size]);
  }
  
  const parts = typeCounts.map(([type, count]) => `${count} ${type}`);
  return `ResourceFork(${parts.join(', ')})`;
}
