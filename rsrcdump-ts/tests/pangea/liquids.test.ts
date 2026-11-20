import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createHash } from "node:crypto";
import { load } from "../../src/rsrcdump.js";
import { StructConverter } from "../../src/resconverters.js";
import { fixtureBytes, pangeaFixtures } from "./fixtures.js";

const spec = "Liqd:H x x I i h x x i 200f f f h h h h+:type,flags,height,numNubs,reserved,x`y[100],hotSpotX,hotSpotZ,bBoxTop,bBoxLeft,bBoxBottom,bBoxRight";
const recordsSchema = z.array(z.record(z.string(), z.number()));
const fixtures = pangeaFixtures().filter((fixture) => fixture.name.includes("/Terrain/") &&
  [...load(fixtureBytes(fixture.file)).resources.get("Liqd")?.values() ?? []]
    .some((resource) => resource.data.length > 0));

function expectRecordsMatch(actual: unknown, expected: Record<string, number>[]) {
  const parsed = recordsSchema.safeParse(actual);
  expect(parsed.success).toBe(true);
  if (!parsed.success) return;
  expect(parsed.data).toHaveLength(expected.length);
  for (const [index, record] of expected.entries()) {
    for (const [field, value] of Object.entries(record)) {
      expect(parsed.data[index]?.[field], `Liquid ${index}, field ${field}`).toBe(value);
    }
  }
}

describe("Pangea liquid geometry", () => {
  it.each(fixtures)("round-trips structured water records: $name", ({ file }) => {
    const original = load(fixtureBytes(file));
    const [converter] = StructConverter.fromTemplateStringWithTypename(spec);
    expect(converter).not.toBeNull();
    if (!converter) return;
    for (const resource of original.resources.get("Liqd")?.values() ?? []) {
      const unpacked: unknown = converter.unpack(resource);
      const records = recordsSchema.safeParse(unpacked);
      expect(records.success).toBe(true);
      if (!records.success) return;
      const restored = { ...resource, data: converter.pack(records.data) };
      const actual: unknown = converter.unpack(restored);
      expectRecordsMatch(actual, records.data);
      expect(createHash("sha256").update(restored.data).digest("hex"))
        .toBe(createHash("sha256").update(resource.data).digest("hex"));
    }
  });

  it("keeps Earth Farm's seven non-degenerate water polygons when a coordinate is edited", () => {
    const fixture = fixtures.find((item) => item.name.endsWith("/EarthFarm.ter.rsrc"));
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const resource = load(fixtureBytes(fixture.file)).resources.get("Liqd")?.get(1000);
    const [converter] = StructConverter.fromTemplateStringWithTypename(spec);
    expect(resource).toBeDefined();
    expect(converter).not.toBeNull();
    if (!resource || !converter) return;
    const unpacked: unknown = converter.unpack(resource);
    const records = recordsSchema.safeParse(unpacked);
    expect(records.success).toBe(true);
    if (!records.success) return;
    expect(records.data).toHaveLength(7);
    for (const liquid of records.data) {
      expect(liquid.numNubs).toBeGreaterThanOrEqual(3);
      expect(liquid.x_0).toBeGreaterThan(0);
      expect(liquid.y_0).toBeGreaterThan(0);
    }
    const first = records.data[0];
    if (!first) return;
    first.x_0 = 987.5;
    const packed = converter.pack(records.data);
    const restored: unknown = converter.unpack({ ...resource, data: packed });
    expectRecordsMatch(restored, records.data);
    expect(Array.from(resource.data)).not.toEqual(Array.from(packed));
  });

  it("rejects missing liquid coordinates instead of silently writing zero", () => {
    const fixture = fixtures.find((item) => item.name.endsWith("/EarthFarm.ter.rsrc"));
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const resource = load(fixtureBytes(fixture.file)).resources.get("Liqd")?.get(1000);
    const [converter] = StructConverter.fromTemplateStringWithTypename(spec);
    expect(resource).toBeDefined();
    expect(converter).not.toBeNull();
    if (!resource || !converter) return;
    const unpacked: unknown = converter.unpack(resource);
    const records = recordsSchema.safeParse(unpacked);
    expect(records.success).toBe(true);
    if (!records.success) return;
    const first = records.data[0];
    expect(first).toBeDefined();
    if (!first) return;
    delete first.x_0;
    expect(() => converter.pack(records.data)).toThrow();
  });
});
