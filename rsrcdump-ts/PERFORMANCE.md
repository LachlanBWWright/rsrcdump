# Performance Optimization Guide

Tips and techniques for optimizing rsrcdump-ts performance in your applications.

## Benchmarks

Tested on EarthFarm.ter.rsrc (159 KB, 162 resources):

| Operation | Time | Details |
|-----------|------|---------|
| **Load** | 3-8ms | Parse binary resource fork |
| **JSON Export** | 18-29ms | Convert to JSON string |
| **JSON Import** | 15-25ms | Parse JSON back to fork |
| **Round-trip** | 38-54ms | Binary → JSON → Binary |
| **Type Generation** | <1ms | Generate TypeScript types |

## General Optimization Tips

### 1. Use Synchronous Operations When Possible

```typescript
// ✅ Fast - synchronous
const result = load(data);

// ❌ Slower - unnecessary async
const result = await load(data);  // Don't await sync functions
```

### 2. Filter Resource Types Early

```typescript
// ✅ Efficient - only process needed types
const result = await saveToJson(
  data,
  [],
  ['Hedr', 'Itms'],  // Include only these
  ['alis', 'Fenc']   // Exclude these
);

// ❌ Inefficient - processes everything
const result = await saveToJson(data);
```

### 3. Reuse Converters

```typescript
// ✅ Efficient - reuse converter map
const converters = await getConverters(structSpecs);

for (const file of files) {
  const result = await saveToJson(file, [], [], [], converters);
}

// ❌ Inefficient - recreates converters each time
for (const file of files) {
  const result = await saveToJson(file, structSpecs);
}
```

### 4. Cache Parsed Results

```typescript
const cache = new Map<string, ResourceFork>();

function loadWithCache(data: Uint8Array, key: string) {
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  
  const result = load(data);
  if (isOk(result)) {
    cache.set(key, result.value);
  }
  return result;
}
```

## Browser-Specific Optimizations

### 1. Use Web Workers for Large Files

```typescript
// worker.ts
import { load, saveToJson, isOk } from '@lachlanwright/rsrcdump-ts';

self.onmessage = async (e) => {
  const { data, structSpecs } = e.data;
  
  const loadResult = load(data);
  if (!isOk(loadResult)) {
    self.postMessage({ error: loadResult.error });
    return;
  }
  
  const jsonResult = await saveToJson(data, structSpecs);
  if (isOk(jsonResult)) {
    self.postMessage({ json: jsonResult.value });
  }
};

// main.ts
const worker = new Worker('/worker.js');

worker.onmessage = (e) => {
  if (e.data.error) {
    console.error(e.data.error);
  } else {
    console.log('JSON:', e.data.json);
  }
};

// Send data to worker (non-blocking)
worker.postMessage({ data: fileData, structSpecs: [] });
```

### 2. Stream Large Files

```typescript
async function streamLargeFile(file: File, chunkSize = 1024 * 1024) {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < file.size) {
    // Read chunk
    const blob = file.slice(offset, offset + chunkSize);
    const arrayBuffer = await blob.arrayBuffer();
    chunks.push(new Uint8Array(arrayBuffer));
    offset += chunkSize;
    
    // Update progress
    const progress = (offset / file.size) * 100;
    updateProgressBar(progress);
  }

  // Combine chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }

  return combined;
}
```

### 3. Lazy Load the Library

```typescript
// Load library only when needed
async function handleFileSelection(file: File) {
  // Show loading indicator
  showLoading();
  
  // Dynamic import
  const { load, isOk } = await import('@lachlanwright/rsrcdump-ts');
  
  const arrayBuffer = await file.arrayBuffer();
  const result = load(new Uint8Array(arrayBuffer));
  
  hideLoading();
  
  if (isOk(result)) {
    displayResults(result.value);
  }
}
```

### 4. Use RequestIdleCallback for Non-Critical Operations

```typescript
function processResourcesIdle(fork: ResourceFork) {
  const resources = getAllResources(fork);
  let index = 0;

  function processChunk() {
    const deadline = performance.now() + 50; // 50ms chunks
    
    while (index < resources.length && performance.now() < deadline) {
      const resource = resources[index];
      processResource(resource);
      index++;
    }

    if (index < resources.length) {
      requestIdleCallback(processChunk);
    }
  }

  requestIdleCallback(processChunk);
}
```

### 5. Optimize Rendering

```typescript
// ❌ Slow - renders all resources at once
function renderAll(fork: ResourceFork) {
  for (const [typeKey, typeMap] of fork.tree) {
    for (const [resId, resource] of typeMap) {
      renderResource(resource);
    }
  }
}

// ✅ Fast - virtual scrolling
function renderVirtualized(fork: ResourceFork, viewport: Viewport) {
  const visible = getVisibleResources(fork, viewport);
  for (const resource of visible) {
    renderResource(resource);
  }
}
```

## Node.js-Specific Optimizations

### 1. Use Streams for File I/O

```typescript
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

async function processFileStream(filePath: string) {
  const chunks: Buffer[] = [];
  
  await pipeline(
    createReadStream(filePath),
    async function* (source) {
      for await (const chunk of source) {
        chunks.push(chunk);
        yield chunk;
      }
    }
  );

  const combined = Buffer.concat(chunks);
  return load(new Uint8Array(combined));
}
```

### 2. Batch Processing

```typescript
async function processBatch(files: string[], batchSize = 10) {
  const results: Result<ResourceFork, string>[] = [];
  
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const data = await readFile(file);
        return load(new Uint8Array(data));
      })
    );
    
    results.push(...batchResults);
    
    // Allow event loop to process other tasks
    await new Promise(resolve => setImmediate(resolve));
  }
  
  return results;
}
```

### 3. Use Worker Threads for CPU-Intensive Tasks

```typescript
import { Worker } from 'worker_threads';

function parseInWorker(data: Uint8Array): Promise<ResourceFork> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./parser-worker.js');
    
    worker.on('message', (result) => {
      if (isOk(result)) {
        resolve(result.value);
      } else {
        reject(new Error(result.error));
      }
      worker.terminate();
    });
    
    worker.on('error', reject);
    worker.postMessage(data);
  });
}
```

## Memory Optimization

### 1. Process and Discard

```typescript
// ❌ Bad - keeps everything in memory
const forks: ResourceFork[] = [];
for (const file of files) {
  const result = load(await readFile(file));
  if (isOk(result)) {
    forks.push(result.value);
  }
}

// ✅ Good - processes and discards
for (const file of files) {
  const data = await readFile(file);
  const result = load(new Uint8Array(data));
  
  if (isOk(result)) {
    await processAndSave(result.value);
    // result goes out of scope and is GC'd
  }
}
```

### 2. Use WeakMap for Caching

```typescript
const cache = new WeakMap<Uint8Array, ResourceFork>();

function loadWithWeakCache(data: Uint8Array) {
  const cached = cache.get(data);
  if (cached) return ok(cached);
  
  const result = load(data);
  if (isOk(result)) {
    cache.set(data, result.value);
  }
  return result;
}
// Cache entries are automatically cleaned up when data is GC'd
```

### 3. Extract Only Needed Data

```typescript
// ❌ Bad - loads entire fork
const result = load(data);
if (isOk(result)) {
  const hedrType = result.value.tree.get(hedrKey);
  const hedr1000 = hedrType?.get(1000);
  // Use only hedr1000, but entire fork stays in memory
}

// ✅ Better - extract and release
const result = load(data);
if (isOk(result)) {
  const hedrType = result.value.tree.get(hedrKey);
  const hedr1000Data = hedrType?.get(1000)?.data;
  if (hedr1000Data) {
    processHeader(new Uint8Array(hedr1000Data));
  }
  // fork can be GC'd after this scope
}
```

## Struct Template Optimization

### 1. Precompile Templates

```typescript
// ❌ Slow - parses template each time
for (const resource of resources) {
  const template = structTemplateFromString('>HHH:x,y,z');
  unpackRecord(template.value, resource.data);
}

// ✅ Fast - parses once
const templateResult = structTemplateFromString('>HHH:x,y,z');
if (isOk(templateResult)) {
  const template = templateResult.value;
  for (const resource of resources) {
    unpackRecord(template, resource.data);
  }
}
```

### 2. Use Simple Templates When Possible

```typescript
// ❌ Slower - complex template
'>HHH:field1,field2,field3'

// ✅ Faster - unnamed fields (if you don't need names)
'>HHH'
```

### 3. Avoid Repeated Conversions

```typescript
// ❌ Slow - converts multiple times
const json1 = await saveToJson(data, specs);
const json2 = await saveToJson(data, specs);  // Reprocesses everything

// ✅ Fast - convert once, reuse
const jsonResult = await saveToJson(data, specs);
if (isOk(jsonResult)) {
  const json = jsonResult.value;
  // Use json multiple times
}
```

## Bundler Optimization

### 1. Enable Tree Shaking

```javascript
// webpack.config.js
optimization: {
  usedExports: true,
  sideEffects: false,
}
```

### 2. Code Splitting

```typescript
// Lazy load rsrcdump-ts
const ResourceViewer = lazy(() => import('./ResourceViewer'));

// In ResourceViewer.tsx
import { load, isOk } from '@lachlanwright/rsrcdump-ts';
```

### 3. Minimize Bundle Size

```javascript
// webpack.config.js
optimization: {
  minimize: true,
  minimizer: [new TerserPlugin({
    terserOptions: {
      compress: {
        drop_console: true,  // Remove console.logs in production
      }
    }
  })],
}
```

## Measuring Performance

### 1. Browser DevTools

```typescript
console.time('parse');
const result = load(data);
console.timeEnd('parse');  // Logs: parse: 5.234ms

console.time('json');
const json = await saveToJson(data);
console.timeEnd('json');  // Logs: json: 23.456ms
```

### 2. Performance API

```typescript
const t0 = performance.now();
const result = load(data);
const t1 = performance.now();
console.log(`Parse took ${(t1 - t0).toFixed(2)}ms`);
```

### 3. Memory Profiling

```typescript
// Node.js
const before = process.memoryUsage();
const result = load(data);
const after = process.memoryUsage();

console.log('Heap used:', (after.heapUsed - before.heapUsed) / 1024 / 1024, 'MB');
```

## Performance Checklist

Before deploying:

- [ ] Profile with realistic data sizes
- [ ] Test with largest expected files
- [ ] Monitor memory usage
- [ ] Use Web Workers for large files (browser)
- [ ] Enable tree shaking
- [ ] Implement code splitting
- [ ] Cache parsed results when appropriate
- [ ] Filter unnecessary resource types
- [ ] Use lazy loading for library import
- [ ] Implement virtual scrolling for large lists
- [ ] Add loading indicators for long operations
- [ ] Set reasonable size limits
- [ ] Test on slower devices

## Common Performance Pitfalls

1. **Not filtering resource types** - Processes everything even if only a few types needed
2. **Parsing templates repeatedly** - Compile once, use many times
3. **Keeping all data in memory** - Process and discard when possible
4. **Blocking main thread** - Use Web Workers for large files
5. **No lazy loading** - Loads entire library even if not needed
6. **Missing caching** - Reparses same files multiple times
7. **Inefficient rendering** - Renders all resources instead of visible ones
8. **No progress indicators** - Users don't know processing is happening

## Performance Goals

Reasonable targets for different operations:

| Operation | Target | Notes |
|-----------|--------|-------|
| Small files (<100 KB) | <10ms | Should be instant |
| Medium files (1-10 MB) | <100ms | Acceptable with indicator |
| Large files (>10 MB) | Use Web Worker | Non-blocking |
| JSON export | <50ms per MB | Depends on complexity |
| Type generation | <5ms | Very fast |

## Getting Help

If you're experiencing performance issues:

1. Profile with browser DevTools or Node.js profiler
2. Check file sizes and resource counts
3. Verify you're following optimization tips
4. Open an issue with profiling data

---

Last updated: December 29, 2025
