import { type Result } from "neverthrow";
import { compileLayoutSchema, type CompiledLayouts } from "./compile.js";
import { decodeResource } from "./decode.js";
import { encodeResource } from "./encode.js";
import { validateResource } from "./validate.js";
import type { InferResource, LayoutDefinition } from "./infer.js";
import type { LayoutError } from "./schema.js";

export interface TypedLayouts<D extends LayoutDefinition> { definition: D; compiled: CompiledLayouts }
export interface TypedDecodedResource<T> { value: T; preservedBytes: Record<string, number[]> }

export function compileTypedLayout<const D extends LayoutDefinition>(definition: D): Result<TypedLayouts<D>, LayoutError> {
  return compileLayoutSchema(definition).map((compiled) => ({ definition, compiled }));
}

export function decodeTypedResource<const D extends LayoutDefinition, K extends keyof D["resources"] & string>(
  layouts: TypedLayouts<D>, type: K, bytes: Uint8Array,
): Result<TypedDecodedResource<InferResource<D, K>>, LayoutError>;
export function decodeTypedResource(layouts: TypedLayouts<LayoutDefinition>, type: string,
  bytes: Uint8Array): Result<unknown, LayoutError> {
  return decodeResource(layouts.compiled, type, bytes);
}

export function validateTypedResource<const D extends LayoutDefinition, K extends keyof D["resources"] & string>(
  layouts: TypedLayouts<D>, type: K, input: unknown,
): Result<InferResource<D, K>, LayoutError>;
export function validateTypedResource(layouts: TypedLayouts<LayoutDefinition>, type: string,
  input: unknown): Result<unknown, LayoutError> {
  return validateResource(layouts.compiled, type, input);
}

export function encodeTypedResource<const D extends LayoutDefinition, K extends keyof D["resources"] & string>(
  layouts: TypedLayouts<D>, type: K, value: NoInfer<InferResource<D, K>>, preservedBytes: unknown = {},
): Result<Uint8Array, LayoutError> {
  return encodeResource(layouts.compiled, type, value, preservedBytes);
}
