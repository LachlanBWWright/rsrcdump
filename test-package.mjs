import { load, isOk } from './rsrcdump-ts/build/index.js';

console.log('Testing rsrcdump-ts package...');

const result = await load('./EarthFarm.ter.rsrc');

if (isOk(result)) {
  const fork = result.value;
  console.log(`✓ Successfully loaded resource fork with ${fork.tree.size} resource types`);
  
  let totalResources = 0;
  for (const [_, typeMap] of fork.tree) {
    totalResources += typeMap.size;
  }
  console.log(`✓ Total resources: ${totalResources}`);
  console.log('✓ Package works correctly!');
} else {
  console.error('✗ Failed to load:', result.error);
  process.exit(1);
}
