// Resource fork parsing

import type { Resource, ResourceFork } from './types.js';
import { sanitizeTypeName } from './textio.js';

export class ResourceForkParser {
  static fromBytes(data: Uint8Array): ResourceFork {
    const view = new DataView(data.buffer, data.byteOffset);
    
    // Read resource header
    const dataOffset = view.getUint32(0, false); // big-endian
    const mapOffset = view.getUint32(4, false);
    // const dataLength = view.getUint32(8, false);
    // const mapLength = view.getUint32(12, false);
    
    // Read resource map
    const mapView = new DataView(data.buffer, data.byteOffset + mapOffset);
    
    // Skip reserved fields and attributes
    const typeListOffset = mapView.getUint16(24, false);
    const nameListOffset = mapView.getUint16(26, false);
    
    // Read type list
    const typeCount = mapView.getUint16(typeListOffset, false) + 1;
    
    const resources = new Map<string, Map<number, Resource>>();
    let currentPos = typeListOffset + 2;
    
    for (let i = 0; i < typeCount; i++) {
      // Read type entry
      const typeBytes = new Uint8Array(data.buffer, data.byteOffset + mapOffset + currentPos, 4);
      const typeName = sanitizeTypeName(typeBytes);
      const resourceCount = mapView.getUint16(currentPos + 4, false) + 1;
      const resourceListOffset = typeListOffset + mapView.getUint16(currentPos + 6, false);
      
      currentPos += 8;
      
      // Read resources for this type
      const typeResources = new Map<number, Resource>();
      
      for (let j = 0; j < resourceCount; j++) {
        const resListPos = resourceListOffset + j * 12;
        
        const id = mapView.getInt16(resListPos, false);
        const nameOffset = mapView.getInt16(resListPos + 2, false);
        const attributes = mapView.getUint8(resListPos + 4);
        const dataOffsetHigh = mapView.getUint8(resListPos + 5);
        const dataOffsetLow = mapView.getUint16(resListPos + 6, false);
        const resourceDataOffset = (dataOffsetHigh << 16) | dataOffsetLow;
        
        // Read resource data
        const actualDataOffset = dataOffset + resourceDataOffset;
        const resourceDataLength = view.getUint32(actualDataOffset, false);
        const resourceData = new Uint8Array(
          data.buffer, 
          data.byteOffset + actualDataOffset + 4, 
          resourceDataLength
        );
        
        // Read resource name if present
        let name: string | undefined;
        if (nameOffset !== -1) {
          const namePos = mapOffset + nameListOffset + nameOffset;
          const nameLength = data[namePos];
          // Use latin1 as a fallback for macroman encoding
          name = new TextDecoder('latin1').decode(
            data.slice(namePos + 1, namePos + 1 + nameLength)
          );
        }
        
        const resource: Resource = {
          type: typeName,
          id,
          data: resourceData,
          name,
          flags: attributes,
          junk: 0,
          order: 0xFFFFFFFF
        };
        
        typeResources.set(id, resource);
      }
      
      resources.set(typeName, typeResources);
    }
    
    return {
      resources,
      fileAttributes: 0,
      junkNextresmap: 0,
      junkFilerefnum: 0
    };
  }
}