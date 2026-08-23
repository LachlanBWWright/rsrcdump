import { encode as bufEncode, latin1Encode } from "./buffer-utils.js";

/**
 * Placeholder for writing values that will be filled in later
 */
export class WritePlaceholder {
  private _size: number;
  private committed = false;

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

      if (type === "x" || type === "c" || type === "B" || type === "b" || type === "?") size += count;
      else if (type === "e" || type === "H" || type === "h") size += 2 * count;
      else if (
        type === "L" ||
        type === "I" ||
        type === "l" ||
        type === "i" ||
        type === "f"
      )
        size += 4 * count;
      else if (type === "Q" || type === "q" || type === "n" || type === "N" || type === "P" || type === "d") size += 8 * count;
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
  encoding = "macroman",
): Uint8Array {
  const encoded = encoding === "macroman" ? latin1Encode(text) : bufEncode(text, encoding);
  const length = Math.min(encoded.length, 255);
  const padCount = (padding - ((1 + length) % padding)) % padding;

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

    if (type === "x" || type === "c" || type === "B" || type === "b" || type === "?") size += count;
    else if (type === "e" || type === "H" || type === "h") size += 2 * count;
    else if (
      type === "L" ||
      type === "I" ||
      type === "l" ||
      type === "i" ||
      type === "f"
    )
      size += 4 * count;
    else if (type === "Q" || type === "q" || type === "n" || type === "N" || type === "P" || type === "d") size += 8 * count;
    else if (type === "s") size += count;

    i++;
  }

  return size;
}
