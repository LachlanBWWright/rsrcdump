# rsrcdump-ts

TypeScript library for parsing and creating Macintosh resource forks. Browser-compatible with no Node.js dependencies.

## Features

- 🌐 **Browser Compatible** - Works in browsers and Node.js (no `fs` dependencies in core library)
- 🔒 **Type Safe** - Strict TypeScript with `noUncheckedIndexedAccess`
- ✅ **Error Handling** - Result/Err pattern (no exceptions for control flow)
- 📦 **Small Bundle** - 21.2 kB gzipped
- 🧪 **Well Tested** - 69 tests, 100% pass rate
- 📝 **TypeScript Type Generation** - Generate `.d.ts` files from struct specs
- 🎨 **JSON Struct Specs** - Define struct specs in elegant JSON format
- ⚡ **Backtick Array Optimization** - Compact array representation for repeated fields

## Installation

```bash
npm install @lachlanwright/rsrcdump-ts
```

## Quick Start

### Browser Usage

```typescript
import { load, saveToJson, isOk } from '@lachlanwright/rsrcdump-ts';

// Load file using File API
const file = await fileInput.files[0].arrayBuffer();
const data = new Uint8Array(file);

// Parse resource fork
const result = load(data);
if (isOk(result)) {
  const fork = result.value;
  console.log(`Loaded ${fork.tree.size} resource types`);
  
  // Convert to JSON
  const jsonResult = await saveToJson(data, []);
  if (isOk(jsonResult)) {
    const jsonString = jsonResult.value;
    // Use the JSON...
  }
}
```

### Node.js Usage

```typescript
import { readFile } from 'fs/promises';
import { load, saveToJson, isOk } from '@lachlanwright/rsrcdump-ts';

// Load file
const fileData = await readFile('file.rsrc');
const data = new Uint8Array(fileData);

// Parse resource fork
const result = load(data);
if (isOk(result)) {
  const fork = result.value;
  console.log(`Loaded ${fork.tree.size} resource types`);
}
```

## API Overview

### Core Functions

- **`load(data: Uint8Array)`** - Parse resource fork from bytes
- **`saveToJson(data, specs?, include?, exclude?, options?)`** - Convert to JSON
- **`loadBytesFromJson(json, specs?, only?, skip?, adf?)`** - Convert JSON back to bytes

### Type Generation

- **`generateTypesFromSpecs(specs)`** - Generate TypeScript type definitions
- **`generateTypeFromTemplate(template, typeName?)`** - Generate type from single template

### JSON Struct Specs

- **`parseJsonSpecs(jsonData)`** - Parse struct specs from JSON
- **`jsonSpecToString(spec)`** - Convert single JSON spec to string format
- **`jsonSpecsToStrings(specs)`** - Convert multiple JSON specs

### Resource Fork Operations

- **`resourceForkFromBytes(data)`** - Low-level parse
- **`packResourceFork(fork)`** - Low-level pack
- **`resourceForkToJsonString(fork, ...)`** - Convert fork to JSON

## Examples

See the `examples/` directory for complete examples:

- `examples/basic-usage.ts` - Basic usage patterns
- `examples/advanced-usage.ts` - Advanced features
- `examples/type-generation.ts` - TypeScript type generation
- `examples/json-specs.ts` - JSON struct spec format

## Documentation

- [API Reference](./API.md) - Complete API documentation
- [Quick Reference](./QUICK_REFERENCE.md) - Common operations
- [FAQ](./FAQ.md) - Frequently asked questions
- [New Features](./NEW_FEATURES.md) - Advanced features guide
- [Testing](./TESTING.md) - Testing guide
- [Development](./DEVELOPMENT.md) - Contributing guide
- [Result Type](./RESULT_TYPE.md) - Error handling pattern

## CLI Tool (Node.js only)

The package includes a CLI tool for Node.js:

```bash
# Extract to JSON
npm run cli extract input.rsrc output.json [struct-specs.txt]

# Create from JSON
npm run cli create input.json output.rsrc [struct-specs.txt]

# List resources
npm run cli list input.rsrc
```

## Browser Compatibility

The core library has **zero** Node.js dependencies and works in any modern browser. The only requirement is ES2020+ support.

### What's Browser-Compatible

✅ All parsing and conversion functions
✅ Type generation (returns string, you save it)
✅ JSON operations
✅ Struct template parsing
✅ Result/Err error handling

### What's Node.js Only

⚠️ CLI tool (`src/cli.ts`)
⚠️ File I/O in examples

## Performance

Tested on EarthFarm.ter.rsrc (159 KB):

- **Load**: 3-8 ms
- **JSON Conversion**: 18-29 ms  
- **Round-trip**: 38-54 ms

## License

MIT

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.
