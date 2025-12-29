/**
 * Test for STgd struct format bug
 * The format "x?H" should be 4 bytes (1 padding + 1 boolean + 2 short)
 * but was incorrectly calculated as 3 bytes due to missing '?' in calcsize
 */

import { describe, it, expect } from 'vitest';
import { calcsize } from './packutils.js';
import { structTemplateFromString } from './structtemplate.js';
import { isOk } from './result.js';

describe('STgd struct format bug', () => {
  it('should calculate correct size for boolean type (?)', () => {
    // Test individual types
    expect(calcsize('>x')).toBe(1);  // padding: 1 byte
    expect(calcsize('>?')).toBe(1);  // boolean: 1 byte
    expect(calcsize('>H')).toBe(2);  // ushort: 2 bytes
    
    // Test combined format
    expect(calcsize('>x?H')).toBe(4);  // Should be 4 total bytes
  });

  it('should parse STgd struct spec correctly', () => {
    const spec = 'x?H+:isEmpty,superTileId';
    const result = structTemplateFromString(spec);
    
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const template = result.value;
      expect(template.recordLength).toBe(4);  // Should be 4 bytes, not 3
      expect(template.fieldFormats).toEqual(['x', '?', 'H']);
      expect(template.isList).toBe(true);
    }
  });

  it('should correctly parse multiple booleans', () => {
    expect(calcsize('>3?')).toBe(3);  // 3 booleans: 3 bytes
    expect(calcsize('>?B?')).toBe(3);  // bool + byte + bool: 3 bytes
  });
});
