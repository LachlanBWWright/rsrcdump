// JSON input/output handling

import type { ResourceFork, ResourceConverter, JsonOutput, ConvertedResource, Resource } from './types.js';
import { Base16Converter } from './resconverters.js';

export function resourceForkToJson(
  fork: ResourceFork,
  includeTypes: Uint8Array[] = [],
  excludeTypes: Uint8Array[] = [],
  converters: Map<string, ResourceConverter> = new Map(),
  metadata: any = {},
  quiet: boolean = false
): string {
  const jsonBlob: JsonOutput = {};
  
  // Add metadata
  if (metadata || fork.fileAttributes !== undefined) {
    jsonBlob._metadata = {
      junk1: fork.junkNextresmap,
      junk2: fork.junkFilerefnum,
      file_attributes: fork.fileAttributes || 0,
      ...metadata
    };
  }
  
  // Convert each resource type
  for (const [typeName, typeResources] of fork.resources) {
    // Check include/exclude filters
    const typeBytes = new TextEncoder().encode(typeName.padEnd(4));
    
    if (includeTypes.length > 0 && !includeTypes.some(included => 
      typeBytes.every((byte, i) => byte === included[i])
    )) {
      continue;
    }
    
    if (excludeTypes.some(excluded => 
      typeBytes.every((byte, i) => byte === excluded[i])
    )) {
      continue;
    }
    
    jsonBlob[typeName] = {};
    
    for (const [resId, resource] of typeResources) {
      if (!quiet) {
        console.log(`${resource.type.padEnd(4)} ${resId.toString().padStart(6)} ${resource.data.length.toString().padStart(8)}  ${resource.name || ''}`);
      }
      
      const wrapper: ConvertedResource = {};
      
      if (resource.name) {
        wrapper.name = resource.name;
      }
      
      if (resource.flags && resource.flags !== 0) {
        wrapper.flags = resource.flags;
      }
      
      if (resource.junk && resource.junk !== 0) {
        wrapper.junk = resource.junk;
      }
      
      if (resource.order && resource.order !== 0xFFFFFFFF) {
        wrapper.order = resource.order;
      }
      
      // Convert resource data
      try {
        const converter = converters.get(typeName) || new Base16Converter();
        const obj = converter.unpack(resource, fork);
        
        if (converter instanceof Base16Converter) {
          wrapper.data = obj;
        } else {
          wrapper.obj = obj;
        }
      } catch (convertException) {
        wrapper.conversionError = String(convertException);
        // Fall back to base16
        wrapper.data = new Base16Converter().unpack(resource, fork);
      }
      
      jsonBlob[typeName][resId.toString()] = wrapper;
    }
  }
  
  return JSON.stringify(jsonBlob, null, '\t');
}

export function jsonToResourceFork(
  jsonString: string, 
  converters: Map<string, ResourceConverter> = new Map()
): ResourceFork {
  const jsonData: JsonOutput = JSON.parse(jsonString);
  
  const resources = new Map<string, Map<number, Resource>>();
  
  // Extract metadata
  const metadata = jsonData._metadata || {};
  const fileAttributes = metadata.fileAttributes || 0;
  const junkNextresmap = metadata.junk1 || 0;
  const junkFilerefnum = metadata.junk2 || 0;
  
  // Process each resource type
  for (const [typeName, typeData] of Object.entries(jsonData)) {
    if (typeName === '_metadata') continue;
    
    const typeResources = new Map<number, Resource>();
    
    for (const [idStr, resourceData] of Object.entries(typeData as Record<string, ConvertedResource>)) {
      const id = parseInt(idStr, 10);
      
      // Convert resource data back to binary
      let data: Uint8Array;
      
      if (resourceData.obj !== undefined) {
        // Use converter to pack structured data back to binary
        const converter = converters.get(typeName);
        if (converter && converter.pack) {
          data = converter.pack(resourceData.obj);
        } else {
          throw new Error(`No pack function available for resource type ${typeName}`);
        }
      } else if (resourceData.data !== undefined) {
        // Convert hex string back to binary
        const hexStr = resourceData.data;
        const bytes = new Uint8Array(hexStr.length / 2);
        for (let i = 0; i < hexStr.length; i += 2) {
          bytes[i / 2] = parseInt(hexStr.substr(i, 2), 16);
        }
        data = bytes;
      } else {
        throw new Error(`Resource ${typeName}:${id} has neither obj nor data field`);
      }
      
      const resource: Resource = {
        type: typeName,
        id,
        data,
        name: resourceData.name,
        flags: resourceData.flags || 0,
        junk: resourceData.junk || 0,
        order: resourceData.order || 0xFFFFFFFF
      };
      
      typeResources.set(id, resource);
    }
    
    if (typeResources.size > 0) {
      resources.set(typeName, typeResources);
    }
  }
  
  return {
    resources,
    fileAttributes,
    junkNextresmap,
    junkFilerefnum
  };
}