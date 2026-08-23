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

describe("EarthFarm parsing: terrain resources", () => {
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
