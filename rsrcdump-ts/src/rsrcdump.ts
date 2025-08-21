// Main API for rsrcdump TypeScript library

import type { ResourceFork, ResourceConverter } from './types.js';
import { ResourceForkParser } from './resfork.js';
import { resourceForkToJson } from './jsonio.js';
import { StructConverter, standardConverters } from './resconverters.js';
import { parseTypeName } from './textio.js';
import { unpackAdf, NotADFError, ADF_ENTRYNUM_RESOURCEFORK } from './adf.js';

export function load(data: Uint8Array): ResourceFork {
  try {
    const adfEntries = unpackAdf(data);
    const adfResfork = adfEntries.get(ADF_ENTRYNUM_RESOURCEFORK);
    if (!adfResfork) {
      throw new Error('No resource fork found in ADF');
    }
    return ResourceForkParser.fromBytes(adfResfork);
  } catch (error) {
    if (error instanceof NotADFError) {
      return ResourceForkParser.fromBytes(data);
    }
    throw error;
  }
}

export function saveToJson(
  data: Uint8Array,
  structSpecs: string[] = [],
  includeTypes: string[] = [],
  excludeTypes: string[] = []
): string {
  const fork = load(data);
  
  return resourceForkToJson(
    fork,
    includeTypes.map(parseTypeName),
    excludeTypes.map(parseTypeName),
    getConverters(structSpecs),
    {}
  );
}

function getConverters(structSpecs: string[]): Map<string, ResourceConverter> {
  const converters = new Map(standardConverters);
  
  for (const templateArg of structSpecs) {
    const [converter, restype] = StructConverter.fromTemplateStringWithTypename(templateArg);
    if (converter && restype) {
      const typeName = new TextDecoder('utf-8').decode(restype).trim();
      converters.set(typeName, converter);
    }
  }
  
  return converters;
}

// Re-export types and utilities
export * from './types.js';
export * from './textio.js';
export * from './resfork.js';
export * from './resconverters.js';
export * from './structtemplate.js';
export * from './jsonio.js';