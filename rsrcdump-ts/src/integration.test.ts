/**
 * Integration tests for rsrcdump-ts
 * These tests verify end-to-end functionality
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile, writeFile } from "fs/promises";
import {
  load,
  saveToJson,
  loadBytesFromJson,
  loadBytesFromJsonAsync,
  packResourceFork,
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

describe("Integration Tests", () => {
  describe("End-to-End Workflow", () => {
    it("debug: per-type counts should match after struct-spec roundtrip", async () => {
      // Debugging helper to pinpoint mismatches
      const data = await readFile("../EarthFarm.ter.rsrc");
      const specsContent = await readFile("../sample-specs.txt", "utf-8");
      const structSpecs = specsContent
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("//"));

      const jsonRes = await saveToJson(new Uint8Array(data), structSpecs);
      if (!isOk(jsonRes))
        throw new Error(`saveToJson failed: ${jsonRes.error}`);
      const jsonBlob = JSON.parse(jsonRes.value);

      const bytesRes = loadBytesFromJson(jsonBlob, structSpecs, [], [], false);
      if (!isOk(bytesRes)) {
        console.error("loadBytesFromJson failed:", bytesRes.error);
        await writeFile(
          "../diagnostic_ts_json.json",
          JSON.stringify(jsonBlob, null, 2),
          "utf-8",
        );
        throw new Error(`loadBytesFromJson failed: ${bytesRes.error}`);
      }

      const originalLoad = await load(new Uint8Array(data));
      if (!isOk(originalLoad)) throw new Error("original load failed");
      const regenLoad = await load(bytesRes.value);
      if (!isOk(regenLoad)) throw new Error("regen load failed");

      // Compare per-type counts and throw a clear message on first mismatch
      const allKeys = new Set([
        ...originalLoad.value.tree.keys(),
        ...regenLoad.value.tree.keys(),
      ]);
      
      let hasMatches = false;
      for (const key of allKeys) {
        const name = Buffer.from(key, "binary").toString("latin1");
        const orig = originalLoad.value.tree.get(key)?.size || 0;
        const regen = regenLoad.value.tree.get(key)?.size || 0;
        if (orig !== regen) {
          const msg = `Mismatch for ${name}: original ${orig}, regen ${regen}`;
          console.error(msg);
          throw new Error(msg);
        }
        hasMatches = true;
      }
      
      // Add assertion for vitest
      expect(hasMatches).toBe(true);
    });
    it("should complete full extract-create cycle", async () => {
      // Step 1: Load the original file
      const loadResult = await load("../EarthFarm.ter.rsrc");
      expect(isOk(loadResult)).toBe(true);

      if (!isOk(loadResult)) return;

      const originalFork = loadResult.value;
      const originalResourceCount = Array.from(
        originalFork.tree.values(),
      ).reduce((sum, map) => sum + map.size, 0);

      // Step 2: Convert to JSON
      const data = await readFile("../EarthFarm.ter.rsrc");
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
        // eslint-disable-next-line no-console
        console.log(
          "Saved TypeScript JSON output to ../typescript_test_output.json",
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Failed to save TypeScript JSON output:", err);
      }

      // Step 4: Convert back to binary
      const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
      if (!isOk(bytesResult)) {
        // eslint-disable-next-line no-console
        console.error("loadBytesFromJsonAsync failed:", bytesResult.error);
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

      // Step 5: Load the regenerated binary
      const regenResult = await load(bytesResult.value);
      expect(isOk(regenResult)).toBe(true);

      if (!isOk(regenResult)) return;

      const regenFork = regenResult.value;
      const regenResourceCount = Array.from(regenFork.tree.values()).reduce(
        (sum, map) => sum + map.size,
        0,
      );

      // Verify counts match
      if (
        regenResourceCount !== originalResourceCount ||
        regenFork.tree.size !== originalFork.tree.size
      ) {
        const lines: string[] = [];
        lines.push(
          `Resource count mismatch: original total ${originalResourceCount}, regen total ${regenResourceCount}`,
        );

        for (const [typeKey, origMap] of originalFork.tree) {
          const typeName = Buffer.from(typeKey, "binary").toString("latin1");
          const regenMap = regenFork.tree.get(typeKey);
          lines.push(
            `Type ${typeName}: original ${origMap.size}, regen ${
              regenMap ? regenMap.size : 0
            }`,
          );
          if (!regenMap) {
            lines.push(`  Missing entire type ${typeName}`);
          } else {
            const missingIds = Array.from(origMap.keys()).filter(
              (k) => !regenMap.has(k),
            );
            if (missingIds.length > 0) {
              lines.push(
                `  Missing IDs for ${typeName}: ${missingIds
                  .slice(0, 10)
                  .join(", ")}${missingIds.length > 10 ? "..." : ""}`,
              );
            }
          }
        }

        const message = lines.join("\n");
        // eslint-disable-next-line no-console
        console.error(message);

        // Write structured diagnostic file for offline inspection
        try {
          const originalCounts: Record<string, number> = {};
          const regenCounts: Record<string, number> = {};
          const missing: Record<string, number[]> = {};

          for (const [typeKey, origMap] of originalFork.tree) {
            const typeName = Buffer.from(typeKey, "binary").toString("latin1");
            originalCounts[typeName] = origMap.size;
            const regenMap = regenFork.tree.get(typeKey);
            regenCounts[typeName] = regenMap ? regenMap.size : 0;
            if (regenMap) {
              const missingIds = Array.from(origMap.keys()).filter(
                (k) => !regenMap.has(k),
              );
              if (missingIds.length > 0)
                missing[typeName] = missingIds.slice(0, 100);
            } else {
              missing[typeName] = Array.from(origMap.keys()).slice(0, 100);
            }
          }

          await writeFile(
            "../diagnostic_regen_diff.json",
            JSON.stringify({ originalCounts, regenCounts, missing }, null, 2),
            "utf-8",
          );
          // eslint-disable-next-line no-console
          console.error("Wrote diagnostic_regen_diff.json");
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to write regen diagnostic:", e);
        }

        throw new Error(message);
      }

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
        // eslint-disable-next-line no-console
        console.error(
          `Checking ${typeName}: original=${origCount} regen=${regenCount}`,
        );
        expect(regenCount).toBe(origCount);
      }

      // Verify a small, representative set of resources are identical (by bytes)
      const hedKey = Buffer.from("Hedr", "binary").toString("binary");
      const alisKey = Buffer.from("alis", "binary").toString("binary");

      if (originalFork.tree.has(hedKey) && regenFork.tree.has(hedKey)) {
        const origHed = originalFork.tree.get(hedKey)!;
        const regenHed = regenFork.tree.get(hedKey)!;

        // Expect same resource IDs for Hedr
        expect(Array.from(regenHed.keys())).toEqual(Array.from(origHed.keys()));

        // Compare a canonical resource if present
        if (origHed.has(1000) && regenHed.has(1000)) {
          const orig = origHed.get(1000)!;
          const regen = regenHed.get(1000)!;
          expect(Buffer.from(regen.data)).toEqual(Buffer.from(orig.data));
          expect(regen.order).toBe(orig.order);
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

    it(
      "should reconstruct canonical resource-fork bytes exactly",
      { timeout: 20000 },
      async () => {
        // Load original and pack canonical bytes
        const rawData = await readFile("../EarthFarm.ter.rsrc");
        const originalLoad = await load(new Uint8Array(rawData));
        expect(isOk(originalLoad)).toBe(true);
        if (!isOk(originalLoad)) return;
        
        const originalFork = originalLoad.value;

        const origPack = packResourceFork(originalFork);
        expect(origPack.ok).toBe(true);
        if (!origPack.ok) return;

        // Convert via JSON and get packed bytes (no ADF wrapper)
        const jsonRes = await saveToJson(new Uint8Array(rawData), structSpecs);
        expect(isOk(jsonRes)).toBe(true);
        if (!isOk(jsonRes)) return;
        
        const jsonBlob = JSON.parse(jsonRes.value);

        const regenBytesRes = loadBytesFromJson(
          jsonBlob,
          structSpecs,
          [],
          [],
          false,
        );
        if (!isOk(regenBytesRes)) {
          // eslint-disable-next-line no-console
          console.error("loadBytesFromJson failed:", regenBytesRes.error);
          try {
            await writeFile(
              "../diagnostic_ts_json.json",
              JSON.stringify(jsonBlob, null, 2),
              "utf-8",
            );
            // eslint-disable-next-line no-console
            console.error(
              "Wrote diagnostic JSON to ../diagnostic_ts_json.json",
            );
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to write diagnostic JSON:", e);
          }
        }
        expect(isOk(regenBytesRes)).toBe(true);
        if (!isOk(regenBytesRes)) return;
        if (!origPack.ok) return;

        // Compare canonical packed bytes
        expect(Buffer.from(regenBytesRes.value)).toEqual(
          Buffer.from(origPack.value),
        );
      },
    );

    it("should handle struct specs in round-trip", async () => {
      try {
        const data = await readFile("../EarthFarm.ter.rsrc");

        // Read struct specs
        let structSpecs: string[] = [];
        try {
          const specsContent = await readFile("../sample-specs.txt", "utf-8");
          structSpecs = specsContent
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("//"));
        } catch {
          // Skip if file doesn't exist
          return;
        }

        // Convert with struct specs
        console.error(
          "Entering struct-specs round-trip test, structSpecs length:",
          structSpecs.length,
        );
        const jsonResult = await saveToJson(new Uint8Array(data), structSpecs);
        if (!isOk(jsonResult)) {
          try {
            await writeFile(
              "../diagnostic_ts_json.json",
              JSON.stringify(jsonResult, null, 2),
              "utf-8",
            );
          } catch (e) {
            // ignore
          }
          throw new Error(`saveToJson failed: ${jsonResult.error}`);
        }

        const jsonBlob = JSON.parse(jsonResult.value);
        console.error(
          "Top-level JSON keys:",
          Object.keys(jsonBlob).slice(0, 20).join(", "),
        );

        // Verify structured data
        if (jsonBlob.Hedr && jsonBlob.Hedr["1000"]) {
          const hedr = jsonBlob.Hedr["1000"].obj;
          console.error("Hedr[1000].obj keys:", Object.keys(hedr));
          if (!hedr || typeof hedr !== "object")
            throw new Error("Missing Hedr[1000].obj");
          if (!Object.prototype.hasOwnProperty.call(hedr, "vers"))
            throw new Error('Hedr missing "vers" property');
          if (!Object.prototype.hasOwnProperty.call(hedr, "width"))
            throw new Error('Hedr missing "width" property');
          if (!Object.prototype.hasOwnProperty.call(hedr, "height"))
            throw new Error('Hedr missing "height" property');
        } else {
          console.error("Hedr or Hedr[1000] missing from JSON");
        }

        // Fail tests if any type specified in structSpecs produced a conversion_error
        const specTypes = new Set<string>();
        for (const spec of structSpecs) {
          const colon = spec.indexOf(":");
          if (colon === -1) continue;
          const t = spec.slice(0, colon).trim();
          if (t.length === 4) specTypes.add(t);
        }

        for (const [typeName, typeRecords] of Object.entries(jsonBlob)) {
          if (typeName.startsWith("_") || typeName.length > 4) continue;
          if (typeof typeRecords !== "object" || typeRecords === null) continue;
          for (const [resIdStr, resBlob] of Object.entries(
            typeRecords as Record<string, unknown>,
          )) {
            if (typeof resBlob !== "object" || resBlob === null) continue;
            const wrapper = resBlob as { conversion_error?: unknown };
            if (specTypes.has(typeName)) {
              // This type had a struct spec provided — it must NOT have a conversion_error
              expect(wrapper.conversion_error).toBeUndefined();
            } else {
              // Types without a spec may have conversion_error (fallbacks, etc.) — do not fail here
              if (wrapper.conversion_error !== undefined) {
                // eslint-disable-next-line no-console
                console.error(
                  `Found conversion_error for non-specified ${typeName}#${resIdStr}:`,
                  wrapper.conversion_error,
                );
              }
            }
          }
        }

        // Convert back
        const bytesResult = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
        // eslint-disable-next-line no-console
        console.error(
          "bytesResult.ok:",
          bytesResult.ok,
          "error:",
          isOk(bytesResult) ? "none" : bytesResult.error,
        );
        if (!isOk(bytesResult)) {
          // eslint-disable-next-line no-console
          console.error(
            "loadBytesFromJsonAsync failed (struct specs test):",
            bytesResult.error,
          );
          try {
            await writeFile(
              "../diagnostic_ts_json.json",
              JSON.stringify(jsonBlob, null, 2),
              "utf-8",
            );
            // eslint-disable-next-line no-console
            console.error(
              "Wrote diagnostic JSON to ../diagnostic_ts_json.json",
            );
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error("Failed to write diagnostic JSON:", e);
          }
          throw new Error(
            `loadBytesFromJsonAsync failed: ${bytesResult.error}`,
          );
        }

        // Additional debug: compare original and regenerated resource bytes and write diagnostics for differences
        const originalLoad = await load(new Uint8Array(data));
        if (!isOk(originalLoad)) throw new Error("original load failed");
        const regenLoad = await load(bytesResult.value);
        if (!isOk(regenLoad)) throw new Error("regen load failed");

        const origFork = originalLoad.value;
        const regenFork = regenLoad.value;

        for (const [typeKey, origMap] of origFork.tree) {
          const typeName = Buffer.from(typeKey, "binary").toString("latin1");
          const regenMap = regenFork.tree.get(typeKey);
          if (!regenMap) {
            console.error(`Missing type after regen: ${typeName}`);
            continue;
          }

          for (const [resId, res] of origMap) {
            if (!regenMap.has(resId)) {
              console.error(`Missing resource ${typeName}#${resId} in regen`);
              continue;
            }
            const regenRes = regenMap.get(resId)!;
            if (regenRes.data.length !== res.data.length) {
              console.error(
                `Resource ${typeName}#${resId} length mismatch: orig ${res.data.length} regen ${regenRes.data.length}`,
              );
              try {
                await writeFile(
                  `../diagnostic_${typeName}_${resId}.bin`,
                  Buffer.from(res.data),
                  "binary",
                );
                await writeFile(
                  `../diagnostic_${typeName}_${resId}_regen.bin`,
                  Buffer.from(regenRes.data),
                  "binary",
                );
                console.error(
                  "Wrote diagnostic binary pair for",
                  `${typeName}#${resId}`,
                );
              } catch (e) {
                console.error("Failed to write binary diagnostics:", e);
              }
            } else {
              // Compare content
              const origBuf = Buffer.from(res.data);
              const regenBuf = Buffer.from(regenRes.data);
              if (!origBuf.equals(regenBuf)) {
                console.error(`Resource ${typeName}#${resId} content differs`);
                try {
                  await writeFile(
                    `../diagnostic_${typeName}_${resId}.bin`,
                    origBuf,
                    "binary",
                  );
                  await writeFile(
                    `../diagnostic_${typeName}_${resId}_regen.bin`,
                    regenBuf,
                    "binary",
                  );
                  console.error(
                    "Wrote diagnostic binary pair for",
                    `${typeName}#${resId}`,
                  );
                } catch (e) {
                  console.error("Failed to write binary diagnostics:", e);
                }
              }
            }
          }
        }
      } catch (err: any) {
        // Ensure the error is visible in logs and write diagnostics
        // eslint-disable-next-line no-console
        console.error("Test error:", err && err.message ? err.message : err);
        try {
          await writeFile(
            "../diagnostic_failure_stack.txt",
            err && err.stack ? err.stack : String(err),
            "utf-8",
          );
          // eslint-disable-next-line no-console
          console.error("Wrote diagnostic_failure_stack.txt");
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("Failed to write diagnostic failure stack:", e);
        }
        throw err;
      }
    });
  });

  describe("Resource Type Handling", () => {
    it("should handle all resource types correctly", async () => {
      const result = await load("../EarthFarm.ter.rsrc");
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
      const result = await load("../EarthFarm.ter.rsrc");
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const fork = result.value;

      // Collect all resources with orders
      const resources: Array<{ type: string; id: number; order: number }> = [];

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
      const result = await load("../EarthFarm.ter.rsrc");
      expect(isOk(result)).toBe(true);

      if (!isOk(result)) return;

      const data = new Uint8Array(await readFile("../EarthFarm.ter.rsrc"));

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
        expect(result.error).toMatch(/Missing _metadata|Failed to pack/);
      }
    });
  });

  describe("String Representation", () => {
    it("should produce readable resource fork description", async () => {
      const result = await load("../EarthFarm.ter.rsrc");
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
