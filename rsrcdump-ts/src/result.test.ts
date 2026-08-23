import { describe, expect, it } from "vitest";
import { andThen, err, isErr, isOk, map, ok, unwrap } from "./result.js";

describe("Result helpers", () => {
  it("maps and chains successful values", () => {
    expect(map(ok(2), (value) => value * 3)).toEqual(ok(6));
    expect(andThen(ok(2), (value) => ok(String(value)))).toEqual(ok("2"));
  });

  it("preserves errors without invoking callbacks", () => {
    const failure = err("failed");
    const callback = () => ok(1);

    expect(map(failure, callback)).toBe(failure);
    expect(andThen(failure, callback)).toBe(failure);
    expect(isErr(failure)).toBe(true);
    expect(isOk(failure)).toBe(false);
  });

  it("unwraps successes and throws errors", () => {
    expect(unwrap(ok(42))).toBe(42);
    expect(() => unwrap(err(new Error("failed")))).toThrow("failed");
  });
});
