import type { LayoutNode, JsonValue, Scalar } from "./schema.js";

type ReadonlyDefinition<T> = T extends object ? { readonly [K in keyof T]: ReadonlyDefinition<T[K]> } : T;
export interface LayoutDefinition {
  readonly $schema?: string;
  readonly byteOrder?: "big" | "little";
  readonly types?: Readonly<Record<string, ReadonlyDefinition<LayoutNode>>>;
  readonly resources: Readonly<Record<string, ReadonlyDefinition<LayoutNode>>>;
}

type InferNode<N, Types, Depth extends unknown[] = []> = Depth["length"] extends 16 ? JsonValue :
  N extends "bool" | { readonly type: "bool" } ? boolean :
  N extends Scalar | { readonly type: Scalar } ? number :
  N extends { readonly $ref: `#/types/${infer Name}` } ?
    Name extends keyof Types ? InferNode<Types[Name], Types, [...Depth, 0]> : JsonValue :
  N extends { readonly type: "array"; readonly items: infer Item } ? InferNode<Item, Types, [...Depth, 0]>[] :
  N extends { readonly type: "struct"; readonly fields: infer Fields extends readonly unknown[] } ? {
    -readonly [Field in Fields[number] as Field extends { readonly name: infer Name extends string } ? Name : never]:
      InferNode<Field, Types, [...Depth, 0]>
  } : JsonValue;

export type InferResource<D extends LayoutDefinition, K extends keyof D["resources"]> =
  InferNode<D["resources"][K], D extends { readonly types: infer Types } ? Types : {}>;
export type InferResources<D extends LayoutDefinition> = { [K in keyof D["resources"]]: InferResource<D, K> };

export function defineLayout<const D extends LayoutDefinition>(definition: D): D {
  return definition;
}
