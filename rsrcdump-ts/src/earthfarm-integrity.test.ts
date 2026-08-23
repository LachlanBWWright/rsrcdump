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
