/**
 * Binary packing and unpacking utilities
 */

import { decode as bufDecode, encode as bufEncode, latin1Decode, latin1Encode } from './buffer-utils.js';

/**
 * Unpacker for reading binary data sequentially
 */
export class Unpacker {
  private data: Uint8Array;
  private offset: number;

  constructor(data: Uint8Array, offset: number = 0) {
    this.data = data;
    this.offset = offset;
  }

  /**
   * Unpack data using a format string
   * Format: '>' for big-endian, followed by type chars:
   * - B: unsigned byte
   * - b: signed byte
   * - ?: boolean (1 byte: 0=false, 1=true)
   * - H: unsigned short (2 bytes)
   * - h: signed short (2 bytes)
   * - L: unsigned long (4 bytes)
   * - l/i: signed long (4 bytes)
   * - Q: unsigned long long (8 bytes)
   * - q: signed long long (8 bytes)
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
    return this.read(length as number);
  }

  unpackPstr(
    encoding: string = "macroman",
    _errors: "replace" | "ignore" = "replace",
  ): string {
    const [length] = this.unpack(">B");
    const bytes = this.read(length as number);
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

/**
 * Packer for writing binary data
 */
export class Packer {
  private buffer: number[] = [];

  /**
   * Pack values using a format string
   */
  pack(fmt: string, ...values: (number | Uint8Array | bigint)[]): Uint8Array {
    let valueIdx = 0;
    let littleEndian = false;
    const bytes: number[] = [];

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
        for (let j = 0; j < count; j++) {
          bytes.push(0);
        }
      } else if (type === "s") {
        const val = values[valueIdx++] as Uint8Array;
        for (let j = 0; j < count; j++) {
          bytes.push(j < val.length ? val[j]! : 0);
        }
      } else if (type === "B") {
        for (let j = 0; j < count; j++) {
          bytes.push((values[valueIdx++] as number) & 0xff);
        }
      } else if (type === "b") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++] as number;
          bytes.push(val < 0 ? val + 256 : val);
        }
      } else if (type === "?") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++];
          bytes.push(val ? 1 : 0);
        }
      } else if (type === "H") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++] as number;
          if (littleEndian) {
            bytes.push(val & 0xff, (val >> 8) & 0xff);
          } else {
            bytes.push((val >> 8) & 0xff, val & 0xff);
          }
        }
      } else if (type === "h") {
        for (let j = 0; j < count; j++) {
          let val = values[valueIdx++] as number;
          if (val < 0) val = val + 65536;
          if (littleEndian) {
            bytes.push(val & 0xff, (val >> 8) & 0xff);
          } else {
            bytes.push((val >> 8) & 0xff, val & 0xff);
          }
        }
      } else if (type === "L" || type === "I") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++] as number;
          if (littleEndian) {
            bytes.push(
              val & 0xff,
              (val >> 8) & 0xff,
              (val >> 16) & 0xff,
              (val >> 24) & 0xff,
            );
          } else {
            bytes.push(
              (val >> 24) & 0xff,
              (val >> 16) & 0xff,
              (val >> 8) & 0xff,
              val & 0xff,
            );
          }
        }
      } else if (type === "l" || type === "i") {
        for (let j = 0; j < count; j++) {
          let val = values[valueIdx++] as number;
          if (val < 0) val = val + 4294967296;
          if (littleEndian) {
            bytes.push(
              val & 0xff,
              (val >> 8) & 0xff,
              (val >> 16) & 0xff,
              (val >> 24) & 0xff,
            );
          } else {
            bytes.push(
              (val >> 24) & 0xff,
              (val >> 16) & 0xff,
              (val >> 8) & 0xff,
              val & 0xff,
            );
          }
        }
      } else if (type === "f") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++] as number;
          const buffer = new ArrayBuffer(4);
          const view = new DataView(buffer);
          view.setFloat32(0, val, littleEndian);
          bytes.push(
            view.getUint8(0),
            view.getUint8(1),
            view.getUint8(2),
            view.getUint8(3),
          );
        }
      } else if (type === "d") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++] as number;
          const buffer = new ArrayBuffer(8);
          const view = new DataView(buffer);
          view.setFloat64(0, val, littleEndian);
          for (let k = 0; k < 8; k++) {
            bytes.push(view.getUint8(k));
          }
        }
      }

      i++;
    }

    return new Uint8Array(bytes);
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Placeholder for writing values that will be filled in later
 */
export class WritePlaceholder {
  private _size: number;
  private committed: boolean = false;

  constructor(stream: { buffer: Uint8Array[]; position: number }, fmt: string) {
    // Calculate size from format
    this._size = this.calcSize(fmt);

    // Write placeholder bytes
    const placeholder = new Uint8Array(this._size).fill(0xca);
    stream.buffer.push(placeholder);
    stream.position += this._size;
  }

  private calcSize(fmt: string): number {
    let size = 0;
    let i = 0;

    while (i < fmt.length) {
      const c = fmt[i];
      if (c === undefined) break;

      if (
        c === ">" ||
        c === "<" ||
        c === "@" ||
        c === "=" ||
        c === "!" ||
        c === " "
      ) {
        i++;
        continue;
      }

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

      if (type === "x" || type === "B" || type === "b" || type === "?") size += count;
      else if (type === "H" || type === "h") size += 2 * count;
      else if (
        type === "L" ||
        type === "I" ||
        type === "l" ||
        type === "i" ||
        type === "f"
      )
        size += 4 * count;
      else if (type === "Q" || type === "q" || type === "d") size += 8 * count;
      else if (type === "s") size += count;

      i++;
    }

    return size;
  }

  commit(_value: number | bigint): void {
    if (this.committed) {
      throw new Error("Already committed");
    }

    // Find and replace the placeholder in the stream
    // This is a simplified version - in practice we'd need to track exact positions
    this.committed = true;
  }
}

/**
 * Packs a Pascal string
 */
export function packPstr(
  text: string,
  padding: number,
  encoding: string = "macroman",
): Uint8Array {
  const encoded = encoding === "macroman" ? latin1Encode(text) : bufEncode(text, encoding);
  const length = Math.min(encoded.length, 255);
  const padCount = (1 + length) % padding;

  const result = new Uint8Array(1 + length + padCount);
  result[0] = length;
  result.set(encoded.slice(0, length), 1);

  return result;
}

/**
 * Calculates the size of a struct format
 */
export function calcsize(fmt: string): number {
  let size = 0;
  let i = 0;

  while (i < fmt.length) {
    const c = fmt[i];
    if (c === undefined) break;

    if (
      c === ">" ||
      c === "<" ||
      c === "@" ||
      c === "=" ||
      c === "!" ||
      c === " "
    ) {
      i++;
      continue;
    }

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

    if (type === "x" || type === "B" || type === "b") size += count;
    else if (type === "H" || type === "h") size += 2 * count;
    else if (
      type === "L" ||
      type === "I" ||
      type === "l" ||
      type === "i" ||
      type === "f"
    )
      size += 4 * count;
    else if (type === "Q" || type === "q" || type === "d") size += 8 * count;
    else if (type === "s") size += count;

    i++;
  }

  return size;
}
