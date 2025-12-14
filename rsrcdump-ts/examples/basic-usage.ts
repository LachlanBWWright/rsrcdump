/**
 * Basic usage examples for rsrcdump-ts
 */

import { readFile } from 'fs/promises';
import {
  load,
  saveToJson,
  loadBytesFromJsonAsync,
  isOk,
  resourceForkToString,
} from '../src/index.js';

/**
 * Example 1: Load and inspect a resource fork
 */
async function example1_loadAndInspect() {
  console.log('=== Example 1: Load and Inspect ===\n');
  
  const result = await load('../EarthFarm.ter.rsrc');
  
  if (isOk(result)) {
    const fork = result.value;
    console.log(resourceForkToString(fork));
    console.log(`\nTotal resource types: ${fork.tree.size}`);
    
    // List all resource types
    for (const [typeKey, typeMap] of fork.tree) {
      const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
      console.log(`  ${typeStr}: ${typeMap.size} resources`);
    }
  } else {
    console.error('Failed to load:', result.error);
  }
}

/**
 * Example 2: Convert to JSON
 */
async function example2_convertToJson() {
  console.log('\n=== Example 2: Convert to JSON ===\n');
  
  const data = await readFile('../EarthFarm.ter.rsrc');
  
  const result = await saveToJson(new Uint8Array(data));
  
  if (isOk(result)) {
    const jsonStr = result.value;
    console.log(`Generated JSON: ${jsonStr.length} bytes`);
    
    // Parse to show structure
    const parsed = JSON.parse(jsonStr);
    console.log(`\nMetadata:`);
    console.log(`  File attributes: ${parsed._metadata.file_attributes}`);
    console.log(`  Resource types: ${Object.keys(parsed).length - 1}`);
  } else {
    console.error('Failed to convert:', result.error);
  }
}

/**
 * Example 3: Round-trip conversion
 */
async function example3_roundTrip() {
  console.log('\n=== Example 3: Round-trip Conversion ===\n');
  
  const data = await readFile('../EarthFarm.ter.rsrc');
  const jsonResult = await saveToJson(new Uint8Array(data));
  
  if (!isOk(jsonResult)) {
    console.error('Failed:', jsonResult.error);
    return;
  }
  
  const jsonBlob = JSON.parse(jsonResult.value);
  const bytesResult = await loadBytesFromJsonAsync(jsonBlob);
  
  if (!isOk(bytesResult)) {
    console.error('Failed:', bytesResult.error);
    return;
  }
  
  const secondJsonResult = await saveToJson(bytesResult.value);
  
  if (!isOk(secondJsonResult)) {
    console.error('Failed:', secondJsonResult.error);
    return;
  }
  
  const match = jsonResult.value === secondJsonResult.value;
  console.log(`Result: Round-trip ${match ? 'SUCCESSFUL ✅' : 'FAILED ❌'}`);
}

// Run all examples
async function main() {
  await example1_loadAndInspect();
  await example2_convertToJson();
  await example3_roundTrip();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
