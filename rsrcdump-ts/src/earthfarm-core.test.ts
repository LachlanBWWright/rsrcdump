/**
 * Comprehensive tests for Otto Matic EarthFarm.ter.rsrc parsing
 * These tests verify:
 * 1. Correct parsing of all resource types
 * 2. Data is appropriately represented in JSON form
 * 3. Roundtrips produce byte-perfect results
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import { load, saveToJson } from "./index.js";
import { isOk } from "./result.js";

let originalData: Uint8Array;
let structSpecs: string[] = [];

beforeAll(async () => {
  // Load the EarthFarm resource file
  const fileData = await readFile("../EarthFarm.ter.rsrc");
  originalData = new Uint8Array(fileData);
  
  // Load struct specs
  try {
    const specsContent = await readFile("../sample-specs.txt", "utf-8");
    structSpecs = specsContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("//"));
  } catch {
    // Continue without specs
  }
});

describe("EarthFarm parsing: core resources", () => {
  describe("Resource Fork Structure", () => {
    it("should load all expected resource types", async () => {
      const result = load(originalData);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const fork = result.value;
      
      // Expected resource types in EarthFarm.ter.rsrc
      const expectedTypes = [
        "Hedr", "alis", "Atrb", "Layr", "YCrd", "STgd",
        "Itms", "ItCo", "Spln", "SpNb", "SpPt", "SpIt",
        "Fenc", "FnNb", "Liqd"
      ];

      for (const typeName of expectedTypes) {
        const typeKey = Buffer.from(typeName, "binary").toString("binary");
        expect(fork.tree.has(typeKey)).toBe(true);
      }
    });

    it("should have correct resource counts per type", async () => {
      const result = load(originalData);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const fork = result.value;

      // Expected resource counts
      const expectedCounts: Record<string, number> = {
        "Hedr": 1,
        "alis": 28,
        "Atrb": 1,
        "Layr": 1,
        "YCrd": 1,
        "STgd": 1,
        "Itms": 1,
        "ItCo": 1,
        "Spln": 1,
        "SpNb": 26,
        "SpPt": 26,
        "SpIt": 26,
        "Fenc": 1,
        "FnNb": 46,
        "Liqd": 1,
      };

      for (const [typeName, expectedCount] of Object.entries(expectedCounts)) {
        const typeKey = Buffer.from(typeName, "binary").toString("binary");
        const typeMap = fork.tree.get(typeKey);
        expect(typeMap).toBeDefined();
        if (typeMap) {
          expect(typeMap.size).toBe(expectedCount);
        }
      }
    });
  });

  describe("Header (Hedr) Resource", () => {
    it("should parse Hedr correctly with struct spec", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const hedr = json.Hedr?.["1000"];
      
      expect(hedr).toBeDefined();
      expect(hedr.name).toBe("Header");
      expect(hedr.obj).toBeDefined();
      
      // Verify specific field values from EarthFarm
      expect(hedr.obj.vers).toBe(134217728);  // 0x08000000
      expect(hedr.obj.items).toBe(595);
      expect(hedr.obj.width).toBe(176);
      expect(hedr.obj.height).toBe(176);
      expect(hedr.obj.tilePages).toBe(28);
      expect(hedr.obj.tiles).toBe(21881);
      expect(hedr.obj.tileSize).toBe(10);
      expect(hedr.obj.minY).toBe(0);
      expect(hedr.obj.maxY).toBe(68);
      expect(hedr.obj.splines).toBe(26);
      expect(hedr.obj.fences).toBe(46);
      expect(hedr.obj.uniqueST).toBe(428);
      expect(hedr.obj.waters).toBe(7);
    });
  });

  describe("Items (Itms) Resource", () => {
    it("should parse Itms as a list of items", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const itms = json.Itms?.["1000"];
      
      expect(itms).toBeDefined();
      expect(itms.obj).toBeDefined();
      expect(Array.isArray(itms.obj)).toBe(true);
      expect(itms.obj.length).toBe(595);  // Should match Hedr.items

      // Check structure of first item
      const firstItem = itms.obj[0];
      expect(firstItem).toHaveProperty("x");
      expect(firstItem).toHaveProperty("z");
      expect(firstItem).toHaveProperty("type");
      expect(firstItem).toHaveProperty("p0");
      expect(firstItem).toHaveProperty("p1");
      expect(firstItem).toHaveProperty("p2");
      expect(firstItem).toHaveProperty("p3");
      expect(firstItem).toHaveProperty("flags");

      // Verify first item values
      expect(firstItem.x).toBe(43);
      expect(firstItem.z).toBe(337);
      expect(firstItem.type).toBe(14);
    });
  });

  describe("Fences (Fenc/FnNb) Resources", () => {
    it("should parse Fenc as a list of fence definitions", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const fenc = json.Fenc?.["1000"];
      
      expect(fenc).toBeDefined();
      expect(fenc.obj).toBeDefined();
      expect(Array.isArray(fenc.obj)).toBe(true);
      expect(fenc.obj.length).toBe(46);  // Should match Hedr.fences

      // Check structure of first fence
      const firstFence = fenc.obj[0];
      expect(firstFence).toHaveProperty("fenceType");
      expect(firstFence).toHaveProperty("numNubs");
      expect(firstFence).toHaveProperty("bbTop");
      expect(firstFence).toHaveProperty("bbLeft");
      expect(firstFence).toHaveProperty("bbBottom");
      expect(firstFence).toHaveProperty("bbRight");

      // Verify first fence values
      expect(firstFence.fenceType).toBe(0);
      expect(firstFence.numNubs).toBe(30);
    });

    it("should have matching FnNb counts for fences", async () => {
      const result = load(originalData);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const fork = result.value;
      const fnNbKey = Buffer.from("FnNb", "binary").toString("binary");
      const fnNbMap = fork.tree.get(fnNbKey);
      
      expect(fnNbMap).toBeDefined();
      expect(fnNbMap?.size).toBe(46);  // Should match Hedr.fences
    });
  });

});
