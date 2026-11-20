import { describe, expect, it } from "vitest";
import { compileLayoutSchema, decodeResource, encodeResource, jsonLayoutJsonSchema } from "./index.js";

const counted = {
  byteOrder: "big",
  resources: { Test: { type: "struct", fields: [
    { name: "count", type: "u8" },
    { type: "padding", bytes: 2 },
    { name: "points", type: "array", count: { field: "count" }, items: { type: "struct", fields: [
      { name: "x", type: "f32" }, { name: "y", type: "i16" },
    ] } },
  ] } },
};

describe("JSON binary layouts", () => {
  it("reads independent expected bytes and preserves padding after JSON transport", () => {
    const layouts = compileLayoutSchema(counted);
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    const bytes = Uint8Array.from([1, 0xa5, 0x5a, 0x3f, 0xc0, 0, 0, 0xff, 0xfe]);
    const decoded = decodeResource(layouts.value, "Test", bytes);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isErr()) return;
    expect(decoded.value.value).toEqual({ count: 1, points: [{ x: 1.5, y: -2 }] });
    expect(decoded.value.preservedBytes).toEqual({ "Test.@padding[1]": [0xa5, 0x5a] });
    const transported: unknown = JSON.parse(JSON.stringify(decoded.value.value));
    const encoded = encodeResource(layouts.value, "Test", transported, decoded.value.preservedBytes);
    expect(encoded.isOk()).toBe(true);
    if (encoded.isErr()) return;
    expect(encoded.value).toEqual(bytes);
    const fresh = encodeResource(layouts.value, "Test", transported);
    expect(fresh.isOk()).toBe(true);
    if (fresh.isErr()) return;
    expect(fresh.value.slice(1, 3)).toEqual(Uint8Array.from([0, 0]));
  });

  it.each(["big", "little"])("handles arrays of arrays, references and %s endian integers", (byteOrder) => {
    const layouts = compileLayoutSchema({ byteOrder,
      types: { Pair: { type: "array", count: 2, items: "u16" } },
      resources: { Test: { type: "array", count: "remaining", items: { $ref: "#/types/Pair" } } },
    });
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    const encoded = encodeResource(layouts.value, "Test", [[1, 256], [65535, 0]]);
    expect(encoded.isOk()).toBe(true);
    if (encoded.isErr()) return;
    expect([...encoded.value]).toEqual(byteOrder === "big" ? [0, 1, 1, 0, 255, 255, 0, 0] : [1, 0, 0, 1, 255, 255, 0, 0]);
    const padded = new Uint8Array(12).fill(99);
    padded.set(encoded.value, 3);
    const decoded = decodeResource(layouts.value, "Test", padded.subarray(3, 11));
    expect(decoded.isOk()).toBe(true);
    if (decoded.isOk()) expect(decoded.value.value).toEqual([[1, 256], [65535, 0]]);
  });

  it("scopes counted arrays to the containing struct instance", () => {
    const layouts = compileLayoutSchema({ resources: { Test: { type: "array", count: 2,
      items: { type: "struct", fields: [
        { name: "length", type: "u8" }, { name: "values", type: "array", count: { field: "length" }, items: "u8" },
      ] } } } });
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    const value = [{ length: 2, values: [10, 11] }, { length: 1, values: [12] }];
    const encoded = encodeResource(layouts.value, "Test", value);
    expect(encoded.isOk()).toBe(true);
    if (encoded.isErr()) return;
    expect([...encoded.value]).toEqual([2, 10, 11, 1, 12]);
    const decoded = decodeResource(layouts.value, "Test", encoded.value);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isOk()) expect(decoded.value.value).toEqual(value);
  });

  it.each([
    { points: [] }, { count: 1, points: [] }, { count: -1, points: [] },
    { count: 1, points: [{ x: 1 }] }, { count: 1, points: [{ x: Infinity, y: 0 }] },
    { count: 1, points: [{ x: 1e40, y: 0 }] }, { count: 1, points: [{ x: 1, y: 32768 }] },
    { count: 1, points: [{ x: 1, y: 0.5 }] }, { count: 0, points: [], typo: 2 },
  ])("rejects invalid data with an actionable field path: %j", (value) => {
    const layouts = compileLayoutSchema(counted);
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    const result = encodeResource(layouts.value, "Test", value);
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.path).toMatch(/^Test/);
  });

  it.each([
    { $ref: "#/types/Missing" },
    { type: "array", count: "remaining", items: { type: "array", count: 0, items: "u8" } },
    { type: "struct", fields: [{ name: "x", type: "u8" }, { name: "x", type: "u16" }] },
    { type: "struct", fields: [{ type: "u8" }] },
    { type: "struct", fields: [{ name: "pad", type: "padding", bytes: 2 }] },
    { type: "struct", fields: [{ name: "a", type: "array", count: { field: "n" }, items: "u8" }, { name: "n", type: "u8" }] },
    { type: "struct", fields: [{ name: "a", type: "array", count: "remaining", items: "u8" }, { name: "b", type: "u8" }] },
  ])("rejects ambiguous or invalid layouts: %j", (node) => {
    expect(compileLayoutSchema({ resources: { Test: node } }).isErr()).toBe(true);
  });

  it("rejects cyclic type references", () => {
    expect(compileLayoutSchema({ types: { Loop: { $ref: "#/types/Loop" } }, resources: { Test: { $ref: "#/types/Loop" } } }).isErr()).toBe(true);
  });

  it("returns a typed error for cyclic JavaScript schema objects", () => {
    const node: { type: "array"; count: number; items?: unknown } = { type: "array", count: 1 };
    node.items = node;
    const result = compileLayoutSchema({ resources: { Test: node } });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.message).toMatch(/cyclic|nested|nesting/);
  });

  it("rejects truncated, partial and trailing records", () => {
    const fixed = compileLayoutSchema({ resources: { Test: "u16" } });
    const repeated = compileLayoutSchema({ resources: { Test: { type: "array", count: "remaining", items: "u16" } } });
    expect(fixed.isOk() && repeated.isOk()).toBe(true);
    if (fixed.isErr() || repeated.isErr()) return;
    expect(decodeResource(fixed.value, "Test", new Uint8Array(1)).isErr()).toBe(true);
    expect(decodeResource(fixed.value, "Test", new Uint8Array(3)).isErr()).toBe(true);
    expect(decodeResource(repeated.value, "Test", new Uint8Array(3)).isErr()).toBe(true);
    expect(decodeResource(fixed.value, "Nope", new Uint8Array(2)).isErr()).toBe(true);
  });

  it("exports a JSON Schema for the layout document", () => {
    expect(jsonLayoutJsonSchema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(jsonLayoutJsonSchema.properties).toHaveProperty("resources");
    expect(JSON.stringify(jsonLayoutJsonSchema)).toContain("$ref");
  });

  it("preserves negative zero through JSON transport without overriding changed coordinates", () => {
    const layouts = compileLayoutSchema({ resources: { Test: { type: "array", count: 2, items: "f32" } } });
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    const bytes = Uint8Array.from([128, 0, 0, 0, 63, 128, 0, 0]);
    const decoded = decodeResource(layouts.value, "Test", bytes);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isErr()) return;
    const transported: unknown = JSON.parse(JSON.stringify(decoded.value.value));
    const encoded = encodeResource(layouts.value, "Test", transported, decoded.value.preservedBytes);
    expect(encoded.isOk()).toBe(true);
    if (encoded.isOk()) expect(encoded.value).toEqual(bytes);
    const edited = encodeResource(layouts.value, "Test", [2, 1], decoded.value.preservedBytes);
    expect(edited.isOk()).toBe(true);
    if (edited.isOk()) expect([...edited.value.slice(0, 4)]).toEqual([64, 0, 0, 0]);
  });

  it("rejects malformed preservation bytes and noncanonical booleans", () => {
    const layouts = compileLayoutSchema({ resources: { Test: "bool" } });
    expect(layouts.isOk()).toBe(true);
    if (layouts.isErr()) return;
    expect(encodeResource(layouts.value, "Test", true, { unused: [256] }).isErr()).toBe(true);
    expect(encodeResource(layouts.value, "Test", 1).isErr()).toBe(true);
    expect(decodeResource(layouts.value, "Test", Uint8Array.from([2])).isErr()).toBe(true);
  });
});
