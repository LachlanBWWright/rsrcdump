# Quick Reference

Fast reference for common rsrcdump-ts operations.

## Installation

```bash
npm install @lachlanwright/rsrcdump-ts
```

## CLI Usage

```bash
# List resources
rsrcdump-ts list <file.rsrc>

# Extract to JSON
rsrcdump-ts extract <input.rsrc> <output.json> [specs.txt]

# Create from JSON
rsrcdump-ts create <input.json> <output.rsrc> [specs.txt]
```

## Library Usage

### Import

```typescript
import { 
  load, 
  saveToJson, 
  loadBytesFromJsonAsync,
  isOk, 
  unwrap 
} from '@lachlanwright/rsrcdump-ts';
```

### Load Resource Fork

```typescript
const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
}
```

### Convert to JSON

```typescript
const result = await saveToJson(data, structSpecs);
if (isOk(result)) {
  const jsonString = result.value;
}
```

### Create from JSON

```typescript
const result = await loadBytesFromJsonAsync(jsonBlob, structSpecs);
if (isOk(result)) {
  const binary = result.value;
}
```

### Error Handling

```typescript
// Check result
if (isOk(result)) {
  const value = result.value;
} else {
  const error = result.error;
}

// Unwrap (throws on error)
const value = unwrap(result);
```

## Struct Template Format

```
ResourceType:format:field1,field2,...
```

### Format Characters

| Char | Type | Size |
|------|------|------|
| `B` | unsigned byte | 1 |
| `b` | signed byte | 1 |
| `H` | unsigned short | 2 |
| `h` | signed short | 2 |
| `L` | unsigned long | 4 |
| `i/l` | signed long | 4 |
| `f` | float | 4 |
| `d` | double | 8 |
| `Ns` | N-byte string | N |
| `+` | list (repeating) | - |

### Examples

```
Hedr:L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters
YCrd:f+
FnNb:ii+:x,z
STR :256s:text
```

## Common Patterns

### Load and Inspect

```typescript
const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
  console.log(`Types: ${fork.tree.size}`);
  
  for (const [typeKey, typeMap] of fork.tree) {
    const type = Buffer.from(typeKey, 'binary').toString('latin1');
    console.log(`${type}: ${typeMap.size} resources`);
  }
}
```

### Extract with Specs

```typescript
import { readFile } from 'fs/promises';

const data = await readFile('file.rsrc');
const specs = (await readFile('specs.txt', 'utf-8'))
  .split('\n')
  .filter(l => l && !l.startsWith('//'));

const result = await saveToJson(new Uint8Array(data), specs);
```

### Round-trip Conversion

```typescript
// Load original
const data = await readFile('file.rsrc');
const jsonResult = await saveToJson(new Uint8Array(data));
if (!isOk(jsonResult)) return;

// Parse JSON
const jsonBlob = JSON.parse(jsonResult.value);

// Convert back to binary
const bytesResult = await loadBytesFromJsonAsync(jsonBlob);
if (!isOk(bytesResult)) return;

// Save
await writeFile('output.rsrc', bytesResult.value);
```

### Filter Resources

```typescript
// Include only specific types
const result = await saveToJson(data, [], ['Hedr', 'alis']);

// Exclude specific types
const result = await saveToJson(data, [], [], ['SpPt', 'SpNb']);
```

## Result Type Helpers

```typescript
import { ok, err, isOk, isErr, unwrap } from '@lachlanwright/rsrcdump-ts';

// Create results
const success = ok(42);
const failure = err('Something went wrong');

// Check results
if (isOk(result)) { /* success */ }
if (isErr(result)) { /* failure */ }

// Unwrap (throws if Err)
const value = unwrap(result);
```

## Development

```bash
# Build
npm run build

# Test
npm test
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Verify all
npm run verify
```

## Resources

- [Full Documentation](README.md)
- [API Reference](API.md)
- [Examples](examples/)
- [FAQ](FAQ.md)
- [Testing Guide](TESTING.md)
- [Development Guide](DEVELOPMENT.md)
