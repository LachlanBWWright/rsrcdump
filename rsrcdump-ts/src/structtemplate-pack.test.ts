/**
 * Tests for struct template parsing
 */

import { describe, it, expect } from 'vitest';
import { structTemplateFromString, unpackRecord, pack } from './structtemplate.js';
import { isOk } from './result.js';

describe("StructTemplate packing and round-trips", () => {
  describe('Packing', () => {
    it('should pack a record with named fields', () => {
      const result = structTemplateFromString('ii:x,z');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const obj = { x: 409, z: 2057 };
      
      const packResult = pack(template, obj);
      expect(isOk(packResult)).toBe(true);
      
      if (isOk(packResult)) {
        expect(packResult.value.length).toBe(8);
      }
    });

    it('should pack a scalar', () => {
      const result = structTemplateFromString('f');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      
      const packResult = pack(template, 3.14);
      expect(isOk(packResult)).toBe(true);
      
      if (isOk(packResult)) {
        expect(packResult.value.length).toBe(4);
      }
    });

    it('should pack unnamed fields from array', () => {
      const result = structTemplateFromString('ii');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const arr = [409, 2057];
      
      const packResult = pack(template, arr);
      expect(isOk(packResult)).toBe(true);
      
      if (isOk(packResult)) {
        expect(packResult.value.length).toBe(8);
      }
    });

    it('should pack a list of records', () => {
      const result = structTemplateFromString('ii+:x,z');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const list = [
        { x: 409, z: 2057 },
        { x: 335, z: 2057 },
        { x: 259, z: 2060 }
      ];
      
      const packResult = pack(template, list);
      expect(isOk(packResult)).toBe(true);
      
      if (isOk(packResult)) {
        expect(packResult.value.length).toBe(24); // 3 records * 8 bytes
      }
    });
  });

  describe('Round-trip', () => {
    it('should round-trip named fields', () => {
      const result = structTemplateFromString('LL:magic,version');
      expect(isOk(result)).toBe(true);
      
      if (!isOk(result)) return;
      
      const template = result.value;
      const original = { magic: 0x00051607, version: 0x00020000 };
      
      const packResult = pack(template, original);
      expect(isOk(packResult)).toBe(true);
      
      if (!isOk(packResult)) return;
      
      const unpackResult = unpackRecord(template, packResult.value, 0);
      expect(isOk(unpackResult)).toBe(true);
      
      if (isOk(unpackResult)) {
        expect(unpackResult.value).toEqual(original);
      }
    });

    it('should round-trip unnamed fields', () => {
      const result = structTemplateFromString('ii');
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const template = result.value;
      const original = [123, 456];

      const packResult = pack(template, original);
      expect(isOk(packResult)).toBe(true);

      if (!isOk(packResult)) return;

      const unpackResult = unpackRecord(template, packResult.value, 0);
      expect(isOk(unpackResult)).toBe(true);

      if (isOk(unpackResult)) {
        expect(unpackResult.value).toEqual(original);
      }
    });

    it('should round-trip boolean fields with ? type', () => {
      const result = structTemplateFromString('?H:isEmpty,id');
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const template = result.value;
      const original = { isEmpty: true, id: 0x0042 };

      const packResult = pack(template, original);
      expect(isOk(packResult)).toBe(true);

      if (!isOk(packResult)) return;

      const unpackResult = unpackRecord(template, packResult.value, 0);
      expect(isOk(unpackResult)).toBe(true);

      if (isOk(unpackResult)) {
        expect(unpackResult.value).toEqual(original);
      }
    });

    it('should handle false boolean values', () => {
      const result = structTemplateFromString('?H:isEmpty,id');
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const template = result.value;
      const original = { isEmpty: false, id: 0x0100 };

      const packResult = pack(template, original);
      expect(isOk(packResult)).toBe(true);

      if (!isOk(packResult)) return;

      const unpackResult = unpackRecord(template, packResult.value, 0);
      expect(isOk(unpackResult)).toBe(true);

      if (isOk(unpackResult)) {
        expect(unpackResult.value).toEqual(original);
      }
    });

    it('should round-trip single boolean field in list format', () => {
      const result = structTemplateFromString('x?H:isEmpty,id');
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const template = result.value;
      const original = { isEmpty: true, id: 0x0001 };

      const packResult = pack(template, original);
      expect(isOk(packResult)).toBe(true);

      if (!isOk(packResult)) return;

      const unpackResult = unpackRecord(template, packResult.value, 0);
      expect(isOk(unpackResult)).toBe(true);

      if (isOk(unpackResult)) {
        expect(unpackResult.value).toEqual(original);
      }
    });
  });
});
