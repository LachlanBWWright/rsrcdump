import { describe, expect, it } from "vitest";
import { load, saveToBytes } from "../../src/rsrcdump.js";
import { jsonToResourceFork, resourceForkToJson } from "../../src/jsonio.js";
import { fixtureBytes, pangeaFixtures, resourceSnapshot } from "./fixtures.js";

const fixtures = pangeaFixtures();

describe("Pangea native resource corpus", () => {
  it("discovers terrain and skeleton resources from all seven resource-fork games", () => {
    expect(new Set(fixtures.map((fixture) => fixture.name.split("/")[0])).size).toBe(7);
    expect(fixtures.some((fixture) => fixture.name.endsWith("Terrain/EarthFarm.ter.rsrc"))).toBe(true);
    expect(fixtures.some((fixture) => fixture.name.endsWith("Skeletons/DoodleBug.skeleton.rsrc"))).toBe(true);
  });

  it.each(fixtures)("preserves binary resources: $name", ({ file }) => {
    const original = load(fixtureBytes(file));
    expect(original.resources.size).toBeGreaterThan(0);
    const restored = load(saveToBytes(original));
    expect(resourceSnapshot(restored)).toEqual(resourceSnapshot(original));
  });

  it.each(fixtures)("preserves hex JSON resources: $name", ({ file }) => {
    const original = load(fixtureBytes(file));
    const json = resourceForkToJson(original, [], [], new Map(), {}, true);
    const restored = load(saveToBytes(jsonToResourceFork(json)));
    expect(resourceSnapshot(restored)).toEqual(resourceSnapshot(original));
  });

  it.each(fixtures)("respects sliced buffer boundaries: $name", ({ file }) => {
    const original = fixtureBytes(file);
    const padded = new Uint8Array(original.length + 32).fill(0xa5);
    padded.set(original, 17);
    const restored = load(padded.subarray(17, 17 + original.length));
    expect(resourceSnapshot(restored)).toEqual(resourceSnapshot(load(original)));
  });
});
