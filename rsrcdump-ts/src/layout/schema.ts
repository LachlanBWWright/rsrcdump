import { z } from "zod";

export const scalarSchema = z.enum(["u8", "i8", "u16", "i16", "u32", "i32", "f32", "f64", "bool"]);
export type Scalar = z.infer<typeof scalarSchema>;
export type Count = number | "remaining" | { field: string };
export type LayoutNode = Scalar | (
  { name?: string } & (
    { type: Scalar } | { $ref: string } |
    { type: "padding"; bytes: number } |
    { type: "struct"; fields: LayoutNode[] } |
    { type: "array"; count: Count; items: LayoutNode }
  )
);

const name = z.string().min(1).optional();
export const layoutNodeSchema: z.ZodType<LayoutNode> = z.lazy(() => z.union([
  scalarSchema,
  z.strictObject({ name, type: scalarSchema }),
  z.strictObject({ name, $ref: z.string().regex(/^#\/types\/[A-Za-z_][A-Za-z0-9_]*$/) }),
  z.strictObject({ name, type: z.literal("padding"), bytes: z.number().int().positive().max(16_777_216) }),
  z.strictObject({ name, type: z.literal("struct"), fields: z.array(layoutNodeSchema).min(1).max(4096) }),
  z.strictObject({ name, type: z.literal("array"), items: layoutNodeSchema,
    count: z.union([z.number().int().nonnegative().max(1_000_000), z.literal("remaining"),
      z.strictObject({ field: z.string().min(1) })]) }),
]));

export const layoutDocumentSchema = z.strictObject({
  $schema: z.string().optional(),
  byteOrder: z.enum(["big", "little"]).default("big"),
  types: z.record(z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/), layoutNodeSchema).default({}),
  resources: z.record(z.string().length(4), layoutNodeSchema),
});

export interface LayoutError { path: string; message: string }
export type JsonValue = number | boolean | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.number().finite(), z.boolean(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema),
]));

export const jsonLayoutJsonSchema = z.toJSONSchema(layoutDocumentSchema, {
  target: "draft-2020-12", reused: "ref", cycles: "ref",
});
