import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { CompiledLayouts, Plan } from "./compile.js";
import type { LayoutError } from "./schema.js";
import { resolveCount } from "./decode.js";
import { readScalar, writeScalar } from "./scalars.js";

interface Writer { bytes: Uint8Array; view: DataView; offset: number; little: boolean;
  preservedBytes: Record<string, number[]>; budget: number }
const objectSchema = z.record(z.string(), z.unknown());
const arraySchema = z.array(z.unknown()).max(1_000_000);
const paddingSchema = z.record(z.string(), z.array(z.number().int().min(0).max(255)));

function writeNode(plan: Plan, value: unknown, writer: Writer, path: string,
  previous: ReadonlyMap<string, unknown>): Result<void, LayoutError> {
  if (--writer.budget < 0) return err({ path, message: "Resource exceeds one million values" });
  if (plan.size !== null && plan.size > writer.bytes.length - writer.offset) return err({ path, message: "Resource exceeds 16 MiB" });
  if (plan.kind === "padding") {
    const preserved = writer.preservedBytes[path];
    if (preserved && preserved.length !== plan.size) return err({ path, message: "Padding length mismatch" });
    if (preserved) writer.bytes.set(preserved, writer.offset);
    writer.offset += plan.size;
    return ok(undefined);
  }
  if (plan.kind === "scalar") {
    const result = writeScalar(plan.type, value, writer.view, writer.offset, writer.little, path);
    if (result.isErr()) return result;
    const preserved = writer.preservedBytes[path];
    if ((plan.type === "f32" || plan.type === "f64") && value === 0 && preserved?.length === plan.size) {
      const source = Uint8Array.from(preserved);
      if (Object.is(readScalar(plan.type, new DataView(source.buffer), 0, writer.little), -0)) {
        writer.bytes.set(source, writer.offset);
      }
    }
    writer.offset += plan.size;
    return result;
  }
  if (plan.kind === "struct") return writeStruct(plan, value, writer, path);
  const values = arraySchema.safeParse(value);
  if (!values.success) return err({ path, message: "Expected array" });
  const count = resolveCount(plan.count === "remaining" ? values.data.length : plan.count, previous, path);
  if (count.isErr()) return err(count.error);
  if (values.data.length !== count.value) return err({ path, message: `Expected ${count.value} array entries` });
  for (const [index, item] of values.data.entries()) {
    const result = writeNode(plan.items, item, writer, `${path}[${index}]`, previous);
    if (result.isErr()) return result;
  }
  return ok(undefined);
}

function writeStruct(plan: Extract<Plan, { kind: "struct" }>, input: unknown,
  writer: Writer, path: string): Result<void, LayoutError> {
  const parsed = objectSchema.safeParse(input);
  if (!parsed.success) return err({ path, message: "Expected struct object" });
  const values = new Map(Object.entries(parsed.data));
  for (const key of values.keys()) {
    if (!plan.fields.some((field) => field.name === key)) return err({ path: `${path}.${key}`, message: "Unknown field" });
  }
  for (const [index, field] of plan.fields.entries()) {
    const fieldPath = `${path}.${field.name ?? `@padding[${index}]`}`;
    if (field.name && !values.has(field.name)) return err({ path: fieldPath, message: "Missing required field" });
    const result = writeNode(field.plan, field.name ? values.get(field.name) : undefined, writer, fieldPath, values);
    if (result.isErr()) return result;
  }
  return ok(undefined);
}

export function encodeResource(layouts: CompiledLayouts, type: string, value: unknown,
  preservedBytes: unknown = {}): Result<Uint8Array, LayoutError> {
  const plan = layouts.resources.get(type);
  if (!plan) return err({ path: type, message: "No layout for resource type" });
  const preserved = paddingSchema.safeParse(preservedBytes);
  if (!preserved.success) return err({ path: type, message: "Invalid preserved bytes" });
  let capacity = plan.size ?? 16_777_216;
  if (plan.size === null && plan.kind === "array" && plan.items.size !== null) {
    const values = arraySchema.safeParse(value);
    if (!values.success) return err({ path: type, message: "Expected array" });
    capacity = values.data.length * plan.items.size;
  }
  if (capacity > 16_777_216) return err({ path: type, message: "Resource exceeds 16 MiB" });
  const bytes = new Uint8Array(capacity);
  const writer: Writer = { bytes, view: new DataView(bytes.buffer), offset: 0,
    little: layouts.byteOrder === "little", preservedBytes: preserved.data, budget: 1_000_000 };
  const result = writeNode(plan, value, writer, type, new Map());
  return result.map(() => bytes.slice(0, writer.offset));
}
