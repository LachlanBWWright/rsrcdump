import { describe, expect, it } from "vitest";
import { Unpacker } from "./packutils.js";

describe("Unpacker cursor operations", () => {
  it("seeks, skips, reads, and reports remaining data", () => {
    const unpacker = new Unpacker(new Uint8Array([1, 2, 3, 4]));
    expect(unpacker.remaining()).toBe(4);
    unpacker.skip(1);
    expect(unpacker.read(2)).toEqual(new Uint8Array([2, 3]));
    expect(unpacker.eof()).toBe(false);
    unpacker.seek(3);
    expect(unpacker.read(1)).toEqual(new Uint8Array([4]));
    expect(unpacker.eof()).toBe(true);
  });

  it("rejects reads beyond the available data", () => {
    const unpacker = new Unpacker(new Uint8Array([1]));
    expect(() => unpacker.read(2)).toThrow("Expected 2 bytes but got 1");
  });

  it("unpacks raw, macroman, and UTF-8 Pascal strings", () => {
    expect(new Unpacker(new Uint8Array([2, 65, 66])).unpackRawPstr()).toEqual(
      new Uint8Array([65, 66]),
    );
    expect(new Unpacker(new Uint8Array([2, 65, 66])).unpackPstr()).toBe("AB");
    expect(new Unpacker(new Uint8Array([2, 0xc3, 0xa9])).unpackPstr("utf-8")).toBe("é");
  });
});
