/**
 * Performance tests for rsrcdump-ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile, writeFile } from "fs/promises";
import { load, saveToJson, loadBytesFromJsonAsync, isOk } from "./index.js";

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

describe("Performance", () => {
  it("should load resource fork in reasonable time", async () => {
    const fileData = await readFile("../EarthFarm.ter.rsrc");
    
    const start = Date.now();

    const result = load(new Uint8Array(fileData));

    const elapsed = Date.now() - start;

    expect(isOk(result)).toBe(true);
    expect(elapsed).toBeLessThan(1000); // Should load in under 1 second

    console.log(`Load time: ${elapsed}ms`);
  });

  it("should convert to JSON in reasonable time", async () => {
    const data = await readFile("../EarthFarm.ter.rsrc");

    const start = Date.now();

    const result = await saveToJson(new Uint8Array(data), structSpecs);

    const elapsed = Date.now() - start;

    expect(isOk(result)).toBe(true);
    expect(elapsed).toBeLessThan(5000); // Should convert in under 5 seconds

    console.log(`JSON conversion time: ${elapsed}ms`);
  });

  it("should perform round-trip in reasonable time", async () => {
    const data = await readFile("../EarthFarm.ter.rsrc");

    const start = Date.now();

    // Extract to JSON
    const jsonResult = await saveToJson(new Uint8Array(data), structSpecs);
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    // Convert back to binary
    const jsonBlob = JSON.parse(jsonResult.value);
    const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
    if (!isOk(bytesResult)) {
      // eslint-disable-next-line no-console
      console.error(
        "loadBytesFromJsonAsync failed (performance test):",
        bytesResult.error,
      );
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

    // Extract again
    const secondJsonResult = await saveToJson(bytesResult.value, structSpecs);
    expect(isOk(secondJsonResult)).toBe(true);

    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(10000); // Should complete in under 10 seconds

    console.log(`Round-trip time: ${elapsed}ms`);
  });

  it("should handle multiple loads efficiently", async () => {
    const iterations = 10;
    const times: number[] = [];

    const fileData = await readFile("../EarthFarm.ter.rsrc");
    
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      const result = load(new Uint8Array(fileData));
      const elapsed = Date.now() - start;

      expect(isOk(result)).toBe(true);
      times.push(elapsed);
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log(`Multiple loads (${iterations} iterations):`);
    console.log(`  Average: ${avgTime.toFixed(1)}ms`);
    console.log(`  Min: ${minTime}ms`);
    console.log(`  Max: ${maxTime}ms`);

    expect(avgTime).toBeLessThan(1000);
  });

  it("should handle large resource efficiently", async () => {
    const fileData = await readFile("../EarthFarm.ter.rsrc");
    const result = load(new Uint8Array(fileData));
    expect(isOk(result)).toBe(true);

    if (!isOk(result)) return;

    const fork = result.value;

    // Find the largest resource
    let largestSize = 0;
    let largestType = "";
    let largestId = 0;

    for (const [typeKey, typeMap] of fork.tree) {
      for (const [resId, res] of typeMap) {
        if (res.data.length > largestSize) {
          largestSize = res.data.length;
          largestType = Buffer.from(typeKey, "binary").toString("latin1");
          largestId = resId;
        }
      }
    }

    console.log(
      `Largest resource: ${largestType} #${largestId} (${largestSize} bytes)`,
    );
    expect(largestSize).toBeGreaterThan(0);
  });
});
