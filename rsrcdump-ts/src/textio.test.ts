import { afterEach, describe, expect, it } from "vitest";
import {
  decode,
  encode,
  getGlobalEncoding,
  parseTypeName,
  sanitizeResourceName,
  sanitizeTypeName,
  setGlobalEncoding,
} from "./textio.js";

afterEach(() => {
  setGlobalEncoding("macroman");
});

describe("resource text helpers", () => {
  it("sanitizes and parses resource types", () => {
    expect(sanitizeTypeName(new Uint8Array([83, 84, 82, 32]))).toBe("STR");
    expect(parseTypeName("STR")).toEqual(new Uint8Array([83, 84, 82, 32]));
    expect(sanitizeTypeName(new Uint8Array([32, 32, 32, 32]))).toBe("%20%20%20%20");
  });

  it("rejects invalid resource type lengths", () => {
    expect(() => sanitizeTypeName(new Uint8Array(3))).toThrow("isn't 4 bytes");
    expect(() => parseTypeName("TOO-LONG")).toThrow("doesn't work out to 4 bytes");
  });

  it("sanitizes string and byte resource names", () => {
    expect(sanitizeResourceName("Hello, world!_1")).toBe("Helloworld_1");
    expect(sanitizeResourceName(new Uint8Array([65, 47, 66]))).toBe("AB");
  });

  it("uses macroman by default and supports alternate global encodings", () => {
    expect(getGlobalEncoding()).toBe("macroman");
    expect(decode(new Uint8Array([65]))).toBe("A");
    expect(encode("A")).toEqual(new Uint8Array([65]));

    setGlobalEncoding("utf-8");
    expect(getGlobalEncoding()).toBe("utf-8");
    expect(decode(encode("héllo"))).toBe("héllo");
  });
});
