/**
 * Advanced usage examples for rsrcdump-ts
 */

import { readFile, writeFile } from 'fs/promises';
import {
  load,
  saveToJson,
  loadBytesFromJsonAsync,
  isOk,
  resourceForkToString,
  getStandardConverters,
  structTemplateFromStringWithTypename,
  StructConverter,
  type ResourceFork,
} from '../build/index.js';

/**
 * Example 1: Custom struct specifications
 */
async function customStructSpecs() {
  console.log('=== Example 1: Custom Struct Specifications ===\n');
  
  const data = await readFile('../EarthFarm.ter.rsrc');
  
  // Define custom struct specs for Otto Matic terrain files
  const structSpecs = [
    'Hedr:L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters',
    'YCrd:f+',
    'FnNb:ii+:x,z'
  ];
  
  const result = await saveToJson(new Uint8Array(data), structSpecs);
  
  if (isOk(result)) {
    const parsed = JSON.parse(result.value);
    console.log('Hedr resource:', parsed.Hedr?.['1000']?.obj);
    console.log('\nYCrd resource (first 5 floats):', parsed.YCrd?.['1000']?.obj?.slice(0, 5));
    console.log('\nFnNb resource (first 3 pairs):', parsed.FnNb?.['1000']?.obj?.slice(0, 3));
  }
}

/**
 * Example 2: Error handling with Result types
 */
async function errorHandlingExample() {
  console.log('\n=== Example 2: Error Handling ===\n');
  
  // Try loading a non-existent file
  const result = await load('/nonexistent/file.rsrc');
  
  if (isOk(result)) {
    console.log('Unexpected success');
  } else {
    console.log('Expected error caught:', result.error);
  }
  
  // Try loading valid data
  const validResult = await load('../EarthFarm.ter.rsrc');
  
  if (isOk(validResult)) {
    console.log('✓ Successfully loaded valid file');
    console.log(resourceForkToString(validResult.value));
  }
}

/**
 * Example 3: Working with custom converters
 */
async function customConverterExample() {
  console.log('\n=== Example 3: Custom Converters ===\n');
  
  const converters = getStandardConverters();
  
  // Add a custom struct converter
  const templateResult = await structTemplateFromStringWithTypename('Hedr:L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters');
  
  if (isOk(templateResult)) {
    const { converter, restype } = templateResult.value;
    const typeKey = Buffer.from(restype).toString('binary');
    converters.set(typeKey, new StructConverter(converter));
    
    console.log(`Added custom converter for type: ${Buffer.from(restype).toString('latin1')}`);
  }
  
  console.log(`Total converters: ${converters.size}`);
}

/**
 * Example 4: Filtering resources
 */
async function filterResourcesExample() {
  console.log('\n=== Example 4: Filtering Resources ===\n');
  
  const data = await readFile('../EarthFarm.ter.rsrc');
  
  // Extract only specific resource types
  const includeTypes = ['Hedr', 'alis'];
  const result = await saveToJson(new Uint8Array(data), [], includeTypes);
  
  if (isOk(result)) {
    const parsed = JSON.parse(result.value);
    const types = Object.keys(parsed).filter(k => k !== '_metadata');
    console.log('Included types:', types);
  }
  
  // Exclude specific types
  const excludeTypes = ['SpPt', 'SpNb'];
  const result2 = await saveToJson(new Uint8Array(data), [], [], excludeTypes);
  
  if (isOk(result2)) {
    const parsed = JSON.parse(result2.value);
    const types = Object.keys(parsed).filter(k => k !== '_metadata');
    console.log('After exclusion:', types);
  }
}

/**
 * Example 5: Resource inspection
 */
async function inspectResourcesExample() {
  console.log('\n=== Example 5: Resource Inspection ===\n');
  
  const result = await load('../EarthFarm.ter.rsrc');
  
  if (isOk(result)) {
    const fork = result.value;
    
    // Iterate over all resource types
    for (const [typeKey, typeMap] of fork.tree) {
      const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
      console.log(`\n${typeStr}:`);
      
      // Show first 3 resources of this type
      let count = 0;
      for (const [resId, resource] of typeMap) {
        if (count++ >= 3) break;
        
        const name = Buffer.from(resource.name).toString('latin1');
        console.log(`  #${resId}: "${name}" (${resource.data.length} bytes, flags: ${resource.flags})`);
      }
      
      if (typeMap.size > 3) {
        console.log(`  ... and ${typeMap.size - 3} more`);
      }
    }
  }
}

/**
 * Example 6: Modify and recreate
 */
async function modifyAndRecreateExample() {
  console.log('\n=== Example 6: Modify and Recreate ===\n');
  
  // Load original
  const data = await readFile('../EarthFarm.ter.rsrc');
  const jsonResult = await saveToJson(new Uint8Array(data));
  
  if (!isOk(jsonResult)) {
    console.error('Failed to load:', jsonResult.error);
    return;
  }
  
  // Modify
  const parsed = JSON.parse(jsonResult.value);
  console.log('Original metadata:', parsed._metadata);
  
  // In a real scenario, you might modify resource data here
  // For example: parsed.Hedr['1000'].obj.width = 200;
  
  // Recreate
  const bytesResult = await loadBytesFromJsonAsync(parsed);
  
  if (isOk(bytesResult)) {
    console.log('✓ Successfully recreated resource fork');
    console.log(`  Size: ${bytesResult.value.length} bytes`);
    
    // You could save it: await writeFile('modified.rsrc', bytesResult.value);
  }
}

// Run all examples
async function main() {
  try {
    await customStructSpecs();
    await errorHandlingExample();
    await customConverterExample();
    await filterResourcesExample();
    await inspectResourcesExample();
    await modifyAndRecreateExample();
    
    console.log('\n=== All examples completed ===\n');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
