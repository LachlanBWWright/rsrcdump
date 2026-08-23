/**
 * Example: Using JSON format for struct specs
 */

import { jsonSpecToString, jsonSpecsToStrings, isOk } from '../dist/index.js';
import type { StructSpecJson } from '../dist/index.js';

console.log('=== JSON Struct Spec Format Examples ===\n');

// Example 1: Simple struct spec
const pointSpec: StructSpecJson = {
  resourceType: 'Point',
  fields: [
    { name: 'x', type: 'short' },
    { name: 'y', type: 'short' }
  ]
};

const pointResult = jsonSpecToString(pointSpec);
if (isOk(pointResult)) {
  console.log('1. Simple Point Spec:');
  console.log('   JSON:', JSON.stringify(pointSpec, null, 2));
  console.log('   String:', pointResult.value);
  console.log('');
}

// Example 2: List of items
const itemsSpec: StructSpecJson = {
  resourceType: 'Items',
  isList: true,
  fields: [
    { name: 'x', type: 'int' },
    { name: 'z', type: 'int' },
    { name: 'type', type: 'short' },
    { name: 'flags', type: 'short' }
  ]
};

const itemsResult = jsonSpecToString(itemsSpec);
if (isOk(itemsResult)) {
  console.log('2. List of Items:');
  console.log('   String:', itemsResult.value);
  console.log('');
}

// Example 3: Signed integers
const signedSpec: StructSpecJson = {
  resourceType: 'Signed',
  fields: [
    { name: 'byteVal', type: 'byte', signed: true },
    { name: 'shortVal', type: 'short', signed: true },
    { name: 'intVal', type: 'int', signed: true }
  ]
};

const signedResult = jsonSpecToString(signedSpec);
if (isOk(signedResult)) {
  console.log('3. Signed Integers:');
  console.log('   String:', signedResult.value);
  console.log('');
}

// Example 4: Floats and strings
const mixedSpec: StructSpecJson = {
  resourceType: 'Header',
  fields: [
    { name: 'version', type: 'int' },
    { name: 'xPos', type: 'float' },
    { name: 'yPos', type: 'float' },
    { name: 'zPos', type: 'float' },
    { name: 'name', type: 'string', count: 32 }
  ]
};

const mixedResult = jsonSpecToString(mixedSpec);
if (isOk(mixedResult)) {
  console.log('4. Mixed Types with String:');
  console.log('   String:', mixedResult.value);
  console.log('');
}

// Example 5: Padding
const paddedSpec: StructSpecJson = {
  resourceType: 'Padded',
  fields: [
    { name: 'header', type: 'int' },
    { type: 'padding', count: 12 },
    { name: 'footer', type: 'int' }
  ]
};

const paddedResult = jsonSpecToString(paddedSpec);
if (isOk(paddedResult)) {
  console.log('5. With Padding:');
  console.log('   String:', paddedResult.value);
  console.log('');
}

// Example 6: Array fields (backtick macro)
const arraySpec: StructSpecJson = {
  resourceType: 'Coords',
  fields: [
    { name: 'count', type: 'short' },
    { name: 'x', type: 'float', count: 100 },
    { name: 'y', type: 'float', count: 100 }
  ]
};

const arrayResult = jsonSpecToString(arraySpec);
if (isOk(arrayResult)) {
  console.log('6. Array Fields (converted to backtick macro):');
  console.log('   String:', arrayResult.value);
  console.log('');
}

// Example 7: Little endian
const littleEndianSpec: StructSpecJson = {
  resourceType: 'LittleEnd',
  endian: 'little',
  fields: [
    { name: 'value1', type: 'int' },
    { name: 'value2', type: 'long' }
  ]
};

const littleResult = jsonSpecToString(littleEndianSpec);
if (isOk(littleResult)) {
  console.log('7. Little Endian:');
  console.log('   String:', littleResult.value);
  console.log('');
}

// Example 8: Convert multiple specs at once
const multipleSpecs: StructSpecJson[] = [
  pointSpec,
  itemsSpec,
  mixedSpec
];

const multiResult = jsonSpecsToStrings(multipleSpecs);
if (isOk(multiResult)) {
  console.log('8. Multiple Specs Converted:');
  for (const [type, spec] of multiResult.value) {
    console.log(`   ${type}: ${spec}`);
  }
  console.log('');
}

console.log('✓ JSON format is more readable and easier to maintain!');
console.log('✓ Old string format still works for backward compatibility');
