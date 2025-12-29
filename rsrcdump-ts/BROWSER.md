# Browser Integration Guide

This guide shows how to use `rsrcdump-ts` in browser applications.

## Table of Contents

- [Overview](#overview)
- [Zero Node.js Dependencies](#zero-nodejs-dependencies)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [File Loading](#file-loading)
- [React Integration](#react-integration)
- [Vue Integration](#vue-integration)
- [Webpack Configuration](#webpack-configuration)
- [Vite Configuration](#vite-configuration)
- [Error Handling](#error-handling)
- [Performance Tips](#performance-tips)

## Overview

`rsrcdump-ts` is fully browser-compatible with **zero Node.js dependencies**. It works with:

- ✅ Modern browsers (ES2020+)
- ✅ React
- ✅ Vue
- ✅ Angular
- ✅ Vanilla JavaScript
- ✅ Webpack
- ✅ Vite
- ✅ Parcel
- ✅ Rollup

## Zero Node.js Dependencies

The core library uses **only browser-compatible APIs**:

- ✅ **No `fs` module** - API accepts `Uint8Array` instead of file paths
- ✅ **No `Buffer` API** - Uses `Uint8Array`, `DataView`, and standard JavaScript
- ✅ **No `path` module** - Path handling done by caller
- ✅ **No `process` global** - Pure JavaScript
- ✅ **No `require()`** - ESM modules only

All binary operations use browser-native:
- `Uint8Array` and `DataView` for binary data
- `TextEncoder` / `TextDecoder` for text encoding
- `String.fromCharCode()` for latin1 encoding

You can verify browser compatibility:
```bash
npm run verify:browser
```

## Installation

```bash
npm install @lachlanwright/rsrcdump-ts
```

## Basic Usage

### Vanilla JavaScript

```html
<input type="file" id="fileInput" accept=".rsrc">
<pre id="output"></pre>

<script type="module">
import { load, saveToJson, isOk } from '@lachlanwright/rsrcdump-ts';

const fileInput = document.getElementById('fileInput');
const output = document.getElementById('output');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Load file as Uint8Array
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  // Parse resource fork
  const result = load(data);
  
  if (isOk(result)) {
    const fork = result.value;
    output.textContent = `Loaded ${fork.tree.size} resource types`;
    
    // Convert to JSON
    const jsonResult = await saveToJson(data);
    if (isOk(jsonResult)) {
      console.log(jsonResult.value);
    }
  } else {
    output.textContent = `Error: ${result.error}`;
  }
});
</script>
```

## File Loading

### Using File Input

```typescript
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const result = load(data);
  if (isOk(result)) {
    const fork = result.value;
    // Use the fork...
  }
}
```

### Using Drag & Drop

```typescript
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

function setupDropZone(element: HTMLElement) {
  element.addEventListener('dragover', (e) => {
    e.preventDefault();
    element.classList.add('drag-over');
  });

  element.addEventListener('dragleave', () => {
    element.classList.remove('drag-over');
  });

  element.addEventListener('drop', async (e) => {
    e.preventDefault();
    element.classList.remove('drag-over');

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const result = load(data);
    if (isOk(result)) {
      console.log('Resource fork loaded:', result.value);
    }
  });
}
```

### Fetching from URL

```typescript
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

async function loadFromUrl(url: string) {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  
  const result = load(data);
  return result;
}

// Usage
const result = await loadFromUrl('/assets/sample.rsrc');
if (isOk(result)) {
  console.log('Loaded from URL:', result.value);
}
```

## React Integration

### Basic Component

```tsx
import React, { useState } from 'react';
import { load, saveToJson, isOk, ResourceFork } from '@lachlanwright/rsrcdump-ts';

export function ResourceViewer() {
  const [fork, setFork] = useState<ResourceFork | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [json, setJson] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const result = load(data);
      
      if (isOk(result)) {
        setFork(result.value);
        setError(null);
        
        // Convert to JSON
        const jsonResult = await saveToJson(data);
        if (isOk(jsonResult)) {
          setJson(jsonResult.value);
        }
      } else {
        setError(result.error);
        setFork(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} accept=".rsrc" />
      
      {error && <div style={{ color: 'red' }}>{error}</div>}
      
      {fork && (
        <div>
          <h3>Resource Fork</h3>
          <p>Resource types: {fork.tree.size}</p>
          <ul>
            {Array.from(fork.tree.entries()).map(([typeKey, typeMap]) => {
              const typeStr = Buffer.from(typeKey, 'binary').toString('latin1');
              return (
                <li key={typeKey}>
                  {typeStr}: {typeMap.size} resources
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {json && (
        <details>
          <summary>JSON Output</summary>
          <pre>{json}</pre>
        </details>
      )}
    </div>
  );
}
```

### Custom Hook

```tsx
import { useState, useCallback } from 'react';
import { load, saveToJson, isOk, type ResourceFork } from '@lachlanwright/rsrcdump-ts';

export function useResourceFork() {
  const [fork, setFork] = useState<ResourceFork | null>(null);
  const [json, setJson] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      
      const result = load(data);
      
      if (isOk(result)) {
        setFork(result.value);
        
        const jsonResult = await saveToJson(data);
        if (isOk(jsonResult)) {
          setJson(jsonResult.value);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  return { fork, json, loading, error, loadFile };
}

// Usage in component
function MyComponent() {
  const { fork, json, loading, error, loadFile } = useResourceFork();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) loadFile(file);
        }}
      />
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {fork && <p>Loaded {fork.tree.size} resource types</p>}
    </div>
  );
}
```

## Vue Integration

```vue
<template>
  <div>
    <input type="file" @change="handleFileChange" accept=".rsrc">
    
    <div v-if="error" class="error">{{ error }}</div>
    
    <div v-if="fork">
      <h3>Resource Fork</h3>
      <p>Resource types: {{ fork.tree.size }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { load, saveToJson, isOk, type ResourceFork } from '@lachlanwright/rsrcdump-ts';

const fork = ref<ResourceFork | null>(null);
const json = ref<string | null>(null);
const error = ref<string | null>(null);

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const result = load(data);
    
    if (isOk(result)) {
      fork.value = result.value;
      error.value = null;
      
      const jsonResult = await saveToJson(data);
      if (isOk(jsonResult)) {
        json.value = jsonResult.value;
      }
    } else {
      error.value = result.error;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error';
  }
}
</script>
```

## Webpack Configuration

No special configuration needed! The package works out of the box with Webpack 5+.

## Vite Configuration

No special configuration needed! The package works out of the box with Vite.

## Error Handling

```typescript
import { load, isOk, isErr } from '@lachlanwright/rsrcdump-ts';

async function safeLoad(file: File) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const result = load(data);
    
    if (isOk(result)) {
      return { success: true, data: result.value };
    } else {
      return { success: false, error: result.error };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}
```

## Performance Tips

### 1. Use Web Workers for Large Files

```typescript
// worker.ts
import { load, saveToJson } from '@lachlanwright/rsrcdump-ts';

self.onmessage = async (e) => {
  const data = e.data;
  
  const result = load(data);
  if (result.ok) {
    const jsonResult = await saveToJson(data);
    self.postMessage({ success: true, json: jsonResult.value });
  } else {
    self.postMessage({ success: false, error: result.error });
  }
};

// main.ts
const worker = new Worker('/worker.js');

worker.onmessage = (e) => {
  if (e.data.success) {
    console.log('JSON:', e.data.json);
  } else {
    console.error('Error:', e.data.error);
  }
};

// Send data to worker
const arrayBuffer = await file.arrayBuffer();
worker.postMessage(new Uint8Array(arrayBuffer));
```

### 2. Stream Large Files

```typescript
async function streamFile(file: File, chunkSize = 1024 * 1024) {
  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < file.size) {
    const chunk = await file.slice(offset, offset + chunkSize).arrayBuffer();
    chunks.push(new Uint8Array(chunk));
    offset += chunkSize;
  }

  // Combine chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const combined = new Uint8Array(totalLength);
  let pos = 0;
  for (const chunk of chunks) {
    combined.set(chunk, pos);
    pos += chunk.length;
  }

  return combined;
}
```

### 3. Cache Parsed Results

```typescript
const cache = new Map<string, ResourceFork>();

async function loadWithCache(file: File) {
  const key = `${file.name}-${file.size}-${file.lastModified}`;
  
  if (cache.has(key)) {
    return cache.get(key)!;
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);
  const result = load(data);
  
  if (isOk(result)) {
    cache.set(key, result.value);
    return result.value;
  }
  
  throw new Error(result.error);
}
```

## Live Demo

See `examples/browser-usage.html` for a complete working example that you can open directly in your browser.

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

All modern browsers with ES2020 support.
