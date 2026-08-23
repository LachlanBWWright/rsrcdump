/**
 * Tests for struct template parsing
 */

import { describe, it, expect } from 'vitest';
import { structTemplateFromString, unpackRecord } from './structtemplate.js';
import { isOk } from './result.js';
import { Packer } from './packutils.js';
import { isRecord, isArray, isNumber } from './buffer-utils.js';

describe("StructTemplate parsing and unpacking", () => {
  describe('Format Parsing', () => {
    it('should parse simple format with field names', () => {
      const result = structTemplateFromString('L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const template = result.value;
        expect(template.isList).toBe(false);
        expect(template.isScalar).toBe(false);
        expect(template.fieldNames).toContain('vers');
        expect(template.fieldNames).toContain('items');
        expect(template.fieldNames).toContain('width');
      }
    });

    it('should parse list format', () => {
      const result = structTemplateFromString('ii+:x,z');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const template = result.value;
        expect(template.isList).toBe(true);
        expect(template.fieldNames).toEqual(['x', 'z']);
      }
    });

    it('should parse scalar format (single field, no names)', () => {
      const result = structTemplateFromString('f+');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const template = result.value;
        expect(template.isList).toBe(true);
        expect(template.isScalar).toBe(true);
        expect(template.fieldNames).toEqual([]);
      }
    });

    it('should parse format without field names', () => {
      const result = structTemplateFromString('ii+');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        const template = result.value;
        expect(template.isList).toBe(true);
        expect(template.isScalar).toBe(false);
        // Fallback field names are created for multi-field records
        expect(template.fieldNames.length).toBe(2);
        // But they should all start with .field
        expect(template.fieldNames.every(n => n?.startsWith('.field'))).toBe(true);
      }
    });

    it('should add big-endian prefix if not present', () => {
      const result = structTemplateFromString('LL');
      expect(isOk(result)).toBe(true);
      
      if (isOk(result)) {
        expect(result.value.format).toMatch(/^>/);
      }
    });
  });

  describe('Unpacking', () => {
    it('should unpack a simple record with names', () => {
      const result = structTemplateFromString('ii:x,z');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const packer = new Packer();
      const data = packer.pack('>ii', 409, 2057);
      
      const unpackResult = unpackRecord(template, data, 0);
      expect(isOk(unpackResult)).toBe(true);
      
      if (isOk(unpackResult)) {
        const record = unpackResult.value;
        expect(isRecord(record)).toBe(true);
        if (isRecord(record)) {
          expect(record.x).toBe(409);
          expect(record.z).toBe(2057);
        }
      }
    });

    it('should unpack a scalar', () => {
      const result = structTemplateFromString('f');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const packer = new Packer();
      const data = packer.pack('>f', 3.14);
      
      const unpackResult = unpackRecord(template, data, 0);
      expect(isOk(unpackResult)).toBe(true);
      
      if (isOk(unpackResult)) {
        const value = unpackResult.value;
        expect(isNumber(value)).toBe(true);
        if (isNumber(value)) {
          expect(value).toBeCloseTo(3.14, 2);
        }
      }
    });

    it('should unpack unnamed fields as array', () => {
      const result = structTemplateFromString('ii');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const packer = new Packer();
      const data = packer.pack('>ii', 409, 2057);
      
      const unpackResult = unpackRecord(template, data, 0);
      expect(isOk(unpackResult)).toBe(true);
      
      if (isOk(unpackResult)) {
        const arr = unpackResult.value;
        expect(isArray(arr)).toBe(true);
        if (isArray(arr)) {
          expect(arr[0]).toBe(409);
          expect(arr[1]).toBe(2057);
        }
      }
    });
  });
});
