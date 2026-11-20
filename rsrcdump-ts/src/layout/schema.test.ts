import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jsonLayoutJsonSchema, layoutDocumentSchema } from "./schema.js";

const schemaInput: unknown = JSON.parse(readFileSync(new URL("../../layout.schema.json", import.meta.url), "utf8"));
const schemaObject = z.record(z.string(), z.unknown()).safeParse(schemaInput);
const jsonSchema = schemaObject.success ? schemaObject.data : false;

describe("layout JSON Schema", () => {
  it("accepts both real Pangea definitions with static and runtime-generated schemas", () => {
    const ajv = new Ajv2020();
    const staticValidator = ajv.compile(jsonSchema);
    const generatedValidator = ajv.compile(jsonLayoutJsonSchema);
    for (const file of ["pangea-water", "pangea-skeleton"]) {
      const definition: unknown = JSON.parse(readFileSync(new URL(`../../examples/${file}.json`, import.meta.url), "utf8"));
      expect(staticValidator(definition), JSON.stringify(staticValidator.errors)).toBe(true);
      expect(generatedValidator(definition), JSON.stringify(generatedValidator.errors)).toBe(true);
      expect(layoutDocumentSchema.safeParse(definition).success).toBe(true);
    }
    expect(schemaObject.success).toBe(true);
  });

  it.each([
    { resources: { Test: "u16" } },
    { byteOrder: "little", resources: { Test: { type: "array", count: 4, items: "f32" } } },
    { resources: { Test: { type: "array", count: -1, items: "f32" } } },
    { resources: { Test: { type: "array", count: 4, items: "float" } } },
    { resources: { Test: { type: "padding", bytes: 0 } } },
    { resources: { Test: { type: "struct", fields: [] } } },
    { resources: { Test: "u8" }, typo: true },
    { byteOrder: "native", resources: {} },
    { resources: { InvalidTypeName: "u8" } },
  ])("agrees with Zod on document shape: %j", (input) => {
    const validator = new Ajv2020().compile(jsonSchema);
    expect(validator(input)).toBe(layoutDocumentSchema.safeParse(input).success);
  });
});
