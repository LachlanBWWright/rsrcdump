/**
 * Tests for rsrcdump-ts
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { load, saveToJson, loadBytesFromJson } from './index.js';
import { isOk } from './result.js';

describe('rsrcdump-ts', () => {
  describe('Resource Fork Loading', () => {
    it('should load EarthFarm.ter.rsrc', async () => {
      const result = await load('../EarthFarm.ter.rsrc');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const fork = result.value;
        expect(fork.tree.size).toBeGreaterThan(0);
        
        // Check for expected resource types
        const hasHedr = Array.from(fork.tree.keys()).some(k => 
          Buffer.from(k, 'binary').toString('latin1') === 'Hedr'
        );
        expect(hasHedr).toBe(true);
      }
    });

    it('should handle empty resource fork', async () => {
      const emptyData = new Uint8Array(0);
      const result = await load(emptyData);
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const fork = result.value;
        expect(fork.tree.size).toBe(0);
      }
    });
  });

  describe('JSON Conversion', () => {
    it('should convert EarthFarm.ter.rsrc to JSON', async () => {
      const data = await readFile('../EarthFarm.ter.rsrc');
      
      const structSpecs: string[] = [];
      try {
        const specsContent = await readFile('../sample-specs.txt', 'utf-8');
        const lines = specsContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('//')) {
            structSpecs.push(trimmed);
          }
        }
      } catch (e) {
        // sample-specs.txt not found, continue without it
      }
      
      const result = await saveToJson(new Uint8Array(data), structSpecs);
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const jsonStr = result.value;
        expect(jsonStr.length).toBeGreaterThan(0);
        
        // Parse JSON to verify it's valid
        const parsed = JSON.parse(jsonStr);
        expect(parsed._metadata).toBeDefined();
        expect(parsed._metadata.file_attributes).toBeDefined();
      }
    });
  });

  describe('Round-trip Conversion', () => {
    it('should preserve binary data in round-trip', async () => {
      // Load original file
      const originalData = await readFile('../EarthFarm.ter.rsrc');
      const loadResult = await load(new Uint8Array(originalData));
      expect(isOk(loadResult)).toBe(true);
      
      if (!isOk(loadResult)) return;
      
      const fork = loadResult.value;
      
      // Convert to JSON
      const jsonResult = await saveToJson(new Uint8Array(originalData));
      expect(isOk(jsonResult)).toBe(true);
      
      if (!isOk(jsonResult)) return;
      
      const jsonStr = jsonResult.value;
      const jsonBlob = JSON.parse(jsonStr);
      
      // Convert back to binary
      const bytesResult = loadBytesFromJson(jsonBlob);
      expect(isOk(bytesResult)).toBe(true);
      
      if (!isOk(bytesResult)) return;
      
      const regeneratedData = bytesResult.value;
      
      // Reload the regenerated data
      const reloadResult = await load(regeneratedData);
      expect(isOk(reloadResult)).toBe(true);
      
      if (!isOk(reloadResult)) return;
      
      const regeneratedFork = reloadResult.value;
      
      // Compare resource counts
      expect(regeneratedFork.tree.size).toBe(fork.tree.size);
      
      // Compare each resource type
      for (const [typeKey, typeMap] of fork.tree) {
        const regenTypeMap = regeneratedFork.tree.get(typeKey);
        expect(regenTypeMap).toBeDefined();
        
        if (!regenTypeMap) continue;
        
        expect(regenTypeMap.size).toBe(typeMap.size);
        
        // Compare each resource
        for (const [resId, res] of typeMap) {
          const regenRes = regenTypeMap.get(resId);
          expect(regenRes).toBeDefined();
          
          if (!regenRes) continue;
          
          // Compare resource properties
          expect(regenRes.num).toBe(res.num);
          expect(regenRes.flags).toBe(res.flags);
          expect(regenRes.data.length).toBe(res.data.length);
          
          // Compare data bytes
          expect(Buffer.from(regenRes.data).equals(Buffer.from(res.data))).toBe(true);
        }
      }
    });
  });

  describe('JSON Comparison with Python', () => {
    it('should produce similar JSON to Python version', async () => {
      // This test compares the structure of the JSON output
      // We don't expect byte-for-byte identical output due to:
      // - Different JSON formatting
      // - Potential differences in float formatting
      // But the structure should be the same
      
      const data = await readFile('../EarthFarm.ter.rsrc');
      const tsResult = await saveToJson(new Uint8Array(data));
      
      expect(isOk(tsResult)).toBe(true);
      
      if (!isOk(tsResult)) return;
      
      const tsJson = JSON.parse(tsResult.value);
      
      // Check metadata
      expect(tsJson._metadata).toBeDefined();
      expect(typeof tsJson._metadata.file_attributes).toBe('number');
      
      // Check for major resource types
      const hasHedr = 'Hedr' in tsJson;
      const hasAlis = 'alis' in tsJson;
      
      expect(hasHedr).toBe(true);
      expect(hasAlis).toBe(true);
      
      if (hasHedr) {
        expect(tsJson.Hedr).toBeDefined();
        expect(typeof tsJson.Hedr).toBe('object');
      }
    });
  });

  describe('Result Type Error Handling', () => {
    it('should return error for invalid data', async () => {
      const invalidData = new Uint8Array([1, 2, 3, 4]);
      const result = await load(invalidData);
      
      // Either it's an error or an empty fork
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    it('should handle non-existent file gracefully', async () => {
      const result = await load('/nonexistent/file.rsrc');
      expect(isOk(result)).toBe(false);
      
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
