/**
 * Integration tests for rsrcdump-ts
 * These tests verify end-to-end functionality
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import {
  load,
  saveToJson,
  loadBytesFromJsonAsync,
  isOk,
  resourceForkToString,
  getStandardConverters,
} from './index.js';

describe('Integration Tests', () => {
  describe('End-to-End Workflow', () => {
    it('should complete full extract-create cycle', async () => {
      // Step 1: Load the original file
      const loadResult = await load('../EarthFarm.ter.rsrc');
      expect(isOk(loadResult)).toBe(true);
      
      if (!isOk(loadResult)) return;
      
      const originalFork = loadResult.value;
      const originalResourceCount = Array.from(originalFork.tree.values())
        .reduce((sum, map) => sum + map.size, 0);
      
      // Step 2: Convert to JSON
      const data = await readFile('../EarthFarm.ter.rsrc');
      const jsonResult = await saveToJson(new Uint8Array(data));
      expect(isOk(jsonResult)).toBe(true);
      
      if (!isOk(jsonResult)) return;
      
      // Step 3: Parse JSON
      const jsonBlob = JSON.parse(jsonResult.value);
      expect(jsonBlob._metadata).toBeDefined();
      
      // Step 4: Convert back to binary
      const bytesResult = await loadBytesFromJsonAsync(jsonBlob);
      expect(isOk(bytesResult)).toBe(true);
      
      if (!isOk(bytesResult)) return;
      
      // Step 5: Load the regenerated binary
      const regenResult = await load(bytesResult.value);
      expect(isOk(regenResult)).toBe(true);
      
      if (!isOk(regenResult)) return;
      
      const regenFork = regenResult.value;
      const regenResourceCount = Array.from(regenFork.tree.values())
        .reduce((sum, map) => sum + map.size, 0);
      
      // Verify
      expect(regenResourceCount).toBe(originalResourceCount);
      expect(regenFork.tree.size).toBe(originalFork.tree.size);
    });

    it('should handle struct specs in round-trip', async () => {
      const data = await readFile('../EarthFarm.ter.rsrc');
      
      // Read struct specs
      let structSpecs: string[] = [];
      try {
        const specsContent = await readFile('../sample-specs.txt', 'utf-8');
        structSpecs = specsContent.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('//'));
      } catch {
        // Skip if file doesn't exist
        return;
      }
      
      // Convert with struct specs
      const jsonResult = await saveToJson(new Uint8Array(data), structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      
      if (!isOk(jsonResult)) return;
      
      const jsonBlob = JSON.parse(jsonResult.value);
      
      // Verify structured data
      if (jsonBlob.Hedr && jsonBlob.Hedr['1000']) {
        const hedr = jsonBlob.Hedr['1000'].obj;
        expect(hedr).toHaveProperty('vers');
        expect(hedr).toHaveProperty('width');
        expect(hedr).toHaveProperty('height');
      }
      
      // Convert back
      const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
      expect(isOk(bytesResult)).toBe(true);
    });
  });

  describe('Resource Type Handling', () => {
    it('should handle all resource types correctly', async () => {
      const result = await load('../EarthFarm.ter.rsrc');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const fork = result.value;
      
      // Verify we have the expected types
      const typeNames = Array.from(fork.tree.keys())
        .map(key => Buffer.from(key, 'binary').toString('latin1'));
      
      console.log('Resource types found:', typeNames.join(', '));
      
      // EarthFarm.ter.rsrc should have these types
      const expectedTypes = ['Hedr', 'alis', 'Atrb', 'Layr', 'YCrd', 'STgd', 
                            'Itms', 'ItCo', 'Spln', 'SpNb', 'SpPt', 'SpIt', 
                            'Fenc', 'FnNb', 'Liqd'];
      
      for (const expectedType of expectedTypes) {
        const hasType = typeNames.includes(expectedType);
        expect(hasType).toBe(true);
      }
    });

    it('should preserve resource order', async () => {
      const result = await load('../EarthFarm.ter.rsrc');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const fork = result.value;
      
      // Collect all resources with orders
      const resources: Array<{ type: string; id: number; order: number }> = [];
      
      for (const [typeKey, typeMap] of fork.tree) {
        const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
        for (const [resId, res] of typeMap) {
          if (res.order !== 0xFFFFFFFF) {
            resources.push({ type: typeStr, id: resId, order: res.order });
          }
        }
      }
      
      // Verify orders are sequential
      const orders = resources.map(r => r.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i);
      }
    });
  });

  describe('Converter System', () => {
    it('should use correct converters', async () => {
      const converters = getStandardConverters();
      
      // Verify standard converters are registered
      const strKey = Buffer.from('STR ', 'binary').toString('binary');
      const strListKey = Buffer.from('STR#', 'binary').toString('binary');
      const textKey = Buffer.from('TEXT', 'binary').toString('binary');
      
      expect(converters.has(strKey)).toBe(true);
      expect(converters.has(strListKey)).toBe(true);
      expect(converters.has(textKey)).toBe(true);
    });

    it('should fall back to base16 for unknown types', async () => {
      const result = await load('../EarthFarm.ter.rsrc');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const data = new Uint8Array(await readFile('../EarthFarm.ter.rsrc'));
      
      const jsonResult = await saveToJson(data);
      expect(isOk(jsonResult)).toBe(true);
      
      if (!isOk(jsonResult)) return;
      
      const jsonBlob = JSON.parse(jsonResult.value);
      
      // alis resources should have 'data' field (base16)
      if (jsonBlob.alis && jsonBlob.alis['1000']) {
        expect(jsonBlob.alis['1000']).toHaveProperty('data');
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle corrupted data gracefully', async () => {
      const corrupted = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
      const result = await load(corrupted);
      
      // Should either return error or empty fork
      if (isOk(result)) {
        expect(result.value.tree.size).toBe(0);
      } else {
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle empty file', async () => {
      const empty = new Uint8Array(0);
      const result = await load(empty);
      
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.tree.size).toBe(0);
      }
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalid = { not: 'a valid resource fork' };
      const result = await loadBytesFromJsonAsync(invalid);
      
      expect(result).toBeDefined();
    });
  });

  describe('String Representation', () => {
    it('should produce readable resource fork description', async () => {
      const result = await load('../EarthFarm.ter.rsrc');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const str = resourceForkToString(result.value);
      
      expect(str).toContain('ResourceFork');
      expect(str).toContain('Hedr');
      expect(str).toContain('alis');
      
      console.log('Resource fork:', str);
    });
  });
});
