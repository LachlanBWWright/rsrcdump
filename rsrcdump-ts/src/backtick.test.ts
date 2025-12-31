/**
 * Tests for backtick macro array handling
 */

import { describe, it, expect } from 'vitest';
import { structTemplateFromString, unpackRecord } from './structtemplate';
import { isOk } from './result';
import { isRecord, isArray } from './buffer-utils';

describe('backtick arrays', () => {
  it('detects backtick groups in struct templates', () => {
    const result = structTemplateFromString('>200f:x`y[100]');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    expect(template.backtickGroups).toHaveLength(1);
    expect(template.backtickGroups[0]?.baseName).toBe('x`y');
    expect(template.backtickGroups[0]?.count).toBe(100);
    expect(template.backtickGroups[0]?.fieldsPerItem).toBe(2);
  });

  it('converts backtick groups to arrays by default', () => {
    const result = structTemplateFromString('>4f:x`y[2]');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    
    // Create test data: 4 floats
    const data = new Uint8Array(16);
    const view = new DataView(data.buffer);
    view.setFloat32(0, 1.0, false);   // x_0
    view.setFloat32(4, 2.0, false);   // y_0
    view.setFloat32(8, 3.0, false);   // x_1
    view.setFloat32(12, 4.0, false);  // y_1
    
    const unpackResult = unpackRecord(template, data, 0, { useBacktickArrays: true });
    expect(isOk(unpackResult)).toBe(true);
    if (!isOk(unpackResult)) return;
    
    const obj = unpackResult.value;
    expect(isRecord(obj)).toBe(true);
    if (!isRecord(obj)) return;
    
    expect(obj['x`y']).toBeDefined();
    const xyArray = obj['x`y'];
    expect(isArray(xyArray)).toBe(true);
    if (!isArray(xyArray)) return;
    
    expect(xyArray).toHaveLength(2);
    
    // Check first item
    expect(xyArray[0]).toHaveProperty('x', 1.0);
    expect(xyArray[0]).toHaveProperty('y', 2.0);
    
    // Check second item
    expect(xyArray[1]).toHaveProperty('x', 3.0);
    expect(xyArray[1]).toHaveProperty('y', 4.0);
  });

  it('handles single-field backtick arrays', () => {
    const result = structTemplateFromString('>4f:values[4]');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    
    // Create test data: 4 floats
    const data = new Uint8Array(16);
    const view = new DataView(data.buffer);
    view.setFloat32(0, 1.5, false);
    view.setFloat32(4, 2.5, false);
    view.setFloat32(8, 3.5, false);
    view.setFloat32(12, 4.5, false);
    
    const unpackResult = unpackRecord(template, data, 0, { useBacktickArrays: true });
    expect(isOk(unpackResult)).toBe(true);
    if (!isOk(unpackResult)) return;
    
    const obj = unpackResult.value;
    expect(isRecord(obj)).toBe(true);
    if (!isRecord(obj)) return;
    
    expect(obj.values).toBeDefined();
    expect(Array.isArray(obj.values)).toBe(true);
    expect(obj.values).toEqual([1.5, 2.5, 3.5, 4.5]);
  });

  it('handles three-field backtick arrays', () => {
    const result = structTemplateFromString('>6H:x`y`z[2]');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    
    // Create test data: 6 shorts
    const data = new Uint8Array(12);
    const view = new DataView(data.buffer);
    view.setUint16(0, 10, false);  // x_0
    view.setUint16(2, 20, false);  // y_0
    view.setUint16(4, 30, false);  // z_0
    view.setUint16(6, 40, false);  // x_1
    view.setUint16(8, 50, false);  // y_1
    view.setUint16(10, 60, false); // z_1
    
    const unpackResult = unpackRecord(template, data, 0, { useBacktickArrays: true });
    expect(isOk(unpackResult)).toBe(true);
    if (!isOk(unpackResult)) return;
    
    const obj = unpackResult.value;
    expect(isRecord(obj)).toBe(true);
    if (!isRecord(obj)) return;
    
    expect(obj['x`y`z']).toBeDefined();
    const xyzArray = obj['x`y`z'];
    expect(isArray(xyzArray)).toBe(true);
    if (!isArray(xyzArray)) return;
    
    expect(xyzArray).toHaveLength(2);
    
    // Check items
    expect(xyzArray[0]).toEqual({ x: 10, y: 20, z: 30 });
    expect(xyzArray[1]).toEqual({ x: 40, y: 50, z: 60 });
  });

  it('preserves non-backtick fields alongside backtick arrays', () => {
    const result = structTemplateFromString('>HHHH:count,x`y[1],extra');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    
    // Create test data: 4 shorts
    const data = new Uint8Array(8);
    const view = new DataView(data.buffer);
    view.setUint16(0, 99, false);   // count
    view.setUint16(2, 10, false);   // x_0
    view.setUint16(4, 20, false);   // y_0
    view.setUint16(6, 77, false);   // extra
    
    const unpackResult = unpackRecord(template, data, 0, { useBacktickArrays: true });
    expect(isOk(unpackResult)).toBe(true);
    if (!isOk(unpackResult)) return;
    
    const obj = unpackResult.value;
    expect(isRecord(obj)).toBe(true);
    if (!isRecord(obj)) return;
    
    expect(obj.count).toBe(99);
    expect(obj['x`y']).toEqual([{ x: 10, y: 20 }]);
    expect(obj.extra).toBe(77);
  });

  it('can disable backtick arrays', () => {
    const result = structTemplateFromString('>4f:x`y[2]');
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    
    const template = result.value;
    
    // Create test data: 4 floats
    const data = new Uint8Array(16);
    const view = new DataView(data.buffer);
    view.setFloat32(0, 1.0, false);
    view.setFloat32(4, 2.0, false);
    view.setFloat32(8, 3.0, false);
    view.setFloat32(12, 4.0, false);
    
    const unpackResult = unpackRecord(template, data, 0, { useBacktickArrays: false });
    expect(isOk(unpackResult)).toBe(true);
    if (!isOk(unpackResult)) return;
    
    const obj = unpackResult.value;
    expect(isRecord(obj)).toBe(true);
    if (!isRecord(obj)) return;
    
    // With backtick arrays disabled, should use old format
    expect(obj.x_0).toBe(1.0);
    expect(obj.y_0).toBe(2.0);
    expect(obj.x_1).toBe(3.0);
    expect(obj.y_1).toBe(4.0);
  });
});
