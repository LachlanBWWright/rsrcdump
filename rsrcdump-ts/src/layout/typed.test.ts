import { describe, expect, expectTypeOf, it } from "vitest";
import { compileTypedLayout, decodeTypedResource, defineLayout, encodeTypedResource,
  encodeResource, validateResource, validateTypedResource, type InferResource } from "./index.js";

const definition = defineLayout({
  types: {
    Point: { type: "struct", fields: [{ name: "x", type: "f32" }, { name: "y", type: "i16" }] },
  },
  resources: {
    Test: { type: "struct", fields: [
      { name: "enabled", type: "bool" },
      { name: "count", type: "u8" },
      { name: "points", type: "array", count: { field: "count" }, items: { $ref: "#/types/Point" } },
    ] },
    Pair: { type: "array", count: 2, items: "u16" },
  },
});
type Value = { enabled: boolean; count: number; points: { x: number; y: number }[] };

describe("schema-derived TypeScript types and validation", () => {
  it("infers named fields, scalar types, referenced structs and arrays", () => {
    expectTypeOf<InferResource<typeof definition, "Test">>().toEqualTypeOf<Value>();
    expectTypeOf<InferResource<typeof definition, "Pair">>().toEqualTypeOf<number[]>();
    expectTypeOf(encodeTypedResource<typeof definition, "Test">).parameter(2).toEqualTypeOf<Value>();
    const compiled = compileTypedLayout(definition);
    expect(compiled.isOk()).toBe(true);
    if (compiled.isErr()) return;
    const validated = validateTypedResource(compiled.value, "Test", {
      enabled: true, count: 1, points: [{ x: 1.5, y: -2 }],
    });
    expect(validated.isOk()).toBe(true);
    if (validated.isErr()) return;
    expectTypeOf(validated.value).toEqualTypeOf<Value>();
    const encoded = encodeTypedResource(compiled.value, "Test", validated.value);
    expect(encoded.isOk()).toBe(true);
    if (encoded.isErr()) return;
    const decoded = decodeTypedResource(compiled.value, "Test", encoded.value);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isErr()) return;
    expectTypeOf(decoded.value.value).toEqualTypeOf<Value>();
    expect(decoded.value.value).toEqual(validated.value);
  });

  it.each([
    { enabled: true, count: 1, points: [{ x: 1 }] },
    { enabled: true, count: 2, points: [{ x: 1, y: 2 }] },
    { enabled: 1, count: 0, points: [] },
    { enabled: true, count: 1, points: [{ x: NaN, y: 2 }] },
    { enabled: true, count: 1, points: [{ x: 1, y: -32769 }] },
    { enabled: true, count: 0, points: [], unexpected: 1 },
  ])("validates unknown input without serializing and agrees with the writer: %j", (input) => {
    const compiled = compileTypedLayout(definition);
    expect(compiled.isOk()).toBe(true);
    if (compiled.isErr()) return;
    const validated = validateResource(compiled.value.compiled, "Test", input);
    expect(validated.isErr()).toBe(true);
    const encoded = encodeResource(compiled.value.compiled, "Test", input);
    expect(encoded.isErr()).toBe(true);
    if (encoded.isErr() && validated.isErr()) expect(encoded.error.path).toBe(validated.error.path);
    const typed = validateTypedResource(compiled.value, "Test", input);
    expect(typed.isErr()).toBe(true);
    if (typed.isErr() && validated.isErr()) expect(typed.error).toEqual(validated.error);
  });

  it("reports the precise missing coordinate path", () => {
    const compiled = compileTypedLayout(definition);
    expect(compiled.isOk()).toBe(true);
    if (compiled.isErr()) return;
    const result = validateTypedResource(compiled.value, "Test", { enabled: true, count: 1, points: [{ x: 1 }] });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.error.path).toBe("Test.points[0].y");
  });
});
