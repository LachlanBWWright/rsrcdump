/**
 * Tests for all Python struct format types
 */

import { describe, it, expect } from 'vitest';
import { Unpacker, Packer, calcsize } from './packutils.js';
import { asUint8Array } from './buffer-utils.js';

describe('Additional Struct Format Types', () => {
  describe('char (c) type', () => {
    it('should unpack char values', () => {
      const data = new Uint8Array([65, 66, 67]); // 'A', 'B', 'C'
      const unpacker = new Unpacker(data);
      const result = unpacker.unpack('>3c');
      expect(result).toHaveLength(3);
      expect(result[0]).toBeInstanceOf(Uint8Array);
      expect(asUint8Array(result[0])[0]).toBe(65);
      expect(asUint8Array(result[1])[0]).toBe(66);
      expect(asUint8Array(result[2])[0]).toBe(67);
    });

    it('should pack char values', () => {
      const packer = new Packer();
      const a = new Uint8Array([65]);
      const b = new Uint8Array([66]);
      const result = packer.pack('>2c', a, b);
      expect(result).toEqual(new Uint8Array([65, 66]));
    });

    it('should calculate correct size for char', () => {
      expect(calcsize('>c')).toBe(1);
      expect(calcsize('>3c')).toBe(3);
    });
  });

  describe('half-precision float (e) type', () => {
    it('should unpack half-precision float values', () => {
      // Half-precision 1.0 = 0x3c00
      const data = new Uint8Array([0x3c, 0x00]);
      const unpacker = new Unpacker(data);
      const result = unpacker.unpack('>e');
      expect(result).toHaveLength(1);
      expect(typeof result[0]).toBe('number');
      expect(result[0]).toBeCloseTo(1.0, 2);
    });

    it('should pack half-precision float values', () => {
      const packer = new Packer();
      const result = packer.pack('>e', 1.0);
      expect(result).toHaveLength(2);
      // Check that it's approximately 0x3c00
      expect(result[0]).toBe(0x3c);
      expect(result[1]).toBe(0x00);
    });

    it('should calculate correct size for half-precision float', () => {
      expect(calcsize('>e')).toBe(2);
      expect(calcsize('>3e')).toBe(6);
    });

    it.each([
      [Infinity, [0x7c, 0x00]],
      [-Infinity, [0xfc, 0x00]],
      [0, [0x00, 0x00]],
      [Number.NaN, [0x7c, 0x01]],
    ])('round-trips the special value %s', (value, expectedBytes) => {
      const packed = new Packer().pack('>e', value);
      expect([...packed]).toEqual(expectedBytes);

      const [unpacked] = new Unpacker(packed).unpack('>e');
      if (Number.isNaN(value)) {
        expect(unpacked).toBeNaN();
        return;
      }
      expect(unpacked).toBe(value);
    });

    it('supports little-endian half-precision values', () => {
      const packed = new Packer().pack('<e', 1);
      expect(packed).toEqual(new Uint8Array([0x00, 0x3c]));
      expect(new Unpacker(packed).unpack('<e')).toEqual([1]);
    });
  });

  describe('ssize_t (n) type', () => {
    it('should unpack ssize_t values', () => {
      // 64-bit signed integer: 123
      const data = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 123]);
      const unpacker = new Unpacker(data);
      const result = unpacker.unpack('>n');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(123);
    });

    it('should pack ssize_t values', () => {
      const packer = new Packer();
      const result = packer.pack('>n', 123);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 123]));
    });

    it('should calculate correct size for ssize_t', () => {
      expect(calcsize('>n')).toBe(8);
      expect(calcsize('>2n')).toBe(16);
    });
  });

  describe('size_t (N) type', () => {
    it('should unpack size_t values', () => {
      // 64-bit unsigned integer: 456
      const data = new Uint8Array([0, 0, 0, 0, 0, 0, 1, 200]);
      const unpacker = new Unpacker(data);
      const result = unpacker.unpack('>N');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(456);
    });

    it('should pack size_t values', () => {
      const packer = new Packer();
      const result = packer.pack('>N', 456);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 1, 200]));
    });

    it('should calculate correct size for size_t', () => {
      expect(calcsize('>N')).toBe(8);
      expect(calcsize('>2N')).toBe(16);
    });
  });

  describe('pointer (P) type', () => {
    it('should unpack pointer values', () => {
      // 64-bit unsigned integer: 789
      const data = new Uint8Array([0, 0, 0, 0, 0, 0, 3, 21]);
      const unpacker = new Unpacker(data);
      const result = unpacker.unpack('>P');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(789);
    });

    it('should pack pointer values', () => {
      const packer = new Packer();
      const result = packer.pack('>P', 789);
      expect(result).toEqual(new Uint8Array([0, 0, 0, 0, 0, 0, 3, 21]));
    });

    it('should calculate correct size for pointer', () => {
      expect(calcsize('>P')).toBe(8);
      expect(calcsize('>2P')).toBe(16);
    });
  });

  describe('Complex format strings', () => {
    it('should handle mixed format with new types', () => {
      // Format: c + e + n = 1 + 2 + 8 = 11 bytes
      expect(calcsize('>ceN')).toBe(11);
    });

    it('should handle counts with new types', () => {
      // Format: 3c + 2e + n = 3 + 4 + 8 = 15 bytes
      expect(calcsize('>3c2en')).toBe(15);
    });
  });
});
