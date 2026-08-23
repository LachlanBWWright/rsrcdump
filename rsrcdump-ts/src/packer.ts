import { asPackUint8Array, asPackNumber, asPackNumberOrBigint } from "./buffer-utils.js";

function encodeFloat16(value: number): number {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setFloat32(0, value, false);
  const float32 = view.getUint32(0, false);
  const sign = (float32 >> 31) & 1;
  const exponent = (float32 >> 23) & 0xff;
  const fraction = float32 & 0x7fffff;

  if (exponent === 0) return sign << 15;
  if (exponent === 0xff) return (sign << 15) | 0x7c00 | (fraction ? 1 : 0);

  const halfExponent = exponent - 127 + 15;
  if (halfExponent >= 31) return (sign << 15) | 0x7c00;
  if (halfExponent <= 0) return sign << 15;
  return (sign << 15) | (halfExponent << 10) | (fraction >> 13);
}

function appendUint16(bytes: number[], value: number, littleEndian: boolean): void {
  const high = (value >> 8) & 0xff;
  const low = value & 0xff;
  bytes.push(...(littleEndian ? [low, high] : [high, low]));
}

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
        const val = asPackUint8Array(values[valueIdx++]);
        for (let j = 0; j < count; j++) {
          const byteVal = val[j];
          bytes.push(j < val.length && byteVal !== undefined ? byteVal : 0);
        }
      } else if (type === "c") {
        // char (1 byte) - expects Uint8Array values
        for (let j = 0; j < count; j++) {
          const val = asPackUint8Array(values[valueIdx++]);
          const firstByte = val[0];
          bytes.push(val.length > 0 && firstByte !== undefined ? firstByte : 0);
        }
      } else if (type === "B") {
        for (let j = 0; j < count; j++) {
          bytes.push(asPackNumber(values[valueIdx++]) & 0xff);
        }
      } else if (type === "b") {
        for (let j = 0; j < count; j++) {
          const val = asPackNumber(values[valueIdx++]);
          bytes.push(val < 0 ? val + 256 : val);
        }
      } else if (type === "?") {
        for (let j = 0; j < count; j++) {
          const val = values[valueIdx++];
          bytes.push(val ? 1 : 0);
        }
      } else if (type === "e") {
        for (let j = 0; j < count; j++) {
          appendUint16(
            bytes,
            encodeFloat16(asPackNumber(values[valueIdx++])),
            littleEndian,
          );
        }
      } else if (type === "H") {
        for (let j = 0; j < count; j++) {
          const val = asPackNumber(values[valueIdx++]);
          if (littleEndian) {
            bytes.push(val & 0xff, (val >> 8) & 0xff);
          } else {
            bytes.push((val >> 8) & 0xff, val & 0xff);
          }
        }
      } else if (type === "h") {
        for (let j = 0; j < count; j++) {
          let val = asPackNumber(values[valueIdx++]);
          if (val < 0) val = val + 65536;
          if (littleEndian) {
            bytes.push(val & 0xff, (val >> 8) & 0xff);
          } else {
            bytes.push((val >> 8) & 0xff, val & 0xff);
          }
        }
      } else if (type === "L" || type === "I") {
        for (let j = 0; j < count; j++) {
          const val = asPackNumber(values[valueIdx++]);
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
          let val = asPackNumber(values[valueIdx++]);
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
      } else if (type === "n") {
        // ssize_t - treat as signed 64-bit on 64-bit platforms
        for (let j = 0; j < count; j++) {
          const val = asPackNumberOrBigint(values[valueIdx++]);
          const bigVal = typeof val === 'bigint' ? val : BigInt(val);
          const buffer = new ArrayBuffer(8);
          const view = new DataView(buffer);
          view.setBigInt64(0, bigVal, littleEndian);
          for (let k = 0; k < 8; k++) {
            bytes.push(view.getUint8(k));
          }
        }
      } else if (type === "N" || type === "P") {
        // size_t and void * - treat as unsigned 64-bit on 64-bit platforms
        for (let j = 0; j < count; j++) {
          const val = asPackNumberOrBigint(values[valueIdx++]);
          const bigVal = typeof val === 'bigint' ? val : BigInt(val);
          const buffer = new ArrayBuffer(8);
          const view = new DataView(buffer);
          view.setBigUint64(0, bigVal, littleEndian);
          for (let k = 0; k < 8; k++) {
            bytes.push(view.getUint8(k));
          }
        }
      } else if (type === "f") {
        for (let j = 0; j < count; j++) {
          const val = asPackNumber(values[valueIdx++]);
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
          const val = asPackNumber(values[valueIdx++]);
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
