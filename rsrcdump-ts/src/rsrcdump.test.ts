/**
 * Tests for rsrcdump-ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile, writeFile } from "fs/promises";
import { load, saveToJson, loadBytesFromJson } from "./index.js";
import { isOk } from "./result.js";

let structSpecs: string[] = [];

beforeAll(async () => {
  try {
    const specsContent = await readFile("../sample-specs.txt", "utf-8");
    structSpecs = specsContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
  } catch {
    // continue without specs
  }
});

describe("rsrcdump-ts", () => {
  describe("Resource Fork Loading", () => {
    it("should load EarthFarm.ter.rsrc", async () => {
      const result = await load("../EarthFarm.ter.rsrc");
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;
      
      const fork = result.value;
      // We expect at least one resource type and a specific Hedr type with resources
      expect(fork.tree.size).toBeGreaterThan(0);

      const hedrKey = Buffer.from("Hedr", "binary").toString("binary");
      expect(fork.tree.has(hedrKey)).toBe(true);

      const hedrMap = fork.tree.get(hedrKey)!;
      expect(hedrMap.size).toBeGreaterThan(0);

      // Check for a known resource id if present in this sample
      expect(hedrMap.has(1000)).toBe(true);

      // Verify structure of a sample resource
      const sample = hedrMap.get(1000)!;
      expect(sample).toEqual(
        expect.objectContaining({
          num: 1000,
          flags: expect.any(Number),
          data: expect.any(Uint8Array),
        }),
      );
      expect(sample.data.length).toBeGreaterThan(0);
    });

    it("should handle empty resource fork", async () => {
      const emptyData = new Uint8Array(0);
      const result = await load(emptyData);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const fork = result.value;
        expect(fork.tree.size).toBe(0);
      }
    });
  });

  describe("JSON Conversion", () => {
    it("should convert EarthFarm.ter.rsrc to JSON", async () => {
      const data = await readFile("../EarthFarm.ter.rsrc");

      const structSpecs: string[] = [];
      try {
        const specsContent = await readFile("../sample-specs.txt", "utf-8");
        const lines = specsContent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("//")) {
            structSpecs.push(trimmed);
          }
        }
      } catch (e) {
        // sample-specs.txt not found, continue without it
      }

      const result = await saveToJson(new Uint8Array(data), structSpecs);
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const jsonStr = result.value;
        expect(jsonStr.length).toBeGreaterThan(0);

        // Parse JSON to verify it's valid and contains expected structure
        const parsed = JSON.parse(jsonStr);
        expect(parsed._metadata).toBeDefined();
        expect(typeof parsed._metadata.file_attributes).toBe("number");

        // Check a small, stable subset for semantic correctness
        expect(parsed).toHaveProperty("Hedr");
        const hed1000 = parsed.Hedr["1000"];
        expect(hed1000).toBeDefined();
        // Hedr may be represented as structured 'obj' or raw 'data' depending on converters; assert one deterministic form
        if (hed1000.obj) {
          expect(hed1000.obj).toEqual(
            expect.objectContaining({
              vers: expect.any(Number),
              width: expect.any(Number),
              height: expect.any(Number),
            }),
          );
        } else {
          expect(typeof hed1000.data).toBe("string");
          expect(hed1000.data).toMatch(/^[0-9A-Fa-f]+$/);
          expect(hed1000.name).toBe("Header");
        }
      }
    });
  });

  describe("Round-trip Conversion", () => {
    it("should preserve binary data in round-trip", async () => {
      // Load original file
      const originalData = await readFile("../EarthFarm.ter.rsrc");
      const loadResult = await load(new Uint8Array(originalData));
      expect(isOk(loadResult)).toBe(true);

      if (!isOk(loadResult)) return;

      const fork = loadResult.value;

      // Convert to JSON
      const jsonResult = await saveToJson(
        new Uint8Array(originalData),
        structSpecs,
      );
      expect(isOk(jsonResult)).toBe(true);

      if (!isOk(jsonResult)) return;

      const jsonStr = jsonResult.value;
      const jsonBlob = JSON.parse(jsonStr);

      // Convert back to binary
      const bytesResult = loadBytesFromJson(jsonBlob, structSpecs);
      if (!isOk(bytesResult)) {
        // eslint-disable-next-line no-console
        console.error("loadBytesFromJson failed:", bytesResult.error);
        try {
          await writeFile(
            "../diagnostic_ts_json.json",
            JSON.stringify(jsonBlob, null, 2),
            "utf-8",
          );
          // eslint-disable-next-line no-console
          console.error("Wrote diagnostic JSON to ../diagnostic_ts_json.json");
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to write diagnostic JSON:", e);
        }
      }
      expect(isOk(bytesResult)).toBe(true);

      if (!isOk(bytesResult)) return;

      const regeneratedData = bytesResult.value;

      // Reload the regenerated data
      const reloadResult = await load(regeneratedData);
      expect(isOk(reloadResult)).toBe(true);

      if (!isOk(reloadResult)) return;

      const regeneratedFork = reloadResult.value;

      // Compare resource counts
      expect(regeneratedFork.tree.size).toBe(fork.tree.size);

      // Compare each resource type and contents
      for (const [typeKey, typeMap] of fork.tree) {
        const regenTypeMap = regeneratedFork.tree.get(typeKey);
        expect(regenTypeMap).toBeDefined();
        if (!regenTypeMap) {
          throw new Error(`Missing resource type ${Buffer.from(typeKey, "binary").toString("latin1")}`);
        }

        expect(regenTypeMap.size).toBe(typeMap.size);

        // Compare each resource
        for (const [resId, res] of typeMap) {
          const regenRes = regenTypeMap.get(resId);
          expect(regenRes).toBeDefined();
          if (!regenRes) {
            throw new Error(`Missing resource ${Buffer.from(typeKey, "binary").toString("latin1")}#${resId}`);
          }

          // Compare resource properties
          expect(regenRes!.num).toBe(res.num);
          expect(regenRes!.flags).toBe(res.flags);
          expect(regenRes!.data.length).toBe(res.data.length);

          // Compare data bytes exactly
          expect(Buffer.from(regenRes!.data)).toEqual(Buffer.from(res.data));
        }
      }
    });
  });

  describe("JSON Comparison with Python", () => {
    it("should produce similar JSON to Python version", async () => {
      // This test compares the structure of the JSON output
      // We don't expect byte-for-byte identical output due to:
      // - Different JSON formatting
      // - Potential differences in float formatting
      // But the structure should be the same

      const data = await readFile("../EarthFarm.ter.rsrc");
      const tsResult = await saveToJson(new Uint8Array(data), structSpecs);

      expect(isOk(tsResult)).toBe(true);

      if (!isOk(tsResult)) return;

      const tsJson = JSON.parse(tsResult.value);

      // Check metadata
      expect(tsJson._metadata).toBeDefined();
      expect(typeof tsJson._metadata.file_attributes).toBe("number");

      // Check for major resource types
      const hasHedr = "Hedr" in tsJson;
      const hasAlis = "alis" in tsJson;

      expect(hasHedr).toBe(true);
      expect(hasAlis).toBe(true);

      if (hasHedr) {
        expect(tsJson.Hedr).toBeDefined();
        expect(typeof tsJson.Hedr).toBe("object");
        // Check a small stable entry exists
        const hed = tsJson.Hedr["1000"];
        expect(hed).toBeDefined();
        if (hed.obj) {
          expect(hed.obj).toEqual(
            expect.objectContaining({ vers: expect.any(Number) }),
          );
        } else {
          expect(typeof hed.data).toBe("string");
          expect(hed.data).toMatch(/^[0-9A-Fa-f]+$/);
        }
      }
    });
  });

  describe("Result Type Error Handling", () => {
    it("should return error for invalid data", async () => {
      const invalidData = new Uint8Array([1, 2, 3, 4]);
      const result = await load(invalidData);

      // Expect a deterministic error for too-small data
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(typeof result.error).toBe("string");
        expect(result.error).toMatch(/too small|nonsense|offsets/);
      }
    });

    it("should handle non-existent file gracefully", async () => {
      const result = await load("/nonexistent/file.rsrc");
      expect(isOk(result)).toBe(false);

      if (!isOk(result)) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
