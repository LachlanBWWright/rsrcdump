/**
 * Performance tests for rsrcdump-ts
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { load, saveToJson, loadBytesFromJsonAsync, isOk } from './index.js';

describe('Performance', () => {
  it('should load resource fork in reasonable time', async () => {
    const start = Date.now();
    
    const result = await load('../EarthFarm.ter.rsrc');
    
    const elapsed = Date.now() - start;
    
    expect(isOk(result)).toBe(true);
    expect(elapsed).toBeLessThan(1000); // Should load in under 1 second
    
    console.log(`Load time: ${elapsed}ms`);
  });

  it('should convert to JSON in reasonable time', async () => {
    const data = await readFile('../EarthFarm.ter.rsrc');
    
    const start = Date.now();
    
    const result = await saveToJson(new Uint8Array(data));
    
    const elapsed = Date.now() - start;
    
    expect(isOk(result)).toBe(true);
    expect(elapsed).toBeLessThan(5000); // Should convert in under 5 seconds
    
    console.log(`JSON conversion time: ${elapsed}ms`);
  });

  it('should perform round-trip in reasonable time', async () => {
    const data = await readFile('../EarthFarm.ter.rsrc');
    
    const start = Date.now();
    
    // Extract to JSON
    const jsonResult = await saveToJson(new Uint8Array(data));
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;
    
    // Convert back to binary
    const jsonBlob = JSON.parse(jsonResult.value);
    const bytesResult = await loadBytesFromJsonAsync(jsonBlob);
    expect(isOk(bytesResult)).toBe(true);
    if (!isOk(bytesResult)) return;
    
    // Extract again
    const secondJsonResult = await saveToJson(bytesResult.value);
    expect(isOk(secondJsonResult)).toBe(true);
    
    const elapsed = Date.now() - start;
    
    expect(elapsed).toBeLessThan(10000); // Should complete in under 10 seconds
    
    console.log(`Round-trip time: ${elapsed}ms`);
  });

  it('should handle multiple loads efficiently', async () => {
    const iterations = 10;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const result = await load('../EarthFarm.ter.rsrc');
      const elapsed = Date.now() - start;
      
      expect(isOk(result)).toBe(true);
      times.push(elapsed);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);
    
    console.log(`Multiple loads (${iterations} iterations):`);
    console.log(`  Average: ${avgTime.toFixed(1)}ms`);
    console.log(`  Min: ${minTime}ms`);
    console.log(`  Max: ${maxTime}ms`);
    
    expect(avgTime).toBeLessThan(1000);
  });

  it('should handle large resource efficiently', async () => {
    const result = await load('../EarthFarm.ter.rsrc');
    expect(isOk(result)).toBe(true);
    
    if (!isOk(result)) return;
    
    const fork = result.value;
    
    // Find the largest resource
    let largestSize = 0;
    let largestType = '';
    let largestId = 0;
    
    for (const [typeKey, typeMap] of fork.tree) {
      for (const [resId, res] of typeMap) {
        if (res.data.length > largestSize) {
          largestSize = res.data.length;
          largestType = Buffer.from(typeKey, 'binary').toString('latin1');
          largestId = resId;
        }
      }
    }
    
    console.log(`Largest resource: ${largestType} #${largestId} (${largestSize} bytes)`);
    expect(largestSize).toBeGreaterThan(0);
  });
});
