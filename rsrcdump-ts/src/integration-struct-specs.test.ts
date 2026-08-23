import { readFile } from "fs/promises";
import { describe, expect, it } from "vitest";
import {
  isOk,
  load,
  loadBytesFromJsonAsync,
  saveToJson,
  type ResourceFork,
} from "./index.js";
import { isRecord } from "./buffer-utils.js";

async function readStructSpecs(): Promise<string[]> {
  const contents = await readFile("../sample-specs.txt", "utf-8");
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//"));
}

function specifiedTypes(specs: string[]): Set<string> {
  return new Set(
    specs
      .map((spec) => spec.slice(0, spec.indexOf(":")).trim())
      .filter((type) => type.length === 4),
  );
}

function expectNoSpecifiedConversionErrors(
  json: Record<string, unknown>,
  specs: string[],
): void {
  const expectedTypes = specifiedTypes(specs);
  for (const [type, records] of Object.entries(json)) {
    if (!expectedTypes.has(type) || !isRecord(records)) continue;
    for (const resource of Object.values(records)) {
      if (!isRecord(resource)) continue;
      expect(resource.conversion_error).toBeUndefined();
    }
  }
}

function expectForkBytesEqual(original: ResourceFork, regenerated: ResourceFork): void {
  expect(regenerated.tree.size).toBe(original.tree.size);
  for (const [type, originalResources] of original.tree) {
    const regeneratedResources = regenerated.tree.get(type);
    expect(regeneratedResources).toBeDefined();
    if (!regeneratedResources) continue;
    expect(regeneratedResources.size).toBe(originalResources.size);

    for (const [id, originalResource] of originalResources) {
      const regeneratedResource = regeneratedResources.get(id);
      expect(regeneratedResource).toBeDefined();
      if (!regeneratedResource) continue;
      expect(regeneratedResource.data).toEqual(originalResource.data);
    }
  }
}

describe("Integration: struct specifications", () => {
  it("round-trips every specified resource without conversion errors", async () => {
    const data = new Uint8Array(await readFile("../EarthFarm.ter.rsrc"));
    const specs = await readStructSpecs();
    const jsonResult = await saveToJson(data, specs);
    expect(isOk(jsonResult)).toBe(true);
    if (!isOk(jsonResult)) return;

    const json: unknown = JSON.parse(jsonResult.value);
    expect(isRecord(json)).toBe(true);
    if (!isRecord(json)) return;
    expectNoSpecifiedConversionErrors(json, specs);

    const headerRecords = json.Hedr;
    expect(isRecord(headerRecords)).toBe(true);
    if (!isRecord(headerRecords)) return;
    const headerResource = headerRecords["1000"];
    expect(isRecord(headerResource)).toBe(true);
    if (!isRecord(headerResource)) return;
    expect(isRecord(headerResource.obj)).toBe(true);

    const bytesResult = await loadBytesFromJsonAsync(json, specs, [], [], false);
    expect(isOk(bytesResult)).toBe(true);
    if (!isOk(bytesResult)) return;

    const original = load(data);
    const regenerated = load(bytesResult.value);
    expect(isOk(original)).toBe(true);
    expect(isOk(regenerated)).toBe(true);
    if (!isOk(original) || !isOk(regenerated)) return;
    expectForkBytesEqual(original.value, regenerated.value);
  });
});
