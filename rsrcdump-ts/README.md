# rsrcdump-ts

TypeScript port of [rsrcdump](https://github.com/jorio/rsrcdump) with Result/Err error handling.

## Features

- **Strict TypeScript**: Full type safety with strict compiler settings including `noUncheckedIndexedAccess`
- **Result/Err Error Handling**: No exceptions for control flow - all errors are returned as `Result` types
- **File-for-file Conversion**: Maintains the structure of the original Python implementation
- **Byte-perfect Round-trips**: Unpack and repack resource forks without data loss
- **JSON Compatibility**: Produces JSON output identical to the Python version

## Installation

```bash
npm install
```

## Usage

### CLI

```bash
# List resources
npm run cli list EarthFarm.ter.rsrc

# Extract to JSON
npm run cli extract input.rsrc output.json [struct-specs.txt]

# Create from JSON
npm run cli create input.json output.rsrc [struct-specs.txt]
```

### As a Library

```typescript
import { load, saveToJson, loadBytesFromJsonAsync, isOk } from 'rsrcdump-ts';

// Load a resource fork
const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
  console.log(`Loaded ${fork.tree.size} resource types`);
}

// Convert to JSON
const data = await readFile('file.rsrc');
const jsonResult = await saveToJson(new Uint8Array(data));
if (isOk(jsonResult)) {
  await writeFile('output.json', jsonResult.value);
}

// Create from JSON
const jsonBlob = JSON.parse(await readFile('input.json', 'utf-8'));
const bytesResult = await loadBytesFromJsonAsync(jsonBlob);
if (isOk(bytesResult)) {
  await writeFile('output.rsrc', bytesResult.value);
}
```

## Result/Err Error Handling

Instead of throwing exceptions, all functions that can fail return a `Result` type:

```typescript
type Result<T, E = Error> = Ok<T> | Err<E>;

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E = Error> {
  readonly ok: false;
  readonly error: E;
}
```

Use the `isOk()` helper to check results:

```typescript
const result = await load('file.rsrc');
if (isOk(result)) {
  // Success - use result.value
  const fork = result.value;
} else {
  // Error - use result.error
  console.error('Failed:', result.error);
}
```

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

## Project Structure

- `src/result.ts` - Result/Err type definitions
- `src/textio.ts` - Text encoding utilities
- `src/packutils.ts` - Binary packing/unpacking
- `src/resfork.ts` - Resource fork data structures
- `src/adf.ts` - AppleDouble format support
- `src/structtemplate.ts` - Struct template parsing
- `src/resconverters.ts` - Resource converters
- `src/jsonio.ts` - JSON I/O operations
- `src/cli.ts` - Command-line interface
- `src/index.ts` - Public API

## Verification

The TypeScript implementation has been verified to:

1. ✅ Parse the same resource forks as the Python version
2. ✅ Produce JSON output identical to Python (modulo float formatting)
3. ✅ Support byte-perfect round-trip conversions
4. ✅ Pass comprehensive unit tests

## License

MIT License - see [LICENSE.md](../LICENSE.md)
