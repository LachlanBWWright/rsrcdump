# Frequently Asked Questions (FAQ)

Common questions about rsrcdump-ts.

## General

### What is rsrcdump-ts?

rsrcdump-ts is a TypeScript port of [rsrcdump](https://github.com/jorio/rsrcdump), a tool for extracting and converting Classic Mac OS resource forks to JSON. This TypeScript version features strict type safety and Result/Err error handling instead of exceptions.

### Why TypeScript instead of Python?

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Full autocomplete and inline documentation
- **Result Types**: Explicit error handling without exceptions
- **Package Ecosystem**: Easy integration with Node.js projects
- **Performance**: Comparable or better performance than Python

### How does it compare to the Python version?

- Produces identical JSON output
- Byte-perfect round-trip conversion
- Same CLI interface
- Same struct template format
- Additional type safety and error handling

## Installation & Usage

### How do I install it?

```bash
npm install @lachlanwright/rsrcdump-ts
```

Or globally:
```bash
npm install -g @lachlanwright/rsrcdump-ts
```

### Can I use it as a library?

Yes! Import it in your TypeScript/JavaScript code:

```typescript
import { load, saveToJson, isOk } from '@lachlanwright/rsrcdump-ts';

const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
  // Use the resource fork
}
```

### Can I use it from the command line?

Yes! After installation:

```bash
rsrcdump-ts list file.rsrc
rsrcdump-ts extract file.rsrc output.json
rsrcdump-ts create input.json output.rsrc
```

## Error Handling

### Why use Result types instead of try/catch?

Result types make errors explicit and type-safe:

```typescript
// With Result types
const result = await load('file.rsrc');
if (isOk(result)) {
  // TypeScript knows result.value exists
  const fork = result.value;
} else {
  // TypeScript knows result.error exists
  console.error('Error:', result.error);
}

// With exceptions (not used)
try {
  const fork = await load('file.rsrc'); // Could throw!
  // Use fork
} catch (error) {
  // What type is error? Who knows!
  console.error('Error:', error);
}
```

Benefits:
- Can't forget to handle errors
- Errors are part of the type signature
- No hidden control flow
- Better composability

### How do I unwrap a Result if I'm sure it's Ok?

Use the `unwrap()` helper (but only when you're certain):

```typescript
import { unwrap } from '@lachlanwright/rsrcdump-ts';

const result = await load('file.rsrc');
const fork = unwrap(result); // Throws if result is Err
```

⚠️ **Warning**: Only use `unwrap()` when you want to crash on errors, like in simple scripts.

### How do I chain multiple Results?

Use early returns:

```typescript
async function processFile(path: string): Promise<Result<string, string>> {
  const loadResult = await load(path);
  if (!isOk(loadResult)) return loadResult;
  
  const jsonResult = await saveToJson(loadResult.value);
  if (!isOk(jsonResult)) return jsonResult;
  
  return jsonResult;
}
```

## Resource Forks

### What are resource forks?

Resource forks were a feature of Classic Mac OS that stored structured data separately from a file's main data. They were used for:
- Application resources (icons, menus, dialogs)
- Game data (levels, sprites, sounds)
- Document metadata

### Can I extract resource forks from modern macOS files?

Yes! On macOS, resource forks still exist and can be accessed with `/..namedfork/rsrc`:

```bash
rsrcdump-ts extract "MyFile/..namedfork/rsrc" output.json
```

### What about AppleDouble format?

rsrcdump-ts automatically detects and handles AppleDouble format (files starting with `._` or from `__MACOSX` folders).

### Can I create new resource forks?

Yes! Convert JSON to a resource fork:

```bash
rsrcdump-ts create input.json output.rsrc
```

## Struct Templates

### What are struct templates?

Struct templates define how to interpret binary resource data as structured fields:

```
Hedr:L5i3f4i44s:vers,items,width,height,tilePages,tiles,tileSize,minY,maxY,splines,fences,uniqueST,waters
```

This tells rsrcdump-ts to parse the `Hedr` resource as:
- 1 unsigned long (`L`)
- 5 signed integers (`5i`)
- 3 floats (`3f`)
- 4 signed integers (`4i`)
- 44-byte string (`44s`)

### How do I create struct templates?

Format: `ResourceType:format:field1,field2,...`

Common format characters:
- `B` - unsigned byte
- `b` - signed byte
- `H` - unsigned short (2 bytes)
- `h` - signed short (2 bytes)
- `L` - unsigned long (4 bytes)
- `l`/`i` - signed long (4 bytes)
- `f` - float (4 bytes)
- `d` - double (8 bytes)
- `Ns` - N bytes as string
- `+` - list (multiple records)

Examples:
```
YCrd:f+              # List of floats
FnNb:ii+:x,z         # List of x,z pairs
STR :256s            # 256-byte string
```

### Can I use struct specs from Python rsrcdump?

Yes! They're compatible. Use `--struct-file` or `-f`:

```bash
rsrcdump-ts extract file.rsrc output.json sample-specs.txt
```

## Development

### How do I contribute?

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### How do I run tests?

```bash
npm test
```

See [TESTING.md](TESTING.md) for more details.

### What are the coding standards?

- Strict TypeScript with `noUncheckedIndexedAccess`
- No non-null assertions (`!`)
- Result types for all errors
- ESLint for code style
- See [DEVELOPMENT.md](DEVELOPMENT.md)

### How do I build from source?

```bash
git clone https://github.com/LachlanBWWright/rsrcdump.git
cd rsrcdump/rsrcdump-ts
npm install
npm run build
```

## Troubleshooting

### The package is asking for Python/rsrcdump

Make sure you're using the TypeScript package:

```bash
npm install @lachlanwright/rsrcdump-ts
```

Not the Python version.

### I get "Cannot find module" errors

Rebuild the package:

```bash
npm run build
```

### Tests are failing

Try cleaning and rebuilding:

```bash
rm -rf build/ node_modules/
npm install
npm test
```

### I found a bug!

Please [open an issue](https://github.com/LachlanBWWright/rsrcdump/issues) with:
- Description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Sample files (if possible)

## Performance

### How fast is it?

Benchmarks on a typical file (EarthFarm.ter.rsrc, 925 KB):
- Load: 3-8 ms
- JSON conversion: 18-29 ms
- Round-trip: 38-54 ms

Performance is comparable to or better than Python.

### Can I process large files?

Yes, but keep in mind that the entire file is loaded into memory. For very large files (>100 MB), consider processing in chunks if possible.

### How do I profile performance?

Use the performance tests:

```bash
npm test performance
```

## Compatibility

### What Node.js version do I need?

Node.js 18.0.0 or later.

### Does it work in browsers?

Not currently, as it uses Node.js APIs (fs, Buffer). A browser-compatible version could be created in the future.

### Can I use it with CommonJS?

The package is ESM-only. For CommonJS projects, use dynamic imports:

```javascript
const { load } = await import('@lachlanwright/rsrcdump-ts');
```

### Does it work with TypeScript 4.x?

The package is built with TypeScript 5.9.3. It should work with TypeScript 4.9+, but TypeScript 5+ is recommended.

## More Questions?

- Check the documentation in this repository
- Look at the [examples](examples/)
- Review the [API documentation](API.md)
- Open an issue on GitHub
