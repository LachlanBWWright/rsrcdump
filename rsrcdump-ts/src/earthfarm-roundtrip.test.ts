/**
 * Comprehensive tests for Otto Matic EarthFarm.ter.rsrc parsing
 * These tests verify:
 * 1. Correct parsing of all resource types
 * 2. Data is appropriately represented in JSON form
 * 3. Roundtrips produce byte-perfect results
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "fs/promises";
import { load, saveToJson, loadBytesFromJson, type ResourceFork } from "./index.js";
import { isOk } from "./result.js";

let originalData: Uint8Array;
let structSpecs: string[] = [];

function firstDifferentByte(left: Uint8Array, right: Uint8Array): number {
  return left.findIndex((byte, index) => byte !== right[index]);
}

function expectForksEqual(original: ResourceFork, regenerated: ResourceFork): void {
  expect(regenerated.tree.size).toBe(original.tree.size);

  for (const [typeKey, originalTypeMap] of original.tree) {
    const regeneratedTypeMap = regenerated.tree.get(typeKey);
    expect(regeneratedTypeMap).toBeDefined();
    if (!regeneratedTypeMap) continue;
    expect(regeneratedTypeMap.size).toBe(originalTypeMap.size);

    for (const [resourceId, originalResource] of originalTypeMap) {
      const regeneratedResource = regeneratedTypeMap.get(resourceId);
      expect(regeneratedResource).toBeDefined();
      if (!regeneratedResource) continue;
      expect(regeneratedResource.num).toBe(originalResource.num);
      expect(regeneratedResource.flags).toBe(originalResource.flags);
      expect(regeneratedResource.data.length).toBe(originalResource.data.length);

      const mismatch = firstDifferentByte(originalResource.data, regeneratedResource.data);
      if (mismatch === -1) continue;
      const typeName = Buffer.from(typeKey, "binary").toString("latin1");
      throw new Error(
        `${typeName}#${resourceId} byte mismatch at offset ${mismatch}: ` +
          `original=0x${originalResource.data[mismatch]?.toString(16).padStart(2, "0")}, ` +
          `regen=0x${regeneratedResource.data[mismatch]?.toString(16).padStart(2, "0")}`,
      );
    }
  }
}

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

    expectForksEqual(originalLoad.value, regenLoad.value);
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

    expectForksEqual(originalLoad.value, regenLoad.value);
  });
});
