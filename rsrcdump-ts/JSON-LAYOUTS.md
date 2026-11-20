# JSON resource layouts

JSON layouts are an additive API, exported from `src/rsrcdump.ts` and
`src/layout/index.ts`. Existing string converters are unchanged. This checkout
is older than the published package used by PangeaRSEdit; no dependency in the
editor has been replaced, and no package has been published.

The complete working examples are [Pangea water](examples/pangea-water.json) and
[Pangea skeletons](examples/pangea-skeleton.json). They use
[`layout.schema.json`](layout.schema.json) for editor completion and structural
validation. `layoutDocumentSchema` is the runtime Zod schema, and
`jsonLayoutJsonSchema` exports its automatically generated draft-2020-12 schema.
`compileLayoutSchema` additionally checks references, field names, count scope,
cycles, and resource boundaries.

```ts
import { compileLayoutSchema, decodeResource, encodeResource } from "./src/layout/index.js";

const compiled = compileLayoutSchema(definition);
if (compiled.isOk()) {
  const decoded = decodeResource(compiled.value, "Liqd", resourceBytes);
  if (decoded.isOk()) {
    const encoded = encodeResource(
      compiled.value, "Liqd", decoded.value.value, decoded.value.preservedBytes,
    );
    // encoded is Result<Uint8Array, LayoutError>.
  }
}
```

`resourceBytes` is an individual resource's payload, for example
`load(fileBytes).resources.get("Liqd")?.get(1000)?.data`. The existing container
reader/writer remains responsible for resource-fork and AppleDouble framing.
To edit a fork, replace the relevant resource's `data` with successful encoded
bytes, then use `saveToBytes`. The new codec does not guess a layout for unknown
resource types or change their payloads.

## TypeScript types and value validation

TypeScript-authored definitions can preserve their literal field names without
type assertions:

```ts
const definition = defineLayout({
  resources: {
    Test: { type: "struct", fields: [
      { name: "enabled", type: "bool" },
      { name: "points", type: "array", count: 2, items: "f32" },
    ] },
  },
});
type TestData = InferResource<typeof definition, "Test">;
// { enabled: boolean; points: number[] }
```

`compileTypedLayout(definition)` retains that definition type. Use
`decodeTypedResource`, `validateTypedResource`, and `encodeTypedResource` with
the compiled result for inferred return values, resource-key completion, and
type-checked encoder inputs. `InferResources` derives a map of all resources.
Fixed and counted arrays infer element arrays; exact length and integer ranges
are runtime constraints. Static inference has a depth limit of 16, after which
it returns the general binary JSON value type.

`validateResource(compiled, resourceType, unknownInput)` validates and returns
structured data without allocating an output binary buffer. The typed variant
returns the schema-derived TypeScript type. Validation checks the same scalar
rules as the writer, sibling count relationships, array lengths, required and
unknown fields, and size/node budgets. Runtime JSON definitions can use the
untyped API with `JsonValue` results: a file loaded at runtime cannot magically
provide field names to the TypeScript compiler.

## Layout vocabulary

- Scalars: `u8`, `i8`, `u16`, `i16`, `u32`, `i32`, `f32`, `f64`, `bool`.
  Scalar array items can use the short form `"f32"`.
- Structs: ordered `fields`, each with a `name` and a layout. Structs return
  objects. Duplicate names, unknown data fields, and missing fields are errors.
- Arrays: `items` is any scalar, struct, array, or local type reference.
  Arrays return arrays, including arrays of structs and arrays of arrays.
- `count: 100` means exactly 100 stored elements. It is independent of an
  application-level active count such as Otto's `numNubs`.
- `count: { "field": "length" }` uses an earlier integer sibling field in
  the containing struct. Encoding validates the count rather than changing it.
- `count: "remaining"` fills the resource boundary. Items must have a fixed,
  positive byte size, and no later fields may follow it. Partial records fail.
- `$ref: "#/types/Point2"` reuses a definition. References cannot be recursive.
- `{ "type": "padding", "bytes": 2 }` is an unnamed field; padding is not
  mixed into application data. New padding is zero-filled.
- `byteOrder` is `big` by default, or `little`, for the entire document.

Missing values never silently become zero. Invalid lengths, integer ranges,
non-finite floats, f32 overflow, and invalid boolean bytes return `LayoutError`
objects with paths such as `Liqd[0].nubs[0].x`. Floating-point values use IEEE
rounding when encoded as f32. Trailing bytes are errors rather than discarded.

## Exact byte preservation

Decode returns `{ value, preservedBytes }`. Both are JSON-serializable.
`preservedBytes` retains unnamed padding and negative-zero float bytes, which
JSON would otherwise turn into ordinary zero. Pass it back when encoding to
preserve those bytes. Edited nonzero values override saved negative zero. To
intentionally change negative zero to positive zero, remove its saved path.
Keep the layout and array ordering stable when reusing preservation data;
after reordering records, discard or remap their saved paths.

Strings, character encodings, unions, pointer traversal, 64-bit integers, and
automatic alignment are outside this first version. String storage can be
represented explicitly as `u8` arrays, as in the skeleton bone names. Layouts
have a nesting limit of 64; resources have a 16 MiB byte limit and a budget of
one million decoded/encoded nodes. No user-supplied expressions are executed.

## Local verification

```sh
pnpm check:layouts
pnpm build:layouts
pnpm test:run
pnpm test:pangea:json
```

The last command reads the sibling PangeaRSEdit data checkout, or the path in
`PANGEA_GAMES_ROOT`, as described in [the corpus guide](tests/pangea/README.md).
It checks raw container preservation and the JSON layouts against real liquid,
spline, bone, keyframe, vector, index, and animation-event resources, including
an Earth Farm point edit and missing-coordinate rejection. Files are only read.
`build:layouts` emits runnable ES modules and TypeScript declarations into
`build/layout/`, independently of the older application's build. The declarations
retain the generic schema-to-data inference API.

`pnpm test:pangea` also runs the older string-converter liquid tests. Those
retain the 18 previously exposed failures in the legacy implementation; they
are not skipped or relabeled as expected failures. The new API bypasses that
packing code. The repository-wide TypeScript build also has pre-existing
errors in `resconverters.ts`; `check:layouts` checks all new layout source and
unit tests independently without disabling the existing checks.
