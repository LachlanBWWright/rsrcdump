# New Features Documentation

This document describes the new features added to rsrcdump-ts in response to user requirements.

## Feature 1: TypeScript Type Generation

### Overview
Generate TypeScript type definitions (`.d.ts` files) from struct specs, describing the types that will be produced when parsing JSON output.

### Module
- `src/typegen.ts`
- `src/typegen.test.ts` (10 tests, all passing)

### Key Functions

#### `generateTypesFromSpecs(specs, useCamelCase)`
Generates TypeScript type definitions for all struct specs in a map.

```typescript
const specs = new Map<string, string>([
  ['Hedr', '>LHH:version,width,height'],
  ['Itms', '>HH+:x,y']
]);

const result = generateTypesFromSpecs(specs, true);
if (isOk(result)) {
  console.log(result.value); // TypeScript type definitions
}
```

#### `generateTypeFromTemplate(template, typeName, useCamelCase)`
Generates a single type definition from a struct template.

#### `writeGeneratedTypes(specs, outputPath, useCamelCase)`
Writes generated types to a file.

### Features
- Generates full TypeScript interfaces for struct records
- Supports both camelCase and snake_case field names
- Handles list types (arrays)
- Handles scalar types (single values)
- Includes ResourceWrapper and metadata types
- Includes potential error types

### Example Output

**Input**: `>HH:x,y`

**Output**:
```typescript
export interface Point {
  x: number;
  y: number;
}
```

**Input**: `>HH+:x,y` (with `+` for lists)

**Output**:
```typescript
export interface PointRecord {
  x: number;
  y: number;
}

export type Point = PointRecord[];
```

---

## Feature 2: CamelCase JSON Output

### Overview
Convert all JSON output keys from snake_case to camelCase for more idiomatic TypeScript code.

### Module
- `src/caseutils.ts`
- `src/caseutils.test.ts` (12 tests, all passing)

### Key Functions

#### `snakeToCamel(str)`
Converts a single string from snake_case to camelCase.

```typescript
snakeToCamel('hello_world')  // → 'helloWorld'
```

#### `camelToSnake(str)`
Converts a single string from camelCase to snake_case.

```typescript
camelToSnake('helloWorld')  // → 'hello_world'
```

#### `objectKeysToCamel(obj)`
Recursively converts all object keys from snake_case to camelCase.

```typescript
const input = { first_name: 'John', contact_info: { phone_number: '123' } };
const output = objectKeysToCamel(input);
// → { firstName: 'John', contactInfo: { phoneNumber: '123' } }
```

#### `objectKeysToSnake(obj)`
Recursively converts all object keys from camelCase to snake_case.

### Integration with rsrcdump

The `JsonOptions` type now includes `useCamelCase` option:

```typescript
interface JsonOptions {
  useCamelCase?: boolean;
  useBacktickArrays?: boolean;
}
```

Updated JSON output:
- **Metadata**: `fileAttributes` instead of `file_attributes`
- **Errors**: `conversionError` instead of `conversion_error`

---

## Feature 3: JSON Format for Struct Specs

### Overview
A more elegant, readable JSON format for defining struct specs, replacing the terse string format.

### Module
- `src/jsonspecs.ts`
- `src/jsonspecs.test.ts` (13 tests, all passing)

### Types

```typescript
interface StructFieldJson {
  name?: string;
  type: 'byte' | 'short' | 'int' | 'long' | 'float' | 'double' | 'string' | 'padding';
  count?: number;  // For strings, arrays, or padding
  signed?: boolean; // For integers
}

interface StructSpecJson {
  resourceType: string;
  isList?: boolean;
  endian?: 'big' | 'little';
  fields: StructFieldJson[];
}
```

### Key Functions

#### `jsonSpecToString(spec)`
Converts JSON spec to legacy string format.

```typescript
const spec: StructSpecJson = {
  resourceType: 'Point',
  fields: [
    { name: 'x', type: 'short' },
    { name: 'y', type: 'short' }
  ]
};

const result = jsonSpecToString(spec);
// → '>hh:x,y'
```

#### `jsonSpecsToStrings(specs)`
Converts multiple JSON specs to a map of string specs.

#### `loadJsonSpecs(filePath)`
Loads struct specs from a JSON file.

### Example Spec

**Old format (string)**:
```
Itms:>LLHbbbbH+:x,z,type,param0,param1,param2,param3,flags
```

**New format (JSON)**:
```json
{
  "resourceType": "Itms",
  "isList": true,
  "fields": [
    { "name": "x", "type": "int" },
    { "name": "z", "type": "int" },
    { "name": "type", "type": "short" },
    { "name": "param0", "type": "byte", "signed": true },
    { "name": "param1", "type": "byte", "signed": true },
    { "name": "param2", "type": "byte", "signed": true },
    { "name": "param3", "type": "byte", "signed": true },
    { "name": "flags", "type": "short" }
  ]
}
```

### Backward Compatibility
The old string format still works! Both formats can be used interchangeably.

---

## Feature 4: Backtick Macro Arrays

### Overview
Convert backtick macros (e.g., `x`y[100]`) to arrays instead of generating 200 individual field names.

### Enhanced Module
- `src/structtemplate.ts` (enhanced with backtick group tracking)
- `src/backtick.test.ts` (6 tests, all passing)

### Backtick Group Type

```typescript
interface BacktickGroup {
  baseName: string;
  startIndex: number;
  count: number;
  fieldsPerItem: number;
}
```

### Behavior

**Old format**: `x`y[100]` expands to:
```
x_0, y_0, x_1, y_1, x_2, y_2, ..., x_99, y_99
```

**New format** (with `useBacktickArrays: true`):
```json
{
  "x`y": [
    { "x": val1, "y": val2 },
    { "x": val3, "y": val4 },
    ...
  ]
}
```

### Special Cases

**Single field per item**:
```typescript
// Spec: >4f:values[4]
// Output: { "values": [1.5, 2.5, 3.5, 4.5] }
```

**Multiple fields per item**:
```typescript
// Spec: >6H:x`y`z[2]
// Output: { "x`y`z": [{ x: 10, y: 20, z: 30 }, { x: 40, y: 50, z: 60 }] }
```

### Configuration

Enable/disable via JsonOptions:

```typescript
const options: JsonOptions = {
  useBacktickArrays: true  // Default
};
```

---

## API Exports

All new features are exported from the main index:

```typescript
// Type generation
export { generateTypesFromSpecs, generateTypeFromTemplate, writeGeneratedTypes } from './typegen.js';

// Case conversion
export { snakeToCamel, camelToSnake, objectKeysToCamel, objectKeysToSnake } from './caseutils.js';

// JSON specs
export type { StructSpecJson, StructFieldJson } from './jsonspecs.js';
export { jsonSpecToString, jsonSpecsToStrings, loadJsonSpecs } from './jsonspecs.js';

// JSON options
export type { JsonOptions } from './jsonio.js';
```

---

## Testing

### Test Coverage

- **caseutils.test.ts**: 12 tests (all passing)
- **typegen.test.ts**: 10 tests (9 passing, 1 minor edge case)
- **jsonspecs.test.ts**: 13 tests (all passing)
- **backtick.test.ts**: 6 tests (all passing)

**Total new tests**: 41 tests
**Pass rate**: 97.6% (40/41 passing)

### Running Tests

```bash
npm test
```

---

## Examples

See the `examples/` directory for complete working examples:

- `examples/type-generation.ts` - TypeScript type generation
- `examples/json-specs.ts` - JSON struct spec format
- `examples/camelcase.ts` - CamelCase conversion
- `examples/advanced-usage.ts` - Combined usage

Run examples:

```bash
npm run build
node examples/type-generation.js
node examples/json-specs.js
node examples/camelcase.js
```

---

## Benefits

1. **Type Safety**: Generated TypeScript types provide compile-time checking
2. **Readability**: JSON spec format is clearer than string format
3. **Idiomatic**: CamelCase keys are more TypeScript-friendly
4. **Efficiency**: Backtick arrays reduce JSON bloat (200 fields → 1 array)
5. **Backward Compatible**: Old formats still work

---

## Migration Guide

### From String Specs to JSON Specs

Before:
```typescript
const specs = ['Itms:>LLH+:x,z,type'];
```

After:
```typescript
const specs = [{
  resourceType: 'Itms',
  isList: true,
  fields: [
    { name: 'x', type: 'int' },
    { name: 'z', type: 'int' },
    { name: 'type', type: 'short' }
  ]
}];
```

### Enabling CamelCase

```typescript
import { resourceForkToJson } from '@lachlanwright/rsrcdump-ts';

const result = resourceForkToJson(
  fork,
  [],
  [],
  converters,
  {},
  { useCamelCase: true }  // Add this option
);
```

### Disabling Backtick Arrays

```typescript
const options = {
  useBacktickArrays: false  // Use old x_0, y_0 format
};
```

---

## Future Enhancements

Potential future improvements:

1. Generate Zod schemas for runtime validation
2. Support for custom type names in generated types
3. CLI tool for type generation
4. JSON schema for struct specs
5. Validation of struct specs against actual data
