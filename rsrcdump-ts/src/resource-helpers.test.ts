import { describe, expect, it } from "vitest";
import {
  Base16Converter,
  SingleStringConverter,
  StringListConverter,
  TextConverter,
  createResource,
  createResourceFork,
  getResourceType,
  isErr,
  isOk,
  resourceForkToString,
} from "./index.js";
import { bytesToBinary } from "./buffer-utils.js";

const type = new Uint8Array([84, 69, 83, 84]);
const emptyFork = createResourceFork();

describe("resource query helpers", () => {
  it("looks up resource types using strings and bytes", () => {
    const fork = createResourceFork();
    const resources = new Map([[1, createResource(type, 1, new Uint8Array([1]))]]);
    fork.tree.set(bytesToBinary(type), resources);

    expect(getResourceType(fork, "TEST")).toEqual({ ok: true, value: resources });
    expect(getResourceType(fork, type)).toEqual({ ok: true, value: resources });
    expect(resourceForkToString(fork)).toBe("ResourceFork(1 TEST)");
  });

  it("rejects invalid and missing resource types", () => {
    expect(isErr(getResourceType(emptyFork, new Uint8Array(3)))).toBe(true);
    expect(isErr(getResourceType(emptyFork, "MISS"))).toBe(true);
    expect(resourceForkToString(emptyFork)).toBe("ResourceFork()");
  });
});

describe("built-in resource converters", () => {
  it("round-trips base16 and rejects non-string input", () => {
    const converter = new Base16Converter();
    const resource = createResource(type, 1, new Uint8Array([0xab, 0xcd]));
    expect(converter.unpack(resource, emptyFork)).toEqual({ ok: true, value: "ABCD" });
    expect(converter.pack("ABCD")).toEqual({ ok: true, value: resource.data });
    expect(isErr(converter.pack(1))).toBe(true);
  });

  it("round-trips single strings including empty and truncated values", () => {
    const converter = new SingleStringConverter();
    const packed = converter.pack("hello");
    expect(isOk(packed)).toBe(true);
    if (!isOk(packed)) return;
    expect(converter.unpack(createResource(type, 1, packed.value), emptyFork)).toEqual({
      ok: true,
      value: "hello",
    });
    expect(converter.unpack(createResource(type, 1, new Uint8Array()), emptyFork)).toEqual({
      ok: true,
      value: "",
    });
    expect(isErr(converter.pack(null))).toBe(true);
  });

  it("round-trips string lists and validates their members", () => {
    const converter = new StringListConverter();
    const packed = converter.pack(["one", "two"]);
    expect(isOk(packed)).toBe(true);
    if (!isOk(packed)) return;
    expect(converter.unpack(createResource(type, 1, packed.value), emptyFork)).toEqual({
      ok: true,
      value: ["one", "two"],
    });
    expect(isErr(converter.pack("not an array"))).toBe(true);
    expect(isErr(converter.pack(["valid", 1]))).toBe(true);
  });

  it("round-trips TEXT resources and rejects non-string input", () => {
    const converter = new TextConverter();
    const packed = converter.pack("plain text");
    expect(isOk(packed)).toBe(true);
    if (!isOk(packed)) return;
    const resource = createResource(type, 1, packed.value);
    expect(converter.unpack(resource, emptyFork)).toEqual({ ok: true, value: "plain text" });
    expect(isErr(converter.pack({}))).toBe(true);
  });
});
