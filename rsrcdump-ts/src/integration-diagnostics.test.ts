/**
 * Integration tests for rsrcdump-ts
 * These tests verify end-to-end functionality
 */

import { describe, it, expect } from "vitest";
import { readFile, writeFile } from "fs/promises";
import {
  load,
  saveToJson,
  loadBytesFromJson,
  isOk,
} from "./index.js";

describe("Integration: resource diagnostics", () => {
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

      const originalLoad = load(new Uint8Array(data));
      if (!isOk(originalLoad)) throw new Error("original load failed");
      const regenLoad = load(bytesRes.value);
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
  });
});
