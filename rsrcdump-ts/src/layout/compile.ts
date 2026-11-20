import { err, ok, Result } from "neverthrow";
import { layoutDocumentSchema, type Count, type LayoutError, type LayoutNode, type Scalar } from "./schema.js";

export type Plan = { kind: "scalar"; type: Scalar; size: number } |
  { kind: "padding"; size: number } |
  { kind: "struct"; fields: { name: string | undefined; plan: Plan }[]; size: number | null } |
  { kind: "array"; count: Count; items: Plan; size: number | null };
export interface CompiledLayouts { byteOrder: "big" | "little"; resources: ReadonlyMap<string, Plan> }
const sizes: Record<Scalar, number> = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, f64: 8, bool: 1 };
interface Context {
  types: Record<string, LayoutNode>; refs: string[]; previous: ReadonlyMap<string, Plan>;
  path: string; remaining: boolean; depth: number;
}

function compileNode(node: LayoutNode, context: Context): Result<Plan, LayoutError> {
  const fail = (message: string) => err<Plan, LayoutError>({ path: context.path, message });
  if (context.depth > 64) return fail("Layout nesting exceeds 64 levels");
  if (typeof node === "string") return ok({ kind: "scalar", type: node, size: sizes[node] });
  if ("$ref" in node) {
    const name = node.$ref.slice("#/types/".length);
    const target = context.types[name];
    if (!target) return fail(`Unknown type reference ${node.$ref}`);
    if (context.refs.includes(name)) return fail(`Recursive type reference ${name}`);
    return compileNode(target, { ...context, refs: [...context.refs, name], depth: context.depth + 1 });
  }
  if (node.type === "padding") return ok({ kind: "padding", size: node.bytes });
  if (node.type === "struct") return compileStruct(node.fields, context);
  if (node.type !== "array") return ok({ kind: "scalar", type: node.type, size: sizes[node.type] });
  const items = compileNode(node.items, { ...context, remaining: false, depth: context.depth + 1 });
  if (items.isErr()) return items;
  if (node.count === "remaining" && (!context.remaining || !items.value.size)) {
    return fail("Remaining arrays must end their resource and have fixed, nonzero item sizes");
  }
  if (typeof node.count === "object") {
    const counter = context.previous.get(node.count.field);
    if (!counter || counter.kind !== "scalar" || !/^[ui]/.test(counter.type)) {
      return fail(`Count field ${node.count.field} must be an earlier integer field in this struct`);
    }
  }
  return ok({ kind: "array", count: node.count, items: items.value,
    size: typeof node.count === "number" && items.value.size !== null ? node.count * items.value.size : null });
}

function compileStruct(nodes: LayoutNode[], context: Context): Result<Plan, LayoutError> {
  const fields: { name: string | undefined; plan: Plan }[] = [];
  const previous = new Map<string, Plan>();
  let size: number | null = 0;
  for (const [index, node] of nodes.entries()) {
    const name = typeof node === "string" ? undefined : node.name;
    const path = `${context.path}.fields[${index}]`;
    const plan = compileNode(node, { ...context, previous, path,
      remaining: context.remaining && index === nodes.length - 1, depth: context.depth + 1 });
    if (plan.isErr()) return plan;
    if (plan.value.kind === "padding" ? name !== undefined : !name) {
      return err({ path, message: "Struct fields need names; padding must be unnamed" });
    }
    if (name && previous.has(name)) return err({ path, message: `Duplicate field ${name}` });
    if (name) previous.set(name, plan.value);
    fields.push({ name, plan: plan.value });
    size = size !== null && plan.value.size !== null ? size + plan.value.size : null;
    if (size !== null && size > 16_777_216) return err({ path, message: "Struct exceeds 16 MiB" });
  }
  return ok({ kind: "struct", fields, size });
}

export function compileLayoutSchema(input: unknown): Result<CompiledLayouts, LayoutError> {
  const checked = Result.fromThrowable(() => layoutDocumentSchema.safeParse(input),
    (): LayoutError => ({ path: "$", message: "Layout validation failed; input may be cyclic or too deeply nested" }))();
  if (checked.isErr()) return err(checked.error);
  const parsed = checked.value;
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err({ path: issue?.path.join(".") ?? "$", message: issue?.message ?? "Invalid layout" });
  }
  const resources = new Map<string, Plan>();
  const context: Context = { types: parsed.data.types, refs: [], previous: new Map(),
    path: "$", remaining: true, depth: 0 };
  for (const [name, node] of Object.entries(parsed.data.types)) {
    const checked = compileNode(node, { ...context, path: `types.${name}`, refs: [name] });
    if (checked.isErr()) return err(checked.error);
  }
  for (const [name, node] of Object.entries(parsed.data.resources)) {
    const plan = compileNode(node, { ...context, path: name });
    if (plan.isErr()) return err(plan.error);
    resources.set(name, plan.value);
  }
  return ok({ byteOrder: parsed.data.byteOrder, resources });
}
