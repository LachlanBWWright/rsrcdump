import { decode as bufDecode, latin1Decode, asNumber } from './buffer-utils.js';

function decodeFloat16(half: number): number {
  const sign = (half & 0x8000) === 0 ? 1 : -1;
  const exponent = (half & 0x7c00) >> 10;
  const fraction = half & 0x03ff;

  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction === 0 ? sign * Infinity : NaN;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
}

/**
 * Unpacker for reading binary data sequentially
 */
export class Unpacker {
  private data: Uint8Array;
  private offset: number;

  constructor(data: Uint8Array, offset = 0) {
    this.data = data;
    this.offset = offset;
  }

  /**
   * Unpack data using a format string
   * Format: '>' for big-endian, followed by type chars:
   * - c: char (1 byte)
   * - B: unsigned byte
   * - b: signed byte
   * - ?: boolean (1 byte: 0=false, 1=true)
   * - e: half-precision float (2 bytes)
   * - H: unsigned short (2 bytes)
   * - h: signed short (2 bytes)
   * - L: unsigned long (4 bytes)
   * - l/i: signed long (4 bytes)
   * - Q: unsigned long long (8 bytes)
   * - q: signed long long (8 bytes)
   * - n: ssize_t (8 bytes on 64-bit)
   * - N: size_t (8 bytes on 64-bit)
   * - P: pointer (8 bytes on 64-bit)
   * - f: float (4 bytes)
   * - d: double (8 bytes)
   * - Ns: N bytes as Uint8Array
   */
  unpack(fmt: string): number[] | (number | Uint8Array | boolean)[] {
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.offset,
    );
    const values: (number | Uint8Array | boolean)[] = [];
    let pos = 0;
    let littleEndian = false;

    // Parse format string
    let i = 0;
    while (i < fmt.length) {
      const c = fmt[i];
      if (c === undefined) break;

      if (c === ">" || c === "!") {
        littleEndian = false;
        i++;
        continue;
      } else if (c === "<") {
        littleEndian = true;
        i++;
        continue;
      } else if (c === "@" || c === "=" || c === " ") {
        i++;
        continue;
      }

      // Check for count prefix
      let count = 1;
      const numStart = i;
      while (i < fmt.length) {
        const digit = fmt[i];
        if (!digit || !/[0-9]/.test(digit)) break;
        i++;
      }
      if (i > numStart) {
        count = parseInt(fmt.slice(numStart, i), 10);
      }

      const type = fmt[i];
      if (type === undefined) break;

      if (type === "x") {
        // Padding byte
        pos += count;
      } else if (type === "s") {
        // Byte string
        values.push(
          this.data.slice(this.offset + pos, this.offset + pos + count),
        );
        pos += count;
      } else if (type === "c") {
        // char (1 byte) - returns as Uint8Array
        for (let j = 0; j < count; j++) {
          values.push(this.data.slice(this.offset + pos, this.offset + pos + 1));
          pos += 1;
        }
      } else if (type === "B") {
        for (let j = 0; j < count; j++) {
          values.push(view.getUint8(pos));
          pos += 1;
        }
      } else if (type === "b") {
        for (let j = 0; j < count; j++) {
          values.push(view.getInt8(pos));
          pos += 1;
        }
      } else if (type === "?") {
        for (let j = 0; j < count; j++) {
          values.push(view.getUint8(pos) !== 0);
          pos += 1;
        }
      } else if (type === "e") {
        for (let j = 0; j < count; j++) {
          values.push(decodeFloat16(view.getUint16(pos, littleEndian)));
          pos += 2;
        }
      } else if (type === "H") {
        for (let j = 0; j < count; j++) {
          values.push(view.getUint16(pos, littleEndian));
          pos += 2;
        }
      } else if (type === "h") {
        for (let j = 0; j < count; j++) {
          values.push(view.getInt16(pos, littleEndian));
          pos += 2;
        }
      } else if (type === "L" || type === "I") {
        for (let j = 0; j < count; j++) {
          values.push(view.getUint32(pos, littleEndian));
          pos += 4;
        }
      } else if (type === "l" || type === "i") {
        for (let j = 0; j < count; j++) {
          values.push(view.getInt32(pos, littleEndian));
          pos += 4;
        }
      } else if (type === "Q") {
        for (let j = 0; j < count; j++) {
          values.push(Number(view.getBigUint64(pos, littleEndian)));
          pos += 8;
        }
      } else if (type === "q") {
        for (let j = 0; j < count; j++) {
          values.push(Number(view.getBigInt64(pos, littleEndian)));
          pos += 8;
        }
      } else if (type === "n") {
        // ssize_t - treat as signed 64-bit on 64-bit platforms
        for (let j = 0; j < count; j++) {
          values.push(Number(view.getBigInt64(pos, littleEndian)));
          pos += 8;
        }
      } else if (type === "N") {
        // size_t - treat as unsigned 64-bit on 64-bit platforms
        for (let j = 0; j < count; j++) {
          values.push(Number(view.getBigUint64(pos, littleEndian)));
          pos += 8;
        }
      } else if (type === "P") {
        // void * - treat as unsigned 64-bit on 64-bit platforms
        for (let j = 0; j < count; j++) {
          values.push(Number(view.getBigUint64(pos, littleEndian)));
          pos += 8;
        }
      } else if (type === "f") {
        for (let j = 0; j < count; j++) {
          values.push(view.getFloat32(pos, littleEndian));
          pos += 4;
        }
      } else if (type === "d") {
        for (let j = 0; j < count; j++) {
          values.push(view.getFloat64(pos, littleEndian));
          pos += 8;
        }
      }

      i++;
    }

    this.offset += pos;
    return values;
  }

  seek(offset: number): void {
    this.offset = offset;
  }

  skip(n: number): void {
    this.offset += n;
  }

  read(size: number): Uint8Array {
    const slice = this.data.slice(this.offset, this.offset + size);
    if (slice.length !== size) {
      throw new Error(`Expected ${size} bytes but got ${slice.length}`);
    }
    this.offset += size;
    return slice;
  }

  unpackRawPstr(): Uint8Array {
    const [length] = this.unpack(">B");
    return this.read(asNumber(length));
  }

  unpackPstr(
    encoding = "macroman",
    _errors: "replace" | "ignore" = "replace",
  ): string {
    const [length] = this.unpack(">B");
    const bytes = this.read(asNumber(length));
    // Simplified encoding handling
    if (encoding === "macroman") {
      return latin1Decode(bytes);
    }
    return bufDecode(bytes, encoding);
  }

  eof(): boolean {
    return this.offset >= this.data.length;
  }

  remaining(): number {
    return this.data.length - this.offset;
  }
}
