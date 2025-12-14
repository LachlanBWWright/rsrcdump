# Result/Err Type Pattern

This TypeScript implementation uses a Result/Err type pattern instead of exceptions for error handling. This provides several benefits:

## Benefits

1. **Explicit Error Handling**: All functions that can fail return a `Result` type, making it impossible to forget to handle errors
2. **Type-Safe Errors**: Error types are known at compile time
3. **No Hidden Control Flow**: Unlike exceptions, you can't accidentally skip error handling
4. **Better Composability**: Results can be chained and transformed easily

## The Result Type

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

## Basic Usage

### Checking Results

```typescript
import { load, isOk } from 'rsrcdump-ts';

const result = await load('file.rsrc');

if (isOk(result)) {
  // Success path - TypeScript knows result.value exists
  const fork = result.value;
  console.log(`Loaded ${fork.tree.size} resource types`);
} else {
  // Error path - TypeScript knows result.error exists
  console.error('Failed to load:', result.error);
}
```

### Creating Results

```typescript
import { ok, err } from 'rsrcdump-ts';

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}

const result = divide(10, 2);
if (isOk(result)) {
  console.log('Result:', result.value); // 5
}
```

### Unwrapping Results

If you're certain a result is Ok, you can unwrap it (throws if it's an error):

```typescript
import { unwrap } from 'rsrcdump-ts';

const result = await load('file.rsrc');
const fork = unwrap(result); // Throws if result is an error
```

⚠️ **Warning**: Only use `unwrap()` when you're absolutely sure the result is Ok, or when you want to propagate the error up the stack.

## Advanced Patterns

### Mapping Over Results

Transform a successful result without explicit error checking:

```typescript
import { map } from 'rsrcdump-ts';

const result = await load('file.rsrc');
const resourceCount = map(result, fork => fork.tree.size);

if (isOk(resourceCount)) {
  console.log('Resource count:', resourceCount.value);
}
```

### Chaining Results

Chain multiple operations that return Results:

```typescript
import { andThen } from 'rsrcdump-ts';

async function loadAndConvert(path: string): Promise<Result<string, string>> {
  const loadResult = await load(path);
  
  return andThen(loadResult, fork => {
    return resourceForkToJsonString(fork, [], [], new Map());
  });
}
```

### Early Return Pattern

A common pattern for handling multiple Results:

```typescript
async function processFile(path: string): Promise<Result<void, string>> {
  const loadResult = await load(path);
  if (!isOk(loadResult)) {
    return loadResult; // Early return with error
  }
  
  const fork = loadResult.value;
  
  const jsonResult = await saveToJson(fork);
  if (!isOk(jsonResult)) {
    return jsonResult; // Early return with error
  }
  
  // All operations succeeded
  return ok(undefined);
}
```

## Comparison with Exceptions

### With Exceptions (Python-style)

```python
try:
    fork = load_resource_fork(path)
    json_data = convert_to_json(fork)
    save_to_file(json_data, output_path)
except InvalidResourceFork as e:
    print(f"Invalid resource fork: {e}")
except IOError as e:
    print(f"IO error: {e}")
```

### With Result Type (TypeScript)

```typescript
const loadResult = await load(path);
if (!isOk(loadResult)) {
  console.error('Failed to load:', loadResult.error);
  return;
}

const jsonResult = await saveToJson(loadResult.value);
if (!isOk(jsonResult)) {
  console.error('Failed to convert:', jsonResult.error);
  return;
}

// Continue with success path...
```

## Why Not Exceptions?

While exceptions are useful for truly exceptional circumstances (programming errors, system failures), using them for control flow has several drawbacks:

1. **Hidden Control Flow**: It's not obvious which functions can throw and what types of errors they throw
2. **Easy to Forget**: You can call a function that throws without wrapping it in try/catch
3. **Poor Composability**: Combining multiple operations that throw requires nested try/catch blocks
4. **Type System Limitations**: TypeScript doesn't track what exceptions a function can throw

The Result type makes all of this explicit and type-safe.

## Best Practices

1. **Always check Results**: Never assume a Result is Ok without checking
2. **Propagate Errors**: If you can't handle an error, return it to the caller
3. **Use Type Guards**: TypeScript's type narrowing works perfectly with `isOk()`
4. **Descriptive Errors**: Return clear, actionable error messages
5. **Avoid `unwrap()` in Library Code**: Only use it in application code where you want to crash on errors

## Examples from rsrcdump-ts

### Resource Fork Loading

```typescript
export async function load(pathOrData: string | Uint8Array): Promise<Result<ResourceFork, string>> {
  let data: Uint8Array;

  if (typeof pathOrData === 'string') {
    try {
      const buffer = await readFile(pathOrData);
      data = new Uint8Array(buffer);
    } catch (e) {
      return err(`Failed to read file: ${e}`);
    }
  } else {
    data = pathOrData;
  }

  // Try to unpack as ADF first
  const adfResult = unpackAdf(data);
  if (isOk(adfResult)) {
    const entries = adfResult.value;
    const resforkData = entries.get(ADF_ENTRYNUM_RESOURCEFORK);
    if (resforkData) {
      return resourceForkFromBytes(resforkData);
    }
  }

  // Fall back to raw resource fork
  return resourceForkFromBytes(data);
}
```

### AppleDouble Unpacking

```typescript
export function unpackAdf(adfData: Uint8Array): Result<Map<number, Uint8Array>, string> {
  try {
    const u = new Unpacker(adfData);
    const header = u.unpack('>LL16sH');
    // ... unpacking logic ...
    return ok(entries);
  } catch (e) {
    return err(`Not ADF: ${e}`);
  }
}
```

This pattern ensures that all errors are handled explicitly and type-safely throughout the codebase.
