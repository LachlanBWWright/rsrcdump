import { describe, expect, it } from "vitest";
import { bytesToBinary } from "./buffer-utils.js";
import {
  jsonStringToResourceFork,
  jsonToResourceFork,
  resourceForkToJson,
  resourceForkToJsonString,
  type JsonBlob,
} from "./jsonio.js";
import {
  createResource,
  createResourceFork,
  type ResourceConverter,
} from "./index.js";
import { err } from "./result.js";

const testType = new Uint8Array([84, 69, 83, 84]);
const typeKey = bytesToBinary(testType);
const converters = new Map<string, ResourceConverter>();

function blob(types: Record<string, unknown> = {}): JsonBlob {
  return {
    _metadata: { junk1: 1, junk2: 2, file_attributes: 3 },
    ...types,
  };
}

describe("JSON resource conversion edges", () => {
  it("preserves metadata and optional resource fields", () => {
    const fork = createResourceFork();
    fork.junkNextresmap = 1;
    fork.junkFilerefnum = 2;
    fork.fileAttributes = 3;
    fork.tree.set(
      typeKey,
      new Map([
        [7, createResource(testType, 7, new Uint8Array([0xab]), new Uint8Array([78]), 4, 5, 6)],
      ]),
    );

    const result = resourceForkToJson(fork, [], [], converters, { custom: true });
    expect(result).toEqual({
      ok: true,
      value: {
        _metadata: { junk1: 1, junk2: 2, file_attributes: 3, custom: true },
        TEST: { "7": { name: "N", flags: 4, junk: 5, order: 6, data: "AB" } },
      },
    });
  });

  it("filters included and excluded types", () => {
    const fork = createResourceFork();
    fork.tree.set(typeKey, new Map([[1, createResource(testType, 1, new Uint8Array())]]));
    const otherType = new Uint8Array([79, 84, 72, 82]);
    fork.tree.set(
      bytesToBinary(otherType),
      new Map([[2, createResource(otherType, 2, new Uint8Array())]]),
    );

    expect(resourceForkToJson(fork, [testType], [], converters)).toMatchObject({
      ok: true,
      value: { TEST: expect.anything() },
    });
    expect(resourceForkToJson(fork, [], [testType], converters)).toMatchObject({
      ok: true,
      value: { OTHR: expect.anything() },
    });
  });

  it("falls back to base16 when a converter cannot unpack", () => {
    const fork = createResourceFork();
    fork.tree.set(typeKey, new Map([[1, createResource(testType, 1, new Uint8Array([0xff]))]]));
    const failing: ResourceConverter = {
      separateFile: "",
      jsonKey: "obj",
      unpack: () => err("unsupported"),
      pack: () => err("unsupported"),
    };

    expect(resourceForkToJson(fork, [], [], new Map([[typeKey, failing]]))).toEqual({
      ok: true,
      value: {
        _metadata: { junk1: 0, junk2: 0, file_attributes: 0 },
        TEST: { "1": { conversion_error: "unsupported", data: "FF" } },
      },
    });
  });

  it("builds resources from base16 and applies filters", () => {
    const json = blob({
      TEST: { "7": { name: "N", flags: 4, junk: 5, order: 6, data: "AB" } },
      OTHR: { "8": { data: "CD" } },
      descriptive_name: "ignored",
    });
    const result = jsonToResourceFork(json, converters, [testType]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tree.size).toBe(1);
    expect(result.value.tree.get(typeKey)?.get(7)).toMatchObject({
      num: 7,
      flags: 4,
      junk: 5,
      order: 6,
      data: new Uint8Array([0xab]),
    });
  });

  it("reports malformed JSON shapes and converter failures", () => {
    expect(jsonStringToResourceFork("{}", converters).ok).toBe(false);
    expect(jsonToResourceFork(blob({ TEST: [] }), converters).ok).toBe(false);
    expect(jsonToResourceFork(blob({ TEST: { "1": null } }), converters).ok).toBe(false);
    expect(jsonToResourceFork(blob({ TEST: { "1": { data: 1 } } }), converters).ok).toBe(false);
    expect(jsonStringToResourceFork("not json", converters).ok).toBe(false);
  });

  it("serializes and parses valid JSON strings", () => {
    const fork = createResourceFork();
    const stringResult = resourceForkToJsonString(fork, [], [], converters);
    expect(stringResult.ok).toBe(true);
    if (!stringResult.ok) return;
    expect(JSON.parse(stringResult.value)).toEqual({
      _metadata: { junk1: 0, junk2: 0, file_attributes: 0 },
    });
    expect(jsonStringToResourceFork(stringResult.value, converters).ok).toBe(true);
  });
});
