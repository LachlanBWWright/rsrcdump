/**
 * Test for zero value handling bug
 */

import { describe, it, expect } from 'vitest';
import { structTemplateFromString, unpackRecord } from './structtemplate.js';
import { Packer } from './packutils.js';

describe('Zero value handling', () => {
  it('should preserve zero values in named fields', () => {
    // Create a simple struct with values including zero
    const templateResult = structTemplateFromString('>HH:field1,field2');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;
    
    const template = templateResult.value;
    
    // Pack data with first field = 0, second field = 100
    const packer = new Packer();
    const data = packer.pack('>HH', 0, 100);
    
    // Unpack and check
    const result = unpackRecord(template, data, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    const obj = result.value as Record<string, number>;
    console.log('Result:', obj);
    
    // This should pass but currently fails if zero becomes null/undefined
    expect(obj.field1).toBe(0);
    expect(obj.field2).toBe(100);
    expect('field1' in obj).toBe(true);
  });

  it('should preserve zero values in backtick arrays', () => {
    const templateResult = structTemplateFromString('>4H:values[4]');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;
    
    const template = templateResult.value;
    
    // Pack data with zeros and non-zeros
    const packer = new Packer();
    const data = packer.pack('>4H', 0, 10, 0, 20);
    
    // Unpack with backtick arrays enabled
    const result = unpackRecord(template, data, 0, { useBacktickArrays: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    const obj = result.value as Record<string, number[]>;
    console.log('Array result:', obj);
    
    // Should preserve all values including zeros
    expect(obj.values).toEqual([0, 10, 0, 20]);
  });

  it('should preserve zero in scalar values', () => {
    const templateResult = structTemplateFromString('>H');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;
    
    const template = templateResult.value;
    
    // Pack a zero
    const packer = new Packer();
    const data = packer.pack('>H', 0);
    
    // Unpack and check
    const result = unpackRecord(template, data, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    // Scalar value should be 0, not null/undefined
    expect(result.value).toBe(0);
  });

  it('should preserve false boolean values', () => {
    const templateResult = structTemplateFromString('>?:flag');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;
    
    const template = templateResult.value;
    
    // Pack a false boolean (0)
    const packer = new Packer();
    const data = packer.pack('>?', 0);
    
    // Unpack and check
    const result = unpackRecord(template, data, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    const obj = result.value as Record<string, boolean>;
    console.log('Boolean result:', obj);
    
    // Should preserve false, not convert to null/undefined
    expect(obj.flag).toBe(false);
    expect('flag' in obj).toBe(true);
  });

  it('should preserve zero values with empty string field names', () => {
    // Create template where first field has empty name
    const templateResult = structTemplateFromString('>HH:,field2');
    expect(templateResult.ok).toBe(true);
    if (!templateResult.ok) return;
    
    const template = templateResult.value;
    
    // Pack data with first field = 0, second field = 100
    const packer = new Packer();
    const data = packer.pack('>HH', 0, 100);
    
    // Unpack - empty field name should get default name
    const result = unpackRecord(template, data, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    
    const obj = result.value as Record<string, number>;
    console.log('Empty name result:', obj);
    
    // First field should have fallback name and value should be 0
    expect(obj['.field0']).toBe(0);
    expect(obj.field2).toBe(100);
  });
});

