/**
 * Integration tests for rsrcdump-ts
 * These tests verify end-to-end functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import {
  load,
  saveToJson,
  loadBytesFromJsonAsync,
  isOk,
  resourceForkToString,
  getStandardConverters,
} from "./index.js";

let structSpecs: string[] = [];

beforeAll(async () => {
  // Load sample-specs.txt if present so tests use struct parsers
  try {
    const specsContent = await readFile("../sample-specs.txt", "utf-8");
    structSpecs = specsContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
  } catch {
    // No specs file present; tests will fall back to base16
  }
});

describe("Integration: supporting behavior", () => {
  describe("Resource Type Handling", () => {
    it("should handle all resource types correctly", async () => {
      const fileData = await readFile("../EarthFarm.ter.rsrc");
      const result = load(new Uint8Array(fileData));
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const fork = result.value;

      // Verify we have the expected types
      const typeNames = Array.from(fork.tree.keys()).map((key) =>
        Buffer.from(key, "binary").toString("latin1"),
      );

      console.log("Resource types found:", typeNames.join(", "));

      // EarthFarm.ter.rsrc should have these types
      const expectedTypes = [
        "Hedr",
        "alis",
        "Atrb",
        "Layr",
        "YCrd",
        "STgd",
        "Itms",
        "ItCo",
        "Spln",
        "SpNb",
        "SpPt",
        "SpIt",
        "Fenc",
        "FnNb",
        "Liqd",
      ];

      for (const expectedType of expectedTypes) {
        const hasType = typeNames.includes(expectedType);
        expect(hasType).toBe(true);
      }
    });

    it("should preserve resource order", async () => {
      const fileData = await readFile("../EarthFarm.ter.rsrc");
      const result = load(new Uint8Array(fileData));
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const fork = result.value;

      // Collect all resources with orders
      const resources: { type: string; id: number; order: number }[] = [];

      for (const [typeKey, typeMap] of fork.tree) {
        const typeStr = Buffer.from(typeKey, "binary").toString("latin1");
        for (const [resId, res] of typeMap) {
          if (res.order !== 0xffffffff) {
            resources.push({ type: typeStr, id: resId, order: res.order });
          }
        }
      }

      // Verify orders are sequential
      const orders = resources.map((r) => r.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i]).toBe(i);
      }
    });
  });

  describe("Converter System", () => {
    it("should use correct converters", async () => {
      const converters = getStandardConverters();

      // Verify standard converters are registered
      const strKey = Buffer.from("STR ", "binary").toString("binary");
      const strListKey = Buffer.from("STR#", "binary").toString("binary");
      const textKey = Buffer.from("TEXT", "binary").toString("binary");

      expect(converters.has(strKey)).toBe(true);
      expect(converters.has(strListKey)).toBe(true);
      expect(converters.has(textKey)).toBe(true);
    });

    it("should fall back to base16 for unknown types", async () => {
      const fileData = await readFile("../EarthFarm.ter.rsrc");
      const result = load(new Uint8Array(fileData));
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const data = new Uint8Array(fileData);

      const jsonResult = await saveToJson(data, structSpecs);
      expect(isOk(jsonResult)).toBe(true);

      if (!isOk(jsonResult)) return;

      const jsonBlob = JSON.parse(jsonResult.value);

      // alis resources should have 'data' field (base16)
      if (jsonBlob.alis && jsonBlob.alis["1000"]) {
        expect(jsonBlob.alis["1000"]).toHaveProperty("data");
        expect(typeof jsonBlob.alis["1000"].data).toBe("string");
        expect(jsonBlob.alis["1000"].data).toMatch(/^[0-9A-Fa-f]+$/);
      }
    });
  });

  describe("Error Recovery", () => {
    it("should handle corrupted data gracefully", async () => {
      const corrupted = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
      const result = await load(corrupted);

      // Deterministic behavior: too-small data should return an error
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(typeof result.error).toBe("string");
        expect(result.error).toMatch(/too small|offsets|nonsense/);
      }
    });

    it("should handle empty file", async () => {
      const empty = new Uint8Array(0);
      const result = await load(empty);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.tree.size).toBe(0);
      }
    });

    it("should handle invalid JSON gracefully", async () => {
      const invalid = { not: "a valid resource fork" };
      const result = await loadBytesFromJsonAsync(invalid);

      // Should deterministically return an error due to missing _metadata
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(typeof result.error).toBe("string");
        expect(result.error).toMatch(/Missing _metadata|Failed to pack|Invalid JSON blob/);
      }
    });
  });

  describe("String Representation", () => {
    it("should produce readable resource fork description", async () => {
      const fileData = await readFile("../EarthFarm.ter.rsrc");
      const result = load(new Uint8Array(fileData));
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const str = resourceForkToString(result.value);

      expect(str).toContain("ResourceFork");
      expect(str).toContain("Hedr");
      expect(str).toContain("alis");

      console.log("Resource fork:", str);
    });
  });
});
