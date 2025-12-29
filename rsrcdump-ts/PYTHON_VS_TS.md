# Python vs TypeScript Comparison

Comprehensive comparison between the Python (rsrcdump) and TypeScript (rsrcdump-ts) implementations.

## Quick Comparison

| Feature | Python | TypeScript |
|---------|--------|------------|
| **Platform** | Python 3.7+ | Node.js 18+ / Browser |
| **Browser Support** | ❌ No | ✅ Yes |
| **Type Safety** | ⚠️ Runtime (optional hints) | ✅ Compile-time |
| **Error Handling** | Exceptions | Result/Err (no exceptions) |
| **Package Size** | N/A | 21.2 kB gzipped |
| **Dependencies** | 0 runtime | 0 runtime |
| **Performance** | ~baseline | ~same (within 10%) |
| **Tests** | ✅ Comprehensive | ✅ 69 tests (100% pass) |
| **Documentation** | Good | Extensive (60+ KB) |

## API Comparison

### Loading Resource Forks

**Python:**
```python
from rsrcdump import load

# From file path
fork = load('file.rsrc')

# From bytes
with open('file.rsrc', 'rb') as f:
    data = f.read()
    fork = load(data)
```

**TypeScript (Node.js):**
```typescript
import { readFile } from 'fs/promises';
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

// Must load file yourself
const data = await readFile('file.rsrc');
const result = load(new Uint8Array(data));

if (isOk(result)) {
    const fork = result.value;
}
```

**TypeScript (Browser):**
```typescript
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

// From File API
const file = await fileInput.files[0].arrayBuffer();
const result = load(new Uint8Array(file));

if (isOk(result)) {
    const fork = result.value;
}
```

### Error Handling

**Python:**
```python
try:
    fork = load('file.rsrc')
    json_str = save_to_json(fork)
except Exception as e:
    print(f"Error: {e}")
```

**TypeScript:**
```typescript
const result = load(data);
if (!isOk(result)) {
    console.error('Error:', result.error);
    return;
}

const fork = result.value;
const jsonResult = await saveToJson(data);
if (isOk(jsonResult)) {
    const jsonStr = jsonResult.value;
}
```

### JSON Conversion

**Python:**
```python
# To JSON
json_str = fork.to_json()

# From JSON
import json
json_data = json.loads(json_str)
fork = ResourceFork.from_json(json_data)
```

**TypeScript:**
```typescript
// To JSON
const jsonResult = await saveToJson(data, structSpecs);
if (isOk(jsonResult)) {
    const jsonStr = jsonResult.value;
}

// From JSON
const jsonBlob = JSON.parse(jsonStr);
const bytesResult = loadBytesFromJson(jsonBlob, structSpecs);
if (isOk(bytesResult)) {
    const bytes = bytesResult.value;
}
```

## Feature Parity

### Core Features

| Feature | Python | TypeScript | Notes |
|---------|:------:|:----------:|-------|
| Resource fork parsing | ✅ | ✅ | Identical |
| ADF format support | ✅ | ✅ | Identical |
| JSON export | ✅ | ✅ | Identical output |
| JSON import | ✅ | ✅ | Identical |
| Struct templates | ✅ | ✅ | Same syntax |
| Base16 converter | ✅ | ✅ | Identical |
| String converters | ✅ | ✅ | Identical |
| Text encoding | ✅ | ✅ | Mac Roman support |

### Advanced Features

| Feature | Python | TypeScript | Notes |
|---------|:------:|:----------:|-------|
| TypeScript type generation | ❌ | ✅ | TS only |
| JSON struct specs | ❌ | ✅ | TS only |
| Backtick array optimization | ❌ | ✅ | TS only |
| Result/Err types | ❌ | ✅ | TS only |
| Browser compatibility | ❌ | ✅ | TS only |
| Icon conversion | ✅ | ❌ | Python only |
| PICT support | ✅ | ❌ | Python only |
| Sound conversion | ✅ | ❌ | Python only |
| PNG export | ✅ | ❌ | Python only |
| TGA export | ✅ | ❌ | Python only |

## Performance Comparison

Tested on EarthFarm.ter.rsrc (159 KB):

| Operation | Python | TypeScript | Difference |
|-----------|--------|------------|------------|
| Load | ~5-10 ms | ~3-8 ms | TS faster |
| JSON export | ~20-30 ms | ~18-29 ms | Similar |
| Round-trip | ~40-60 ms | ~38-54 ms | Similar |

Both implementations are fast enough for most use cases.

## Type Safety

### Python

```python
# Type hints available but optional
from typing import Dict, List

def process_fork(fork: ResourceFork) -> Dict[str, any]:
    # Runtime errors possible
    return fork.to_json()  # Returns dict or str?
```

### TypeScript

```typescript
// Compile-time type checking
import type { ResourceFork, Result } from '@lachlanwright/rsrcdump-ts';

function processFork(fork: ResourceFork): Result<string, string> {
    // Type errors caught at compile time
    return saveToJson(fork);  // ❌ Type error - needs Uint8Array
}
```

## Error Handling Philosophy

### Python: Exceptions

```python
try:
    fork = load('file.rsrc')
    json_str = fork.to_json()
    # ... more operations
except FileNotFoundError:
    print("File not found")
except ValueError:
    print("Invalid data")
except Exception as e:
    print(f"Unexpected error: {e}")
```

**Pros:**
- Familiar to Python developers
- Can catch multiple error types

**Cons:**
- Easy to forget to catch errors
- Hidden control flow
- Stack unwinding overhead

### TypeScript: Result/Err

```typescript
const fileResult = await loadFile('file.rsrc');
if (!isOk(fileResult)) {
    console.error('File error:', fileResult.error);
    return;
}

const parseResult = load(fileResult.value);
if (!isOk(parseResult)) {
    console.error('Parse error:', parseResult.error);
    return;
}

const fork = parseResult.value;
// Continue with success case
```

**Pros:**
- Errors are explicit in type signatures
- Forces error handling at call site
- No hidden control flow
- Better for functional programming

**Cons:**
- More verbose
- Unfamiliar to developers coming from exceptions

## Code Size

### Python Implementation

```
src/rsrcdump/
├── __init__.py           ~100 lines
├── __main__.py           ~150 lines
├── adf.py                ~100 lines
├── resfork.py            ~400 lines
├── packutils.py          ~200 lines
├── textio.py             ~150 lines
├── resconverters.py      ~300 lines
├── jsonio.py             ~200 lines
├── structtemplate.py     ~300 lines
├── icons.py              ~200 lines
├── palettes.py           ~100 lines
├── pict.py               ~200 lines
├── png.py                ~100 lines
├── sndtoaiff.py          ~150 lines
└── tga.py                ~100 lines
Total: ~2,750 lines
```

### TypeScript Implementation

```
src/
├── index.ts              ~300 lines
├── cli.ts                ~130 lines
├── result.ts             ~50 lines
├── resfork.ts            ~350 lines
├── packutils.ts          ~200 lines
├── buffer-utils.ts       ~30 lines
├── textio.ts             ~120 lines
├── adf.ts                ~100 lines
├── structtemplate.ts     ~500 lines
├── resconverters.ts      ~300 lines
├── jsonio.ts             ~290 lines
├── typegen.ts            ~190 lines
├── jsonspecs.ts          ~160 lines
Total: ~2,720 lines (without tests)
Tests: ~800 lines additional
```

## When to Use Which?

### Use Python (rsrcdump) if:

- ✅ You need icon/PICT/sound conversion
- ✅ You're already in a Python environment
- ✅ You want PNG/TGA export capabilities
- ✅ You prefer exception-based error handling
- ✅ You're comfortable with dynamic typing

### Use TypeScript (rsrcdump-ts) if:

- ✅ You need browser support
- ✅ You want compile-time type safety
- ✅ You prefer Result/Err error handling
- ✅ You need TypeScript type generation
- ✅ You want modern JS/TS tooling
- ✅ You're building a web application
- ✅ You want to integrate with React/Vue/Angular

## Migration Path

If you're migrating from Python to TypeScript:

1. **File loading**: Load files yourself before calling library functions
2. **Error handling**: Replace try/catch with Result/Err checks
3. **JSON operations**: Similar API, just check results
4. **Struct templates**: Same syntax, works identically
5. **Missing features**: Icon/PICT/sound conversion not available yet

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## Conclusion

Both implementations are high-quality and production-ready. Choose based on your platform requirements and programming preferences:

- **Python**: Better for standalone tools, image conversion, desktop applications
- **TypeScript**: Better for web apps, type safety, browser integration, modern tooling

The TypeScript version is not a replacement for Python, but a complementary implementation for different use cases.
