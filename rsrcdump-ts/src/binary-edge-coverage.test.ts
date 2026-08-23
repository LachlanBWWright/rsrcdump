import { describe, expect, it, vi } from "vitest";
import {
  ADF_MAGIC,
  ADF_VERSION,
  createResourceFork,
  isErr,
  isOk,
  packAdf,
  packResourceFork,
  unpackAdf,
} from "./index.js";
import { getConverters, getConvertersSync } from "./converter-factory.js";
import { Packer, Unpacker } from "./packutils.js";

describe("binary format edge coverage", () => {
  it("round-trips signed, unsigned, floating, and endian variants", () => {
    const cases: [string, number | bigint][] = [
      [">b", -2], ["<h", -300], [">H", 500], ["<L", 0x12345678],
      [">i", -100_000], ["<n", -123n], [">N", 456n], ["<P", 789n],
      [">f", 1.5], ["<d", -2.25], [">?", 1],
    ];

    for (const [format, value] of cases) {
      const packed = new Packer().pack(format, value);
      const [unpacked] = new Unpacker(packed).unpack(format);
      expect(unpacked).toBe(format.endsWith("?") ? Boolean(value) : Number(value));
    }
  });

  it("pads fixed strings and empty characters", () => {
    expect(new Packer().pack(">4s", new Uint8Array([1, 2]))).toEqual(
      new Uint8Array([1, 2, 0, 0]),
    );
    expect(new Packer().pack(">c", new Uint8Array())).toEqual(new Uint8Array([0]));
    expect(new Packer().toUint8Array()).toEqual(new Uint8Array());
  });
});

describe("AppleDouble validation", () => {
  it("rejects invalid magic, version, truncation, and filler", () => {
    const packer = new Packer();
    const filler = new Uint8Array(16);
    expect(isErr(unpackAdf(packer.pack(">LL16sH", 0, ADF_VERSION, filler, 0)))).toBe(true);
    expect(isErr(unpackAdf(packer.pack(">LL16sH", ADF_MAGIC, 1, filler, 0)))).toBe(true);
    expect(isErr(unpackAdf(new Uint8Array([1])))).toBe(true);
    expect(isErr(packAdf(new Map([[0, new Uint8Array(15)]])))).toBe(true);
  });

  it("round-trips multiple entries with a custom filler", () => {
    const entries = new Map([
      [0, new Uint8Array(16).fill(7)],
      [2, new Uint8Array([1, 2])],
      [9, new Uint8Array([3])],
    ]);
    const packed = packAdf(entries);
    expect(isOk(packed)).toBe(true);
    if (!isOk(packed)) return;
    expect(unpackAdf(packed.value)).toEqual({ ok: true, value: entries });
  });
});

describe("converter factory validation", () => {
  it("registers valid async and sync specifications", async () => {
    expect((await getConverters(["TEST:L:value"])).size).toBe(4);
    expect(getConvertersSync(["TEST:L:value"]).size).toBe(4);
  });

  it("skips comments, incomplete specs, invalid formats, and invalid types", () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = getConvertersSync([
      "", "// comment", "missing colon", ":L:value", "TEST:",
      "TEST:Z:value", "TOO-LONG:L:value",
    ]);
    expect(result.size).toBe(3);
    expect(warning).toHaveBeenCalledTimes(2);
    warning.mockRestore();
  });
});

describe("resource fork packing errors", () => {
  it("rejects resource types with no resources", () => {
    const fork = createResourceFork();
    fork.tree.set("TEST", new Map());
    expect(isErr(packResourceFork(fork))).toBe(true);
  });
});
