# Migration Guide: Python to TypeScript

This guide helps you migrate from the Python rsrcdump to the TypeScript version.

## Key Differences

### Error Handling

**Python (Exceptions):**
```python
try:
    fork = rsrcdump.load('file.rsrc')
    # Use fork...
except InvalidResourceFork as e:
    print(f"Error: {e}")
```

**TypeScript (Result Type):**
```typescript
const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
  // Use fork...
} else {
  console.error('Error:', result.error);
}
```

### Function Names

| Python | TypeScript | Notes |
|--------|-----------|-------|
| `rsrcdump.load()` | `load()` | Returns `Promise<Result<ResourceFork>>` |
| `rsrcdump.save_to_json()` | `saveToJson()` | Returns `Promise<Result<string>>` |
| `rsrcdump.load_bytes_from_json()` | `loadBytesFromJsonAsync()` | Async version with struct specs |
| - | `loadBytesFromJson()` | Sync version without struct specs |

### Data Structures

#### Resource

**Python:**
```python
@dataclass
class Resource:
    type: bytes
    num: int
    data: bytes
    name: bytes
    flags: int
    junk: int
    order: int = 0xFFFFFFFF
```

**TypeScript:**
```typescript
interface Resource {
  type: Uint8Array;
  num: number;
  data: Uint8Array;
  name: Uint8Array;
  flags: number;
  junk: number;
  order: number;
}
```

#### ResourceFork

**Python:**
```python
@dataclass
class ResourceFork:
    tree: dict[bytes, dict[int, Resource]]
    junk_nextresmap: int = 0
    junk_filerefnum: int = 0
    file_attributes: int = 0
```

**TypeScript:**
```typescript
interface ResourceFork {
  tree: Map<string, Map<number, Resource>>;
  junkNextresmap: number;
  junkFilerefnum: number;
  fileAttributes: number;
}
```

**Key difference**: TypeScript uses `Map` with string keys (binary string representation) instead of Python's dict with bytes keys.

### Accessing Resources

**Python:**
```python
fork = rsrcdump.load('file.rsrc')
hedr_resources = fork['Hedr']
hedr = fork['Hedr'][1000]
```

**TypeScript:**
```typescript
const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
  
  // Convert type name to key
  const hedrKey = Buffer.from('Hedr', 'binary').toString('binary');
  const hedrResources = fork.tree.get(hedrKey);
  
  // Or use helper function
  const hedrResult = getResourceType(fork, 'Hedr');
  if (isOk(hedrResult)) {
    const hedr = hedrResult.value.get(1000);
  }
}
```

### Struct Specs

**Python:**
```python
struct_specs = [
    'Hedr:L5i3f4i44s:vers,items,width,height,...',
    'YCrd:f+',
    'FnNb:ii+'
]

json_data = rsrcdump.save_to_json(data, struct_specs=struct_specs)
```

**TypeScript:**
```typescript
const structSpecs = [
  'Hedr:L5i3f4i44s:vers,items,width,height,...',
  'YCrd:f+',
  'FnNb:ii+'
];

const result = await saveToJson(data, structSpecs);
```

## Common Patterns

### Loading from File

**Python:**
```python
import rsrcdump

fork = rsrcdump.load('file.rsrc')
```

**TypeScript:**
```typescript
import { load, isOk } from 'rsrcdump-ts';

const result = await load('file.rsrc');
if (isOk(result)) {
  const fork = result.value;
}
```

### Converting to JSON

**Python:**
```python
with open('file.rsrc', 'rb') as f:
    data = f.read()

json_str = rsrcdump.save_to_json(data)
```

**TypeScript:**
```typescript
import { readFile } from 'fs/promises';
import { saveToJson, isOk } from 'rsrcdump-ts';

const data = await readFile('file.rsrc');
const result = await saveToJson(new Uint8Array(data));

if (isOk(result)) {
  const jsonStr = result.value;
}
```

### Creating from JSON

**Python:**
```python
with open('file.json', 'r') as f:
    json_blob = json.load(f)

binary_data = rsrcdump.load_bytes_from_json(json_blob)

with open('output.rsrc', 'wb') as f:
    f.write(binary_data)
```

**TypeScript:**
```typescript
import { readFile, writeFile } from 'fs/promises';
import { loadBytesFromJsonAsync, isOk } from 'rsrcdump-ts';

const jsonStr = await readFile('file.json', 'utf-8');
const jsonBlob = JSON.parse(jsonStr);

const result = await loadBytesFromJsonAsync(jsonBlob);

if (isOk(result)) {
  await writeFile('output.rsrc', result.value);
}
```

### Iterating Over Resources

**Python:**
```python
for res_type, type_map in fork.tree.items():
    for res_id, resource in type_map.items():
        print(f"{res_type.decode('latin1')} #{res_id}: {len(resource.data)} bytes")
```

**TypeScript:**
```typescript
for (const [typeKey, typeMap] of fork.tree) {
  for (const [resId, resource] of typeMap) {
    const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
    console.log(`${typeStr} #${resId}: ${resource.data.length} bytes`);
  }
}
```

## Type Conversions

### bytes ↔ Uint8Array

**Python `bytes`** → **TypeScript `Uint8Array`**

```typescript
// Reading
const bytes: Uint8Array = resource.data;

// Converting to string
const str = Buffer.from(bytes).toString('latin1');

// Converting to hex
const hex = Buffer.from(bytes).toString('hex');
```

### dict ↔ Map

**Python `dict`** → **TypeScript `Map`**

```typescript
// Creating
const map = new Map<string, Resource>();

// Setting
map.set(key, value);

// Getting
const value = map.get(key);

// Checking existence
if (map.has(key)) { ... }

// Iterating
for (const [key, value] of map) { ... }
```

## Error Handling Patterns

### Python Try/Catch

**Python:**
```python
try:
    fork = rsrcdump.load(path)
    json_data = rsrcdump.save_to_json(fork)
    return json_data
except InvalidResourceFork as e:
    print(f"Invalid: {e}")
    return None
except Exception as e:
    print(f"Error: {e}")
    return None
```

### TypeScript Result Chain

**TypeScript:**
```typescript
async function processFile(path: string): Promise<Result<string, string>> {
  const loadResult = await load(path);
  if (!isOk(loadResult)) {
    return loadResult;
  }

  const jsonResult = await saveToJson(loadResult.value.data);
  if (!isOk(jsonResult)) {
    return jsonResult;
  }

  return ok(jsonResult.value);
}
```

## CLI Migration

### Python CLI

```bash
# Python
python3 -m rsrcdump --extract --struct-file sample-specs.txt file.rsrc

python3 -m rsrcdump --create file.json -o output.rsrc

python3 -m rsrcdump --list file.rsrc
```

### TypeScript CLI

```bash
# TypeScript
npm run cli extract file.rsrc output.json sample-specs.txt

npm run cli create file.json output.rsrc sample-specs.txt

npm run cli list file.rsrc
```

## Tips for Migration

1. **Always check Results**: Don't forget to check `isOk()` on every Result
2. **Use Type Guards**: Let TypeScript narrow types for you
3. **Convert keys carefully**: Resource type keys are binary strings in TS Maps
4. **Handle async**: All file I/O is async in TypeScript
5. **Use Buffer**: For encoding conversions, use Node.js Buffer class

## Benefits of TypeScript Version

- ✅ **Type Safety**: Catch errors at compile time
- ✅ **No Hidden Errors**: All errors are explicit in return types
- ✅ **Better IDE Support**: Full autocomplete and type hints
- ✅ **Refactoring Safety**: TypeScript catches breaking changes
- ✅ **Modern Async**: Native Promise support
- ✅ **Performance**: Comparable to Python, sometimes faster
