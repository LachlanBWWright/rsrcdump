import { describe, expect, it } from "vitest";
import { WritePlaceholder, calcsize, packPstr } from "./packutils.js";

describe("pack format helpers", () => {
  it("calculates mixed format sizes for every width", () => {
    expect(calcsize("> x c B b ? e H h L I l i f Q q n N P d 3s")).toBe(82);
    expect(calcsize("<2H4x")).toBe(8);
    expect(calcsize("10s")).toBe(10);
  });

  it("writes and commits a correctly sized placeholder", () => {
    const stream = { buffer: [] as Uint8Array[], position: 0 };
    const placeholder = new WritePlaceholder(stream, ">2HLQ");

    expect(stream.position).toBe(16);
    expect(stream.buffer).toEqual([new Uint8Array(16).fill(0xca)]);
    placeholder.commit(1);
    expect(() => {
      placeholder.commit(2);
    }).toThrow("Already committed");
  });

  it("packs Pascal strings aligned to the requested boundary", () => {
    expect(packPstr("ab", 4)).toEqual(new Uint8Array([2, 97, 98, 0]));
    expect(packPstr("abc", 4)).toEqual(new Uint8Array([3, 97, 98, 99]));
  });

  it("limits Pascal strings to 255 encoded bytes", () => {
    const packed = packPstr("a".repeat(300), 1, "utf-8");
    expect(packed).toHaveLength(256);
    expect(packed[0]).toBe(255);
  });
});
