# API Reference

Complete API documentation for rsrcdump-ts.

## Table of Contents

- [Result Types](#result-types)
- [Core Functions](#core-functions)
- [Data Structures](#data-structures)
- [Resource Converters](#resource-converters)
- [Struct Templates](#struct-templates)
- [Utilities](#utilities)

## Result Types

### `Result<T, E>`

Union type representing either success or failure.

```typescript
type Result<T, E = Error> = Ok<T> | Err<E>;
```

### `Ok<T>`

Success result containing a value.

```typescript
interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}
```

### `Err<E>`

Error result containing an error.

```typescript
interface Err<E = Error> {
  readonly ok: false;
  readonly error: E;
}
```

### Result Helpers

#### `ok<T>(value: T): Ok<T>`

Creates a success result.

```typescript
const result = ok(42);
// result.ok === true
// result.value === 42
```

#### `err<E>(error: E): Err<E>`

Creates an error result.

```typescript
const result = err('Something went wrong');
// result.ok === false
// result.error === 'Something went wrong'
```

#### `isOk<T, E>(result: Result<T, E>): result is Ok<T>`

Type guard to check if result is Ok.

```typescript
if (isOk(result)) {
  // TypeScript knows result.value exists
  console.log(result.value);
}
```

#### `isErr<T, E>(result: Result<T, E>): result is Err<E>`

Type guard to check if result is Err.

```typescript
if (isErr(result)) {
  // TypeScript knows result.error exists
  console.error(result.error);
}
```

#### `unwrap<T, E>(result: Result<T, E>): T`

Extracts value from Result, throwing if it's an error.

```typescript
const value = unwrap(result); // Throws if result is Err
```

⚠️ **Warning**: Only use `unwrap()` when you're certain the result is Ok.

## Core Functions

### `load(pathOrData: string | Uint8Array): Promise<Result<ResourceFork, string>>`

Loads a resource fork from a file path or binary data.

```typescript
// From file
const result = await load('file.rsrc');

// From bytes
const data = new Uint8Array([...]);
const result = await load(data);

if (isOk(result)) {
  const fork = result.value;
  console.log(`Loaded ${fork.tree.size} resource types`);
}
```

**Returns**: Promise resolving to Result containing ResourceFork or error message.

### `saveToJson(data: Uint8Array, structSpecs?: string[], includeTypes?: string[], excludeTypes?: string[]): Promise<Result<string, string>>`

Converts a resource fork to JSON string.

```typescript
const data = await readFile('file.rsrc');
const result = await saveToJson(
  new Uint8Array(data),
  ['Hedr:L5i3f4i44s:vers,items,width...'], // struct specs
  [],  // include all types
  []   // exclude no types
);

if (isOk(result)) {
  const jsonStr = result.value;
  await writeFile('output.json', jsonStr);
}
```

**Parameters**:
- `data`: Binary resource fork data
- `structSpecs`: Optional array of struct template strings
- `includeTypes`: Optional array of types to include (all if empty)
- `excludeTypes`: Optional array of types to exclude

**Returns**: Promise resolving to Result containing JSON string or error.

### `loadBytesFromJsonAsync(jsonBlob: unknown, structSpecs?: string[], onlyTypes?: string[], skipTypes?: string[], adf?: boolean): Promise<Result<Uint8Array, string>>`

Converts JSON back to binary resource fork.

```typescript
const jsonStr = await readFile('file.json', 'utf-8');
const jsonBlob = JSON.parse(jsonStr);

const result = await loadBytesFromJsonAsync(
  jsonBlob,
  ['Hedr:L5i3f4i44s:vers,items,width...'], // struct specs
  [],     // only these types (all if empty)
  [],     // skip these types
  true    // wrap in ADF format
);

if (isOk(result)) {
  await writeFile('output.rsrc', result.value);
}
```

**Parameters**:
- `jsonBlob`: Parsed JSON object
- `structSpecs`: Optional array of struct template strings
- `onlyTypes`: Optional array of types to include
- `skipTypes`: Optional array of types to exclude
- `adf`: Whether to wrap in AppleDouble format (default: true)

**Returns**: Promise resolving to Result containing binary data or error.

## Data Structures

### `Resource`

Represents a single resource.

```typescript
interface Resource {
  type: Uint8Array;      // 4-byte type code
  num: number;           // Resource ID
  data: Uint8Array;      // Resource data
  name: Uint8Array;      // Resource name (MacRoman)
  flags: number;         // Resource flags
  junk: number;          // Handle value (for exact copies)
  order: number;         // Original order (0xFFFFFFFF if unknown)
}
```

### `ResourceFork`

Represents a complete resource fork.

```typescript
interface ResourceFork {
  tree: Map<string, Map<number, Resource>>; // Type→ID→Resource
  junkNextresmap: number;    // Preserved junk value
  junkFilerefnum: number;    // Preserved junk value
  fileAttributes: number;    // Finder file attributes
}
```

### Resource Helper Functions

#### `createResource(...): Resource`

Creates a new Resource.

```typescript
const res = createResource(
  new Uint8Array([0x48, 0x65, 0x64, 0x72]), // 'Hedr'
  1000,                                        // ID
  new Uint8Array([...]),                       // data
  new Uint8Array([0x48, 0x65, 0x61, 0x64, 0x65, 0x72]), // 'Header'
  0,                                           // flags
  0,                                           // junk
  0                                            // order
);
```

#### `resourceDesc(res: Resource): string`

Gets a readable description of a resource.

```typescript
const desc = resourceDesc(res);
// "Hedr#1000"
```

#### `resourceTypeStr(res: Resource): string`

Decodes the resource type to a string.

```typescript
const typeStr = resourceTypeStr(res);
// "Hedr"
```

#### `resourceNameStr(res: Resource): string`

Decodes the resource name to a string.

```typescript
const nameStr = resourceNameStr(res);
// "Header"
```

## Resource Converters

### `Base16Converter`

Converts resources to/from hexadecimal strings.

```typescript
const converter = new Base16Converter();
const hex = converter.unpack(resource, fork);
// Result<string, string> containing hex data

const bytes = converter.pack(hexString);
// Result<Uint8Array, string>
```

### `StructConverter`

Converts resources using struct templates.

```typescript
import { structTemplateFromString } from 'rsrcdump-ts';

const templateResult = structTemplateFromString('ii:x,z');
if (isOk(templateResult)) {
  const converter = new StructConverter(templateResult.value);
  
  const obj = converter.unpack(resource, fork);
  // Result<{x: number, z: number}, string>
}
```

### `SingleStringConverter`

Converts STR resources to/from strings.

```typescript
const converter = new SingleStringConverter();
const str = converter.unpack(resource, fork);
// Result<string, string>
```

### `StringListConverter`

Converts STR# resources to/from string arrays.

```typescript
const converter = new StringListConverter();
const strings = converter.unpack(resource, fork);
// Result<string[], string>
```

### `TextConverter`

Converts TEXT resources to/from strings.

```typescript
const converter = new TextConverter();
const text = converter.unpack(resource, fork);
// Result<string, string>
```

## Struct Templates

### `structTemplateFromString(template: string): Result<StructTemplate, string>`

Parses a struct template string.

```typescript
const result = structTemplateFromString('L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters');

if (isOk(result)) {
  const template = result.value;
  // Use template for packing/unpacking
}
```

**Format**: `format[:fields]`

**Format characters**:
- `B`: unsigned byte
- `b`: signed byte  
- `H`: unsigned short (2 bytes)
- `h`: signed short (2 bytes)
- `L`: unsigned long (4 bytes)
- `l/i`: signed long (4 bytes)
- `f`: float (4 bytes)
- `d`: double (8 bytes)
- `Ns`: N bytes as hex string

**Modifiers**:
- `+`: List format (multiple records)
- `>`: Big-endian (default if not specified)
- `<`: Little-endian

**Examples**:
```typescript
'f+'              // List of floats
'ii'              // Two integers (unnamed)
'ii:x,z'          // Two integers named x and z
'L5i3f4i44s:...'  // Complex structure with names
```

### `unpackRecord(template: StructTemplate, data: Uint8Array, offset: number): Result<unknown, string>`

Unpacks a single record from binary data.

```typescript
const result = unpackRecord(template, data, 0);
if (isOk(result)) {
  const record = result.value;
  // Object, array, or primitive depending on template
}
```

### `pack(template: StructTemplate, obj: unknown): Result<Uint8Array, string>`

Packs data according to template.

```typescript
const obj = { x: 409, z: 2057 };
const result = pack(template, obj);

if (isOk(result)) {
  const bytes = result.value;
  // Packed binary data
}
```

## Utilities

### Text Encoding

#### `getGlobalEncoding(): string`

Gets the current encoding (default: 'macroman').

#### `setGlobalEncoding(encoding: string): void`

Sets the global text encoding.

#### `sanitizeTypeName(restype: Uint8Array): string`

Converts a resource type to URL-safe string.

```typescript
const safe = sanitizeTypeName(new Uint8Array([0x53, 0x54, 0x52, 0x20]));
// "STR%20"
```

#### `parseTypeName(saneName: string): Uint8Array`

Parses a sanitized type name back to bytes.

```typescript
const bytes = parseTypeName('STR%20');
// Uint8Array([0x53, 0x54, 0x52, 0x20])
```

#### `decode(bytes: Uint8Array): string`

Decodes bytes to string using global encoding.

#### `encode(text: string): Uint8Array`

Encodes string to bytes using global encoding.

### AppleDouble Format

#### `unpackAdf(adfData: Uint8Array): Result<Map<number, Uint8Array>, string>`

Unpacks an AppleDouble format file.

```typescript
const result = unpackAdf(data);
if (isOk(result)) {
  const entries = result.value;
  const resfork = entries.get(ADF_ENTRYNUM_RESOURCEFORK);
}
```

#### `packAdf(entries: Map<number, Uint8Array>): Result<Uint8Array, string>`

Packs data into AppleDouble format.

```typescript
const entries = new Map();
entries.set(ADF_ENTRYNUM_RESOURCEFORK, resourceForkBytes);

const result = packAdf(entries);
if (isOk(result)) {
  const adfBytes = result.value;
}
```

## Constants

```typescript
export const ADF_MAGIC = 0x00051607;
export const ADF_VERSION = 0x00020000;
export const ADF_ENTRYNUM_RESOURCEFORK = 2;
```

## Type Exports

All types are exported for use in your code:

```typescript
import type {
  Result, Ok, Err,
  Resource, ResourceFork, ResType,
  ResourceConverter,
  StructTemplate,
} from 'rsrcdump-ts';
```
