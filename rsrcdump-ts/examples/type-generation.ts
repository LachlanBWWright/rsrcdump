/**
 * Example: Using the new TypeScript type generation feature
 */

import { generateTypesFromSpecs, structTemplateFromString, isOk } from '../dist/index.js';

// Define struct specs
const specs = new Map<string, string>([
  ['Hedr', '>LHHffffff:version,itemCount,width,height,minY,maxY,tileSize,minX,maxZ'],
  ['Itms', '>LLHbbbbH+:x,z,type,param0,param1,param2,param3,flags'],
  ['Spln', '>HHLLLHHLhhhh+:numNubs,,,numPoints,,numItems,,,bbTop,bbLeft,bbBottom,bbRight'],
  ['YCrd', '>f+'],
]);

console.log('Generating TypeScript types from struct specs...\n');

// Generate types with camelCase
const camelResult = generateTypesFromSpecs(specs, true);
if (isOk(camelResult)) {
  console.log('=== CamelCase Version ===\n');
  console.log(camelResult.value);
  console.log('\n');
}

// Generate types with snake_case
const snakeResult = generateTypesFromSpecs(specs, false);
if (isOk(snakeResult)) {
  console.log('=== Snake_case Version ===\n');
  console.log(snakeResult.value);
}

// Example of using backtick macros
console.log('\n\n=== Backtick Macro Example ===\n');

const backtickSpec = '>200f:x`y[100]';
const templateResult = structTemplateFromString(backtickSpec);

if (isOk(templateResult)) {
  const template = templateResult.value;
  console.log('Template parsed successfully!');
  console.log(`Format: ${template.format}`);
  console.log(`Fields: ${template.fieldFormats.length}`);
  console.log(`Backtick groups: ${template.backtickGroups.length}`);
  
  if (template.backtickGroups.length > 0) {
    const group = template.backtickGroups[0];
    console.log(`\nBacktick group details:`);
    console.log(`  Base name: ${group?.baseName}`);
    console.log(`  Count: ${group?.count}`);
    console.log(`  Fields per item: ${group?.fieldsPerItem}`);
    console.log(`\nThis will produce JSON with an array instead of 200 individual fields!`);
    console.log(`  Old format: x_0, y_0, x_1, y_1, ..., x_99, y_99`);
    console.log(`  New format: [{ x: val, y: val }, { x: val, y: val }, ...]`);
  }
}
