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
  packResourceFork,
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

describe("Integration: format options", () => {
  describe("End-to-End Workflow", () => {
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

        // Convert via JSON and get packed bytes (no ADF wrapper, disable backtick arrays for byte-perfect round-trip)
        const jsonRes = await saveToJson(new Uint8Array(rawData), structSpecs, [], [], { useBacktickArrays: false });
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
           
          console.error("loadBytesFromJson failed:", regenBytesRes.error);
          try {
            await writeFile(
              "../diagnostic_ts_json.json",
              JSON.stringify(jsonBlob, null, 2),
              "utf-8",
            );
             
            console.error(
              "Wrote diagnostic JSON to ../diagnostic_ts_json.json",
            );
          } catch (e) {
             
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

  });
});
