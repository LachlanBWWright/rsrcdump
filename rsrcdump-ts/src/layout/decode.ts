import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { CompiledLayouts, Plan } from "./compile.js";
import type { Count, JsonValue, LayoutError } from "./schema.js";
import { readScalar } from "./scalars.js";

export interface DecodedResource { value: JsonValue; preservedBytes: Record<string, number[]> }
interface Reader {
  view: DataView; offset: number; little: boolean; preservedBytes: Record<string, number[]>; budget: number;
}
const countSchema = z.number().int().nonnegative().max(1_000_000);

export function resolveCount(count: Count, previous: ReadonlyMap<string, unknown>, path: string): Result<number, LayoutError> {
  const input = typeof count === "object" ? previous.get(count.field) : count;
  const parsed = countSchema.safeParse(input);
  return parsed.success ? ok(parsed.data) : err({ path, message: "Invalid array count" });
}

function readNode(plan: Plan, reader: Reader, path: string,
  previous: ReadonlyMap<string, unknown>): Result<JsonValue, LayoutError> {
  if (--reader.budget < 0) return err({ path, message: "Resource exceeds one million values" });
  if (plan.size !== null && plan.size > reader.view.byteLength - reader.offset) {
    return err({ path, message: "Truncated resource" });
  }
  if (plan.kind === "padding") {
    reader.preservedBytes[path] = Array.from(new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, plan.size));
    reader.offset += plan.size;
    return ok(0);
  }
  if (plan.kind === "scalar") {
    const value = readScalar(plan.type, reader.view, reader.offset, reader.little);
    if (Object.is(value, -0)) {
      reader.preservedBytes[path] = Array.from(new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, plan.size));
    }
    reader.offset += plan.size;
    if (typeof value === "number" && !Number.isFinite(value)) return err({ path, message: "Non-finite float" });
    if (plan.type === "bool" && reader.view.getUint8(reader.offset - 1) > 1) return err({ path, message: "Invalid boolean byte" });
    return ok(value);
  }
  if (plan.kind === "struct") return readStruct(plan, reader, path);
  const remaining = reader.view.byteLength - reader.offset;
  const count = plan.count === "remaining"
    ? resolveCount(plan.items.size ? remaining / plan.items.size : -1, previous, path)
    : resolveCount(plan.count, previous, path);
  if (count.isErr()) return count;
  const values: JsonValue[] = [];
  for (let index = 0; index < count.value; index++) {
    const value = readNode(plan.items, reader, `${path}[${index}]`, previous);
    if (value.isErr()) return value;
    values.push(value.value);
  }
  return ok(values);
}

function readStruct(plan: Extract<Plan, { kind: "struct" }>, reader: Reader, path: string): Result<JsonValue, LayoutError> {
  const fields = new Map<string, JsonValue>();
  for (const [index, field] of plan.fields.entries()) {
    const value = readNode(field.plan, reader, `${path}.${field.name ?? `@padding[${index}]`}`, fields);
    if (value.isErr()) return value;
    if (field.name) fields.set(field.name, value.value);
  }
  return ok(Object.fromEntries(fields));
}

export function decodeResource(layouts: CompiledLayouts, type: string, bytes: Uint8Array): Result<DecodedResource, LayoutError> {
  const plan = layouts.resources.get(type);
  if (!plan) return err({ path: type, message: "No layout for resource type" });
  if (bytes.length > 16_777_216) return err({ path: type, message: "Resource exceeds 16 MiB" });
  const reader: Reader = { view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0,
    little: layouts.byteOrder === "little", preservedBytes: {}, budget: 1_000_000 };
  const value = readNode(plan, reader, type, new Map());
  if (value.isErr()) return err(value.error);
  if (reader.offset !== bytes.length) return err({ path: type, message: "Trailing resource bytes" });
  return ok({ value: value.value, preservedBytes: reader.preservedBytes });
}
