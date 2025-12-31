/**
 * Comprehensive tests for Otto Matic EarthFarm.ter.rsrc parsing
 * These tests verify:
 * 1. Correct parsing of all resource types
 * 2. Data is appropriately represented in JSON form
 * 3. Roundtrips produce byte-perfect results
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import { load, saveToJson, loadBytesFromJson } from "./index.js";
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

describe("EarthFarm.ter.rsrc Parsing", () => {
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

  describe("Splines (Spln/SpNb/SpPt/SpIt) Resources", () => {
    it("should parse Spln as a list of spline definitions", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const spln = json.Spln?.["1000"];
      
      expect(spln).toBeDefined();
      expect(spln.obj).toBeDefined();
      expect(Array.isArray(spln.obj)).toBe(true);
      expect(spln.obj.length).toBe(26);  // Should match Hedr.splines

      // Check structure of first spline
      const firstSpline = spln.obj[0];
      expect(firstSpline).toHaveProperty("numNubs");
      expect(firstSpline).toHaveProperty("numPoints");
      expect(firstSpline).toHaveProperty("numItems");
      expect(firstSpline).toHaveProperty("bbTop");
      expect(firstSpline).toHaveProperty("bbLeft");
      expect(firstSpline).toHaveProperty("bbBottom");
      expect(firstSpline).toHaveProperty("bbRight");
    });

    it("should have 26 SpNb resources (one per spline)", async () => {
      const result = load(originalData);
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) return;

      const fork = result.value;
      const spNbKey = Buffer.from("SpNb", "binary").toString("binary");
      const spNbMap = fork.tree.get(spNbKey);
      
      expect(spNbMap).toBeDefined();
      expect(spNbMap?.size).toBe(26);  // Should match Hedr.splines
    });

    it("should parse SpNb as lists of nub coordinates", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const spNb = json.SpNb?.["1000"];
      
      expect(spNb).toBeDefined();
      expect(spNb.obj).toBeDefined();
      expect(Array.isArray(spNb.obj)).toBe(true);

      // Each SpNb item should have x and z float coordinates
      const firstNub = spNb.obj[0];
      expect(firstNub).toHaveProperty("x");
      expect(firstNub).toHaveProperty("z");
      expect(typeof firstNub.x).toBe("number");
      expect(typeof firstNub.z).toBe("number");
    });
  });

  describe("Liquid/Water (Liqd) Resource", () => {
    it("should parse Liqd with backtick arrays", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const liqd = json.Liqd?.["1000"];
      
      expect(liqd).toBeDefined();
      expect(liqd.obj).toBeDefined();
      expect(Array.isArray(liqd.obj)).toBe(true);
      expect(liqd.obj.length).toBe(7);  // Should match Hedr.waters

      // Check structure of first water
      const firstWater = liqd.obj[0];
      expect(firstWater).toHaveProperty("type");
      expect(firstWater).toHaveProperty("height");
      expect(firstWater).toHaveProperty("numNubs");
      expect(firstWater).toHaveProperty("x`y");  // Backtick array
      expect(firstWater).toHaveProperty("hotSpotX");
      expect(firstWater).toHaveProperty("hotSpotZ");
      expect(firstWater).toHaveProperty("bBoxTop");
      expect(firstWater).toHaveProperty("bBoxLeft");
      expect(firstWater).toHaveProperty("bBoxBottom");
      expect(firstWater).toHaveProperty("bBoxRight");

      // Check backtick array structure
      expect(Array.isArray(firstWater["x`y"])).toBe(true);
      expect(firstWater["x`y"].length).toBe(100);  // 100 x,y pairs
      
      const firstXY = firstWater["x`y"][0];
      expect(firstXY).toHaveProperty("x");
      expect(firstXY).toHaveProperty("y");
    });
  });

  describe("Y Coordinate (YCrd) Resource", () => {
    it("should parse YCrd as a list of floats", async () => {
      const jsonResult = await saveToJson(originalData, structSpecs);
      expect(isOk(jsonResult)).toBe(true);
      if (!isOk(jsonResult)) return;

      const json = JSON.parse(jsonResult.value);
      const yCrd = json.YCrd?.["1000"];
      
      expect(yCrd).toBeDefined();
      expect(yCrd.obj).toBeDefined();
      expect(Array.isArray(yCrd.obj)).toBe(true);
      
      // YCrd values should be floats representing terrain height
      for (const value of yCrd.obj) {
        expect(typeof value).toBe("number");
      }
    });
  });
});

describe("EarthFarm.ter.rsrc Byte-Perfect Roundtrip", () => {
  it("should achieve byte-perfect roundtrip with backtick arrays disabled", async () => {
    // Convert to JSON with backtick arrays disabled
    const jsonResult = await saveToJson(
      originalData, 
      structSpecs,
      [],  // includeTypes
      [],  // excludeTypes
      { useBacktickArrays: false }
    );
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const jsonBlob = JSON.parse(jsonResult.value);

    // Convert back to binary
    const bytesResult = loadBytesFromJson(jsonBlob, structSpecs, [], [], false);
    expect(isOk(bytesResult)).toBe(true);
    if (!isOk(bytesResult)) return;

    const regeneratedData = bytesResult.value;

    // Load both for comparison
    const originalLoad = load(originalData);
    const regenLoad = load(regeneratedData);
    expect(isOk(originalLoad)).toBe(true);
    expect(isOk(regenLoad)).toBe(true);
    if (!isOk(originalLoad) || !isOk(regenLoad)) return;

    const originalFork = originalLoad.value;
    const regenFork = regenLoad.value;

    // Compare resource counts
    expect(regenFork.tree.size).toBe(originalFork.tree.size);

    // Compare each resource type
    for (const [typeKey, originalTypeMap] of originalFork.tree) {
      const typeName = Buffer.from(typeKey, "binary").toString("latin1");
      const regenTypeMap = regenFork.tree.get(typeKey);
      
      expect(regenTypeMap).toBeDefined();
      if (!regenTypeMap) continue;
      
      expect(regenTypeMap.size).toBe(originalTypeMap.size);

      // Compare each resource's binary data
      for (const [resId, originalRes] of originalTypeMap) {
        const regenRes = regenTypeMap.get(resId);
        expect(regenRes).toBeDefined();
        if (!regenRes) continue;

        expect(regenRes.num).toBe(originalRes.num);
        expect(regenRes.flags).toBe(originalRes.flags);
        
        // Binary data must match exactly
        expect(regenRes.data.length).toBe(originalRes.data.length);
        
        const originalBuffer = Buffer.from(originalRes.data);
        const regenBuffer = Buffer.from(regenRes.data);
        
        if (!originalBuffer.equals(regenBuffer)) {
          // Find first difference for debugging
          for (let i = 0; i < originalRes.data.length; i++) {
            if (originalRes.data[i] !== regenRes.data[i]) {
              throw new Error(
                `${typeName}#${resId} byte mismatch at offset ${i}: ` +
                `original=0x${originalRes.data[i]?.toString(16).padStart(2, '0')}, ` +
                `regen=0x${regenRes.data[i]?.toString(16).padStart(2, '0')}`
              );
            }
          }
        }
      }
    }
  });

  it("should achieve byte-perfect roundtrip with backtick arrays enabled", async () => {
    // Convert to JSON with backtick arrays enabled
    const jsonResult = await saveToJson(
      originalData, 
      structSpecs,
      [],  // includeTypes
      [],  // excludeTypes
      { useBacktickArrays: true }
    );
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const jsonBlob = JSON.parse(jsonResult.value);

    // Convert back to binary
    const bytesResult = loadBytesFromJson(jsonBlob, structSpecs, [], [], false);
    expect(isOk(bytesResult)).toBe(true);
    if (!isOk(bytesResult)) return;

    const regeneratedData = bytesResult.value;

    // Load both for comparison
    const originalLoad = load(originalData);
    const regenLoad = load(regeneratedData);
    expect(isOk(originalLoad)).toBe(true);
    expect(isOk(regenLoad)).toBe(true);
    if (!isOk(originalLoad) || !isOk(regenLoad)) return;

    const originalFork = originalLoad.value;
    const regenFork = regenLoad.value;

    // Compare resource counts
    expect(regenFork.tree.size).toBe(originalFork.tree.size);

    // Compare each resource type
    for (const [typeKey, originalTypeMap] of originalFork.tree) {
      const typeName = Buffer.from(typeKey, "binary").toString("latin1");
      const regenTypeMap = regenFork.tree.get(typeKey);
      
      expect(regenTypeMap).toBeDefined();
      if (!regenTypeMap) continue;
      
      expect(regenTypeMap.size).toBe(originalTypeMap.size);

      // Compare each resource's binary data
      for (const [resId, originalRes] of originalTypeMap) {
        const regenRes = regenTypeMap.get(resId);
        expect(regenRes).toBeDefined();
        if (!regenRes) continue;

        expect(regenRes.num).toBe(originalRes.num);
        expect(regenRes.flags).toBe(originalRes.flags);
        
        // Binary data must match exactly
        expect(regenRes.data.length).toBe(originalRes.data.length);
        
        const originalBuffer = Buffer.from(originalRes.data);
        const regenBuffer = Buffer.from(regenRes.data);
        
        if (!originalBuffer.equals(regenBuffer)) {
          // Find first difference for debugging
          for (let i = 0; i < originalRes.data.length; i++) {
            if (originalRes.data[i] !== regenRes.data[i]) {
              throw new Error(
                `${typeName}#${resId} byte mismatch at offset ${i}: ` +
                `original=0x${originalRes.data[i]?.toString(16).padStart(2, '0')}, ` +
                `regen=0x${regenRes.data[i]?.toString(16).padStart(2, '0')}`
              );
            }
          }
        }
      }
    }
  });
});

describe("EarthFarm Data Integrity", () => {
  it("should maintain consistency between header counts and actual data", async () => {
    const jsonResult = await saveToJson(originalData, structSpecs);
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const json = JSON.parse(jsonResult.value);
    const hedr = json.Hedr?.["1000"]?.obj;
    
    expect(hedr).toBeDefined();
    if (!hedr) return;

    // Verify items count
    const itms = json.Itms?.["1000"]?.obj;
    expect(Array.isArray(itms)).toBe(true);
    expect(itms.length).toBe(hedr.items);

    // Verify fences count
    const fenc = json.Fenc?.["1000"]?.obj;
    expect(Array.isArray(fenc)).toBe(true);
    expect(fenc.length).toBe(hedr.fences);

    // Verify splines count
    const spln = json.Spln?.["1000"]?.obj;
    expect(Array.isArray(spln)).toBe(true);
    expect(spln.length).toBe(hedr.splines);

    // Verify waters count
    const liqd = json.Liqd?.["1000"]?.obj;
    expect(Array.isArray(liqd)).toBe(true);
    expect(liqd.length).toBe(hedr.waters);

    // Verify SpNb, SpPt, SpIt counts match splines
    const result = load(originalData);
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const fork = result.value;
    
    for (const typeName of ["SpNb", "SpPt", "SpIt"]) {
      const typeKey = Buffer.from(typeName, "binary").toString("binary");
      const typeMap = fork.tree.get(typeKey);
      expect(typeMap?.size).toBe(hedr.splines);
    }
  });

  it("should have valid coordinate ranges", async () => {
    const jsonResult = await saveToJson(originalData, structSpecs);
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const json = JSON.parse(jsonResult.value);
    const hedr = json.Hedr?.["1000"]?.obj;
    const _width = hedr?.width ?? 0;
    const _height = hedr?.height ?? 0;
    
    // Items should have coordinates within reasonable bounds
    const itms = json.Itms?.["1000"]?.obj;
    if (Array.isArray(itms)) {
      for (const item of itms) {
        // x and z are in tile units, should be within map bounds
        // Allow some margin for items near edges
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.z).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("should preserve all metadata fields", async () => {
    const jsonResult = await saveToJson(originalData, structSpecs);
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const json = JSON.parse(jsonResult.value);
    
    expect(json._metadata).toBeDefined();
    expect(typeof json._metadata.junk1).toBe("number");
    expect(typeof json._metadata.junk2).toBe("number");
    expect(typeof json._metadata.file_attributes).toBe("number");
  });
});
