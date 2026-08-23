import { describe, expect, it } from "vitest";
import {
  allocate,
  asBoolean,
  asNumber,
  asPackNumber,
  asPackNumberOrBigint,
  asPackUint8Array,
  asUint8Array,
  binaryToBytes,
  bytesToBinary,
  bytesToHex,
  decode,
  encode,
  hexToBytes,
  isArray,
  isBoolean,
  isNumber,
  isRecord,
  latin1Decode,
  latin1Encode,
} from "./buffer-utils.js";

describe("buffer utility guards", () => {
  it("returns correctly typed values", () => {
    const bytes = new Uint8Array([1]);
    expect(asNumber(2)).toBe(2);
    expect(asUint8Array(bytes)).toBe(bytes);
    expect(asBoolean(true)).toBe(true);
    expect(asPackUint8Array(bytes)).toBe(bytes);
    expect(asPackNumber(3)).toBe(3);
    expect(asPackNumberOrBigint(4n)).toBe(4n);
  });

  it.each([
    [() => asNumber(false), "Expected number"],
    [() => asUint8Array(1), "Expected Uint8Array"],
    [() => asBoolean(1), "Expected boolean"],
    [() => asPackUint8Array(1), "Expected Uint8Array"],
    [() => asPackNumber(1n), "Expected number"],
    [() => asPackNumberOrBigint(new Uint8Array()), "Expected number or bigint"],
  ])("rejects an invalid guarded value", (operation, message) => {
    expect(operation).toThrow(message);
  });

  it("recognizes records, arrays, numbers, and booleans", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isArray([])).toBe(true);
    expect(isNumber(1)).toBe(true);
    expect(isBoolean(false)).toBe(true);
  });
});

describe("buffer encodings", () => {
  it("round-trips hex, binary, latin1, and UTF-8", () => {
    const bytes = new Uint8Array([0, 127, 255]);
    expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
    expect(binaryToBytes(bytesToBinary(bytes))).toEqual(bytes);
    expect(latin1Encode(latin1Decode(bytes))).toEqual(bytes);
    expect(decode(encode("héllo", "utf-8"), "utf8")).toBe("héllo");
    expect(decode(encode("00FF", "hex"), "hex")).toBe("00FF");
    expect(decode(encode("abc", "binary"), "binary")).toBe("abc");
  });

  it("supports ArrayBuffer inputs and latin1 replacement", () => {
    const buffer = new Uint8Array([0xab, 0xcd]).buffer;
    expect(bytesToHex(buffer)).toBe("ABCD");
    expect(bytesToBinary(buffer)).toHaveLength(2);
    expect(latin1Decode(buffer)).toHaveLength(2);
    expect(latin1Encode("Ā")).toEqual(new Uint8Array([0x3f]));
  });

  it("allocates zeroed and filled byte arrays", () => {
    expect(allocate(3)).toEqual(new Uint8Array(3));
    expect(allocate(3, 7)).toEqual(new Uint8Array([7, 7, 7]));
  });

  it("rejects unsupported encodings", () => {
    expect(() => decode(new Uint8Array(), "invalid")).toThrow("Unsupported encoding");
    expect(() => encode("", "invalid")).toThrow("Unsupported encoding");
  });
});
