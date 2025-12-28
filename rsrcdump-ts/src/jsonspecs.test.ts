/**
 * Tests for JSON struct spec format
 */

import { describe, it, expect } from 'vitest';
import { jsonSpecToString, jsonSpecsToStrings, StructSpecJson } from './jsonspecs';
import { isOk } from './result';

describe('jsonspecs', () => {
  describe('jsonSpecToString', () => {
    it('converts simple JSON spec to string format', () => {
      const spec: StructSpecJson = {
        resourceType: 'Point',
        fields: [
          { name: 'x', type: 'short' },
          { name: 'y', type: 'short' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      // Unsigned by default (uppercase)
      expect(result.value).toBe('>HH:x,y');
    });

    it('handles list flag', () => {
      const spec: StructSpecJson = {
        resourceType: 'Points',
        isList: true,
        fields: [
          { name: 'x', type: 'short' },
          { name: 'y', type: 'short' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      // Unsigned by default (uppercase)
      expect(result.value).toBe('>HH+:x,y');
    });

    it('handles signed integers', () => {
      const spec: StructSpecJson = {
        resourceType: 'Signed',
        fields: [
          { name: 'a', type: 'byte', signed: true },
          { name: 'b', type: 'short', signed: true },
          { name: 'c', type: 'int', signed: true }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>bhi:a,b,c');
    });

    it('handles unsigned integers', () => {
      const spec: StructSpecJson = {
        resourceType: 'Unsigned',
        fields: [
          { name: 'a', type: 'byte' },
          { name: 'b', type: 'short' },
          { name: 'c', type: 'int' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>BHI:a,b,c');
    });

    it('handles floats and doubles', () => {
      const spec: StructSpecJson = {
        resourceType: 'Floats',
        fields: [
          { name: 'x', type: 'float' },
          { name: 'y', type: 'double' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>fd:x,y');
    });

    it('handles strings', () => {
      const spec: StructSpecJson = {
        resourceType: 'NameRec',
        fields: [
          { name: 'name', type: 'string', count: 32 }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>32s:name');
    });

    it('handles padding', () => {
      const spec: StructSpecJson = {
        resourceType: 'Padded',
        fields: [
          { name: 'a', type: 'short' },
          { type: 'padding', count: 4 },
          { name: 'b', type: 'short' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>H4xH:a,,b');
    });

    it('handles repeat counts for array fields', () => {
      const spec: StructSpecJson = {
        resourceType: 'Array',
        fields: [
          { name: 'values', type: 'int', count: 10 }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>10I:values[10]');
    });

    it('handles little endian', () => {
      const spec: StructSpecJson = {
        resourceType: 'Little',
        endian: 'little',
        fields: [
          { name: 'x', type: 'int' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('<I:x');
    });

    it('handles unnamed fields', () => {
      const spec: StructSpecJson = {
        resourceType: 'Partial',
        fields: [
          { name: 'x', type: 'short' },
          { type: 'short' },
          { name: 'z', type: 'short' }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value).toBe('>HHH:x,,z');
    });

    it('rejects unknown types', () => {
      const spec: StructSpecJson = {
        resourceType: 'Bad',
        fields: [
          { name: 'x', type: 'unknown_type' as any }
        ]
      };

      const result = jsonSpecToString(spec);
      expect(isOk(result)).toBe(false);
    });
  });

  describe('jsonSpecsToStrings', () => {
    it('converts multiple specs', () => {
      const specs: StructSpecJson[] = [
        {
          resourceType: 'Hedr',
          fields: [
            { name: 'version', type: 'int' },
            { name: 'width', type: 'short' },
            { name: 'height', type: 'short' }
          ]
        },
        {
          resourceType: 'Itms',
          isList: true,
          fields: [
            { name: 'x', type: 'short' },
            { name: 'y', type: 'short' }
          ]
        }
      ];

      const result = jsonSpecsToStrings(specs);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;
      
      expect(result.value.size).toBe(2);
      expect(result.value.get('Hedr')).toBe('>IHH:version,width,height');
      expect(result.value.get('Itms')).toBe('>HH+:x,y');
    });

    it('stops on first error', () => {
      const specs: StructSpecJson[] = [
        {
          resourceType: 'Good',
          fields: [{ name: 'x', type: 'int' }]
        },
        {
          resourceType: 'Bad',
          fields: [{ name: 'y', type: 'bad_type' as any }]
        }
      ];

      const result = jsonSpecsToStrings(specs);
      expect(isOk(result)).toBe(false);
      if (isOk(result)) return;
      
      expect(result.error).toContain('Failed to convert spec for Bad');
    });
  });
});
