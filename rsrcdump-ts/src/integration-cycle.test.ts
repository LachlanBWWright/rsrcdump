/**
 * Integration tests for rsrcdump-ts
 * These tests verify end-to-end functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile, writeFile } from "fs/promises";
import {
  load,
  saveToJson,
  loadBytesFromJsonAsync,
  isOk,
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

describe("Integration: extract-create cycle", () => {
  describe("End-to-End Workflow", () => {
    it("should complete full extract-create cycle", async () => {
      // Step 1: Load the original file
      const data = await readFile("../EarthFarm.ter.rsrc");
      const loadResult = load(new Uint8Array(data));
      expect(isOk(loadResult)).toBe(true);

      if (!isOk(loadResult)) return;

      const originalFork = loadResult.value;
      const originalResourceCount = Array.from(
        originalFork.tree.values(),
      ).reduce((sum, map) => sum + map.size, 0);

      // Step 2: Convert to JSON
      const jsonResult = await saveToJson(new Uint8Array(data), structSpecs);
      expect(isOk(jsonResult)).toBe(true);

      if (!isOk(jsonResult)) return;

      // Step 3: Parse JSON
      const jsonBlob = JSON.parse(jsonResult.value);
      expect(jsonBlob._metadata).toBeDefined();

      // Save JSON to repo root so Python tests can load and compare it
      try {
        await writeFile(
          "../typescript_test_output.json",
          JSON.stringify(jsonBlob, null, 2),
          "utf-8",
        );
         
        console.log(
          "Saved TypeScript JSON output to ../typescript_test_output.json",
        );
      } catch (err) {
         
        console.warn("Failed to save TypeScript JSON output:", err);
      }

      // Step 4: Convert back to binary
      const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
      if (!isOk(bytesResult)) {
         
        console.error("loadBytesFromJsonAsync failed:", bytesResult.error);
        try {
          await writeFile(
            "../diagnostic_ts_json.json",
            JSON.stringify(jsonBlob, null, 2),
            "utf-8",
          );
           
          console.error("Wrote diagnostic JSON to ../diagnostic_ts_json.json");
        } catch (e) {
           
          console.error("Failed to write diagnostic JSON:", e);
        }
      }
      expect(isOk(bytesResult)).toBe(true);

      if (!isOk(bytesResult)) return;

      // Step 5: Load the regenerated binary
      const regenResult = await load(bytesResult.value);
      expect(isOk(regenResult)).toBe(true);

      if (!isOk(regenResult)) return;

      const regenFork = regenResult.value;
      const regenResourceCount = Array.from(regenFork.tree.values()).reduce(
        (sum, map) => sum + map.size,
        0,
      );

      expect(regenResourceCount).toBe(originalResourceCount);
      expect(regenFork.tree.size).toBe(originalFork.tree.size);

      // Verify per-type counts to identify any differences
      const allTypeKeys = new Set<string>([
        ...Array.from(originalFork.tree.keys()),
        ...Array.from(regenFork.tree.keys()),
      ]);
      for (const typeKey of allTypeKeys) {
        const typeName = Buffer.from(typeKey, "binary").toString("latin1");
        const origCount = originalFork.tree.get(typeKey)?.size || 0;
        const regenCount = regenFork.tree.get(typeKey)?.size || 0;
        // Print each type check so failing type is visible in logs
         
        console.error(
          `Checking ${typeName}: original=${origCount} regen=${regenCount}`,
        );
        expect(regenCount).toBe(origCount);
      }

      // Verify a small, representative set of resources are identical (by bytes)
      const hedKey = Buffer.from("Hedr", "binary").toString("binary");
      const alisKey = Buffer.from("alis", "binary").toString("binary");

      if (originalFork.tree.has(hedKey) && regenFork.tree.has(hedKey)) {
        const origHed = originalFork.tree.get(hedKey);
        const regenHed = regenFork.tree.get(hedKey);

        if (origHed && regenHed) {
          // Expect same resource IDs for Hedr
          expect(Array.from(regenHed.keys())).toEqual(Array.from(origHed.keys()));

          // Compare a canonical resource if present
          if (origHed.has(1000) && regenHed.has(1000)) {
            const orig = origHed.get(1000);
            const regen = regenHed.get(1000);
            if (orig && regen) {
              expect(Buffer.from(regen.data)).toEqual(Buffer.from(orig.data));
              expect(regen.order).toBe(orig.order);
            }
          }
        }
      }

      if (originalFork.tree.has(alisKey) && regenFork.tree.has(alisKey)) {
        const origAlis = originalFork.tree.get(alisKey);
        const regenAlis = regenFork.tree.get(alisKey);
        if (!origAlis || !regenAlis) return;
        
        // pick an arbitrary resource id and compare its bytes
        const ids = Array.from(origAlis.keys());
        if (ids.length > 0) {
          const id = ids[0];
          if (!id) return;
          const origRes = origAlis.get(id);
          const regenRes = regenAlis.get(id);
          if (!origRes || !regenRes) return;
          
          expect(Buffer.from(regenRes.data)).toEqual(
            Buffer.from(origRes.data),
          );
        }
      }

      // Verify per-type ordering is preserved
      for (const [typeKey, origMap] of originalFork.tree) {
        const regenMap = regenFork.tree.get(typeKey);
        if (!regenMap) continue;
        
        const origOrder = Array.from(origMap.values())
          .sort((a, b) => a.order - b.order)
          .map((r) => r.num);
        const regenOrder = Array.from(regenMap.values())
          .sort((a, b) => a.order - b.order)
          .map((r) => r.num);
        expect(regenOrder).toEqual(origOrder);
      }
    });

  });
});
