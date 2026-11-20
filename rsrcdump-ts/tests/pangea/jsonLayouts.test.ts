import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { load } from "../../src/rsrcdump.js";
import { compileLayoutSchema, decodeResource, encodeResource, validateResource } from "../../src/layout/index.js";
import { fixtureBytes, pangeaFixtures } from "./fixtures.js";

function readDefinition(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../examples/${name}.json`, import.meta.url), "utf8"));
}

const water = compileLayoutSchema(readDefinition("pangea-water"));
const skeleton = compileLayoutSchema(readDefinition("pangea-skeleton"));
const fixtures = pangeaFixtures();
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("JSON layouts against real Pangea data", () => {
  it.each(fixtures)("preserves structured resource payloads: $name", ({ name, file }) => {
    const layouts = name.includes("/Skeletons/") ? skeleton : water;
    expect(layouts.isErr() ? layouts.error : null).toBeNull();
    if (layouts.isErr()) return;
    const fork = load(fixtureBytes(file));
    for (const [type, resources] of fork.resources) {
      if (!layouts.value.resources.has(type)) continue;
      for (const [id, resource] of resources) {
        const decoded = decodeResource(layouts.value, type, resource.data);
        expect(decoded.isErr() ? { resource: `${name}:${type}:${id}`, ...decoded.error } : null).toBeNull();
        if (decoded.isErr()) return;
        const value: unknown = JSON.parse(JSON.stringify(decoded.value.value));
        const validated = validateResource(layouts.value, type, value);
        expect(validated.isErr() ? validated.error : null).toBeNull();
        if (validated.isErr()) return;
        expect(validated.value).toEqual(value);
        const packed = encodeResource(layouts.value, type, value, decoded.value.preservedBytes);
        expect(packed.isErr() ? packed.error : null).toBeNull();
        if (packed.isErr()) return;
        expect(packed.value.length).toBe(resource.data.length);
        expect(digest(packed.value), `${type}:${id}`).toBe(digest(resource.data));
      }
    }
  });

  it("edits Earth Farm's nested points without flattening or collapsing its seven pools", () => {
    expect(water.isOk()).toBe(true);
    if (water.isErr()) return;
    const fixture = fixtures.find((item) => item.name.endsWith("/EarthFarm.ter.rsrc"));
    expect(fixture).toBeDefined();
    if (!fixture) return;
    const resource = load(fixtureBytes(fixture.file)).resources.get("Liqd")?.get(1000);
    expect(resource).toBeDefined();
    if (!resource) return;
    const decoded = decodeResource(water.value, "Liqd", resource.data);
    expect(decoded.isOk()).toBe(true);
    if (decoded.isErr()) return;
    const points = z.array(z.object({ nubs: z.array(z.object({ x: z.number(), y: z.number() })) }).passthrough()).safeParse(decoded.value.value);
    expect(points.success).toBe(true);
    if (!points.success) return;
    expect(points.data).toHaveLength(7);
    const point = points.data[0]?.nubs[0];
    expect(point).toEqual({ x: 988, y: 136 });
    if (!point) return;
    point.x = 987.5;
    const packed = encodeResource(water.value, "Liqd", points.data, decoded.value.preservedBytes);
    expect(packed.isOk()).toBe(true);
    if (packed.isErr()) return;
    const restored = decodeResource(water.value, "Liqd", packed.value);
    expect(restored.isOk()).toBe(true);
    if (restored.isOk()) expect(restored.value.value).toEqual(points.data);
    const missing: unknown = points.data.map((liquid) => ({ ...liquid, nubs: liquid.nubs.map(({ y }) => ({ y })) }));
    const rejected = encodeResource(water.value, "Liqd", missing);
    expect(rejected.isErr()).toBe(true);
    if (rejected.isErr()) expect(rejected.error.path).toBe("Liqd[0].nubs[0].x");
  });
});
