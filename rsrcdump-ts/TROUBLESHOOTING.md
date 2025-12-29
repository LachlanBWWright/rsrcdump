# Troubleshooting Guide

Common issues and solutions when using rsrcdump-ts.

## Installation Issues

### NPM Install Fails

**Error**: `npm ERR! 404 Not Found - GET https://registry.npmjs.org/@lachlanwright/rsrcdump-ts`

**Solution**: The package may not be published yet. Install from GitHub:
```bash
npm install github:LachlanBWWright/rsrcdump#main:rsrcdump-ts
```

### TypeScript Compilation Errors

**Error**: `error TS2307: Cannot find module '@lachlanwright/rsrcdump-ts'`

**Solution 1**: Make sure `@types/node` is installed:
```bash
npm install --save-dev @types/node
```

**Solution 2**: Check your `tsconfig.json`:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "esModuleInterop": true
  }
}
```

## Runtime Issues

### "Cannot find module" in Browser

**Error**: Browser console shows module not found errors

**Solution**: Check your bundler configuration. The package uses ESM format:

```javascript
// webpack.config.js
resolve: {
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  mainFields: ['browser', 'module', 'main'],
}
```

### "Unexpected token" Errors

**Error**: `SyntaxError: Unexpected token 'export'`

**Solution**: Your bundler isn't transpiling the package. Configure it to process node_modules:

```javascript
// webpack.config.js
module: {
  rules: [
    {
      test: /\.js$/,
      include: /node_modules\/@lachlanwright/,
      use: 'babel-loader'
    }
  ]
}
```

### File Reading Fails in Browser

**Error**: `Error: fs module not available`

**Solution**: You can't use file paths in browser. Load files using File API:

```typescript
// ❌ Wrong - doesn't work in browser
const result = await load('/path/to/file.rsrc');

// ✅ Correct - works everywhere
const fileData = await file.arrayBuffer();
const result = load(new Uint8Array(fileData));
```

## Parsing Issues

### "Invalid resource fork" Error

**Error**: `Error: Invalid resource fork: ...`

**Possible causes and solutions:**

1. **File is not a resource fork**
   ```typescript
   // Check file extension
   if (!file.name.endsWith('.rsrc') && !file.name.endsWith('.adf')) {
     console.warn('File may not be a resource fork');
   }
   ```

2. **File is corrupted**
   ```typescript
   // Check file size
   if (data.length < 16) {
     console.error('File too small to be a valid resource fork');
   }
   ```

3. **File is actually an AppleDouble format**
   ```typescript
   // The library handles this automatically, but you can check:
   const hasAdfMagic = (
     data[0] === 0x00 &&
     data[1] === 0x05 &&
     data[2] === 0x16 &&
     data[3] === 0x07
   );
   ```

### "Conversion error" in JSON Output

**Symptom**: Resources show `conversion_error` field in JSON

**Cause**: Struct template parsing failed for that resource

**Solutions:**

1. **Check struct spec syntax**:
   ```typescript
   // Wrong
   const specs = ['>HHH,x,y,z'];  // Missing colon
   
   // Correct
   const specs = ['>HHH:x,y,z'];
   ```

2. **Check field count matches data**:
   ```typescript
   // If you have 3 shorts but spec says 2, it will fail
   const specs = ['>HH:x,y'];  // Expects 4 bytes
   // But resource has 6 bytes - mismatch!
   ```

3. **Use base16 fallback**:
   ```typescript
   // The library automatically falls back to base16 (hex)
   // when struct parsing fails, so you'll still get the data
   if (resource.conversion_error) {
     console.log('Struct failed, using hex:', resource.data);
   }
   ```

### Struct Template Parsing Fails

**Error**: Struct template returns error

**Common mistakes:**

1. **Missing colon**:
   ```typescript
   // Wrong
   '>HHH field1,field2,field3'
   
   // Correct
   '>HHH:field1,field2,field3'
   ```

2. **Wrong endianness character**:
   ```typescript
   // Wrong
   'BHH:x,y,z'  // B is not valid
   
   // Correct
   '>HHH:x,y,z'  // > for big-endian
   '<HHH:x,y,z'  // < for little-endian
   ```

3. **Unsupported format character**:
   ```typescript
   // Wrong
   '>A:field'  // A is not supported
   
   // Correct
   '>H:field'  // H for short, see docs for full list
   ```

## Performance Issues

### Slow Parsing in Browser

**Symptom**: Takes several seconds to parse large files

**Solutions:**

1. **Use Web Workers**:
   ```typescript
   // worker.ts
   import { load } from '@lachlanwright/rsrcdump-ts';
   
   self.onmessage = (e) => {
     const result = load(e.data);
     self.postMessage(result);
   };
   
   // main.ts
   const worker = new Worker('/worker.js');
   worker.postMessage(fileData);
   ```

2. **Process in chunks**:
   ```typescript
   // For very large files, read in chunks
   const chunkSize = 1024 * 1024; // 1MB chunks
   const chunks = [];
   for (let i = 0; i < file.size; i += chunkSize) {
     const chunk = await file.slice(i, i + chunkSize).arrayBuffer();
     chunks.push(new Uint8Array(chunk));
   }
   ```

3. **Cache parsed results**:
   ```typescript
   const cache = new Map<string, ResourceFork>();
   const key = `${file.name}-${file.size}`;
   if (cache.has(key)) {
     return cache.get(key);
   }
   ```

### High Memory Usage

**Symptom**: Browser tab uses too much memory

**Solutions:**

1. **Process and discard**:
   ```typescript
   // Don't keep everything in memory
   const result = load(data);
   if (isOk(result)) {
     processResourceFork(result.value);
     // Result goes out of scope and is garbage collected
   }
   ```

2. **Extract only what you need**:
   ```typescript
   // Filter by resource type
   const jsonResult = await saveToJson(
     data,
     [],
     ['Hedr', 'Itms'],  // Only these types
     []
   );
   ```

3. **Use streaming JSON**:
   ```typescript
   // For very large JSON output, consider streaming
   // or processing resources one at a time
   for (const [typeKey, typeMap] of fork.tree) {
     for (const [resId, resource] of typeMap) {
       processResource(resource);
       // Each resource is processed and can be GC'd
     }
   }
   ```

## Type Issues

### TypeScript Can't Infer Types

**Error**: `Type 'unknown' is not assignable to type 'ResourceFork'`

**Solution**: Use type guards:

```typescript
import { isOk, type Result, type ResourceFork } from '@lachlanwright/rsrcdump-ts';

const result = load(data);
if (isOk(result)) {
  // TypeScript knows result.value is ResourceFork here
  const fork: ResourceFork = result.value;
}
```

### "Possibly undefined" Errors

**Error**: `Object is possibly 'undefined'`

**Cause**: `noUncheckedIndexedAccess` is enabled (which is good!)

**Solution**: Use proper null checks:

```typescript
// ❌ Wrong - may be undefined
const typeMap = fork.tree.get(typeKey)!;

// ✅ Correct - handle undefined case
const typeMap = fork.tree.get(typeKey);
if (!typeMap) {
  console.error('Type not found');
  return;
}
```

## Integration Issues

### React Hook Errors

**Error**: `React Hook "useEffect" is called conditionally`

**Solution**: Make sure hooks are called unconditionally:

```typescript
// ❌ Wrong
if (file) {
  useEffect(() => {
    loadFile(file);
  }, [file]);
}

// ✅ Correct
useEffect(() => {
  if (file) {
    loadFile(file);
  }
}, [file]);
```

### Vue Reactivity Issues

**Symptom**: UI doesn't update when resource fork changes

**Solution**: Use reactive references:

```typescript
import { ref } from 'vue';

// ❌ Wrong
let fork = null;

// ✅ Correct
const fork = ref<ResourceFork | null>(null);
fork.value = result.value;  // Triggers reactivity
```

### Next.js SSR Errors

**Error**: `ReferenceError: FileReader is not defined`

**Solution**: Wrap in client-side check:

```typescript
'use client';  // Mark as client component

import { useState, useEffect } from 'react';

export function ResourceViewer() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) return null;
  
  // Use rsrcdump-ts here
}
```

## Build Issues

### Bundle Size Too Large

**Symptom**: Bundle includes unnecessary code

**Solutions:**

1. **Enable tree shaking**:
   ```javascript
   // webpack.config.js
   optimization: {
     usedExports: true,
     sideEffects: false,
   }
   ```

2. **Import only what you need**:
   ```typescript
   // ❌ Wrong - imports everything
   import * as rsrcdump from '@lachlanwright/rsrcdump-ts';
   
   // ✅ Correct - imports only what you use
   import { load, isOk } from '@lachlanwright/rsrcdump-ts';
   ```

3. **Use dynamic imports**:
   ```typescript
   // Load only when needed
   const handleFile = async (file: File) => {
     const { load, isOk } = await import('@lachlanwright/rsrcdump-ts');
     // Use here
   };
   ```

### TypeScript Declaration Errors

**Error**: `.d.ts` file errors during build

**Solution**: Make sure `skipLibCheck` is enabled:

```json
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

## Testing Issues

### Jest/Vitest Can't Import Package

**Error**: `Cannot use import statement outside a module`

**Solution**: Configure test environment:

```javascript
// vitest.config.ts
export default {
  test: {
    environment: 'jsdom',
    transformMode: {
      web: [/\.[jt]sx?$/]
    }
  }
};
```

### Tests Fail with File I/O

**Error**: Tests can't read files

**Solution**: Tests need to use Node.js fs, not the library's load function with paths:

```typescript
import { readFile } from 'fs/promises';
import { load } from '@lachlanwright/rsrcdump-ts';

test('loads resource fork', async () => {
  const fileData = await readFile('test.rsrc');
  const result = load(new Uint8Array(fileData));
  expect(isOk(result)).toBe(true);
});
```

## Getting Help

If you're still stuck:

1. **Check the examples**: See `examples/` directory
2. **Read the docs**: Check [API.md](./API.md) and [BROWSER.md](./BROWSER.md)
3. **Open an issue**: [GitHub Issues](https://github.com/LachlanBWWright/rsrcdump/issues)
4. **Compare with Python**: See [PYTHON_VS_TS.md](./PYTHON_VS_TS.md)

## Common Gotchas

### 1. Forgetting to Check Results

```typescript
// ❌ Wrong - crashes if error
const fork = load(data).value;

// ✅ Correct - handles errors
const result = load(data);
if (!isOk(result)) {
  console.error(result.error);
  return;
}
const fork = result.value;
```

### 2. Using File Paths in Browser

```typescript
// ❌ Wrong - doesn't work in browser
const result = load('/path/to/file.rsrc');

// ✅ Correct - works everywhere
const fileData = await file.arrayBuffer();
const result = load(new Uint8Array(fileData));
```

### 3. Mixing Sync and Async

```typescript
// ❌ Wrong - load is sync, saveToJson is async
const fork = await load(data);  // Unnecessary await

// ✅ Correct
const fork = load(data);  // Sync
const json = await saveToJson(data);  // Async
```

### 4. Not Handling Empty Resource Forks

```typescript
// ❌ Wrong - assumes resources exist
const firstType = Array.from(fork.tree.values())[0];
const firstResource = Array.from(firstType.values())[0];

// ✅ Correct - checks for empty
if (fork.tree.size === 0) {
  console.log('No resources found');
  return;
}
```

### 5. Ignoring conversion_error

```typescript
// ❌ Wrong - ignores failed conversions
const value = resource.obj;

// ✅ Correct - checks for errors
if (resource.conversion_error) {
  console.warn('Struct parsing failed:', resource.conversion_error);
  console.log('Using hex data instead:', resource.data);
} else {
  const value = resource.obj;
}
```
