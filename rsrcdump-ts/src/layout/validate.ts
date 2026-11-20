import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import type { CompiledLayouts, Plan } from "./compile.js";
import type { JsonValue, LayoutError } from "./schema.js";
import { resolveCount } from "./decode.js";
import { validateScalar } from "./scalars.js";

const objectSchema = z.record(z.string(), z.unknown());
const arraySchema = z.array(z.unknown()).max(1_000_000);
interface Budget { nodes: number; bytes: number }

function validateNode(plan: Plan, input: unknown, path: string, previous: ReadonlyMap<string, unknown>,
  budget: Budget): Result<JsonValue, LayoutError> {
  if (--budget.nodes < 0) return err({ path, message: "Resource exceeds one million values" });
  if (plan.kind === "padding" || plan.kind === "scalar") {
    budget.bytes += plan.size;
    if (budget.bytes > 16_777_216) return err({ path, message: "Resource exceeds 16 MiB" });
    return plan.kind === "padding" ? ok(0) : validateScalar(plan.type, input, path);
  }
  if (plan.kind === "struct") return validateStruct(plan, input, path, budget);
  const parsed = arraySchema.safeParse(input);
  if (!parsed.success) return err({ path, message: "Expected array" });
  const count = resolveCount(plan.count === "remaining" ? parsed.data.length : plan.count, previous, path);
  if (count.isErr()) return err(count.error);
  if (count.value !== parsed.data.length) return err({ path, message: `Expected ${count.value} array entries` });
  const values: JsonValue[] = [];
  for (const [index, value] of parsed.data.entries()) {
    const validated = validateNode(plan.items, value, `${path}[${index}]`, previous, budget);
    if (validated.isErr()) return validated;
    values.push(validated.value);
  }
  return ok(values);
}

function validateStruct(plan: Extract<Plan, { kind: "struct" }>, input: unknown, path: string,
  budget: Budget): Result<JsonValue, LayoutError> {
  const parsed = objectSchema.safeParse(input);
  if (!parsed.success) return err({ path, message: "Expected struct object" });
  const previous = new Map(Object.entries(parsed.data));
  const values = new Map<string, JsonValue>();
  for (const key of previous.keys()) {
    if (!plan.fields.some((field) => field.name === key)) return err({ path: `${path}.${key}`, message: "Unknown field" });
  }
  for (const [index, field] of plan.fields.entries()) {
    const fieldPath = `${path}.${field.name ?? `@padding[${index}]`}`;
    if (field.name && !previous.has(field.name)) return err({ path: fieldPath, message: "Missing required field" });
    const value = validateNode(field.plan, field.name ? previous.get(field.name) : undefined, fieldPath, previous, budget);
    if (value.isErr()) return value;
    if (field.name) values.set(field.name, value.value);
  }
  return ok(Object.fromEntries(values));
}

export function validateResource(layouts: CompiledLayouts, type: string, input: unknown): Result<JsonValue, LayoutError> {
  const plan = layouts.resources.get(type);
  if (!plan) return err({ path: type, message: "No layout for resource type" });
  return validateNode(plan, input, type, new Map(), { nodes: 1_000_000, bytes: 0 });
}
