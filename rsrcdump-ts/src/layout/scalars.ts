import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { LayoutError, Scalar } from "./schema.js";

export function readScalar(type: Scalar, view: DataView, offset: number, little: boolean): number | boolean {
  switch (type) {
    case "u8": return view.getUint8(offset);
    case "i8": return view.getInt8(offset);
    case "u16": return view.getUint16(offset, little);
    case "i16": return view.getInt16(offset, little);
    case "u32": return view.getUint32(offset, little);
    case "i32": return view.getInt32(offset, little);
    case "f32": return view.getFloat32(offset, little);
    case "f64": return view.getFloat64(offset, little);
    case "bool": return view.getUint8(offset) !== 0;
  }
}

const ranges: Partial<Record<Scalar, [number, number]>> = {
  u8: [0, 255], i8: [-128, 127], u16: [0, 65535], i16: [-32768, 32767],
  u32: [0, 4294967295], i32: [-2147483648, 2147483647],
};
const finiteNumber = z.number().finite();
const booleanValue = z.boolean();

export function validateScalar(type: Scalar, input: unknown, path: string): Result<number | boolean, LayoutError> {
  if (type === "bool") {
    const value = booleanValue.safeParse(input);
    if (!value.success) return err({ path, message: "Expected boolean" });
    return ok(value.data);
  }
  const value = finiteNumber.safeParse(input);
  if (!value.success) return err({ path, message: "Expected a finite number" });
  const range = ranges[type];
  if (range && (!Number.isInteger(value.data) || value.data < range[0] || value.data > range[1])) {
    return err({ path, message: `Value outside ${type} integer range` });
  }
  if (type === "f32" && !Number.isFinite(Math.fround(value.data))) return err({ path, message: "Value exceeds f32 range" });
  return ok(value.data);
}

export function writeScalar(type: Scalar, input: unknown, view: DataView, offset: number,
  little: boolean, path: string): Result<void, LayoutError> {
  const checked = validateScalar(type, input, path);
  if (checked.isErr()) return err(checked.error);
  const value = checked.value;
  if (typeof value === "boolean") {
    view.setUint8(offset, value ? 1 : 0);
    return ok(undefined);
  }
  switch (type) {
    case "u8": view.setUint8(offset, value); break;
    case "i8": view.setInt8(offset, value); break;
    case "u16": view.setUint16(offset, value, little); break;
    case "i16": view.setInt16(offset, value, little); break;
    case "u32": view.setUint32(offset, value, little); break;
    case "i32": view.setInt32(offset, value, little); break;
    case "f32": view.setFloat32(offset, value, little); break;
    case "f64": view.setFloat64(offset, value, little); break;
  }
  return ok(undefined);
}
