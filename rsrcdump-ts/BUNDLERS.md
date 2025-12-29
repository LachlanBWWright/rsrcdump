# Bundler Configuration Examples

Examples of how to configure various bundlers to use rsrcdump-ts in browser applications.

## Webpack

No special configuration needed! The package works out of the box with Webpack 5+.

### Basic webpack.config.js

```javascript
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
};
```

### With Code Splitting

```javascript
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        rsrcdump: {
          test: /[\\/]node_modules[\\/]@lachlanwright[\\/]rsrcdump-ts/,
          name: 'rsrcdump',
          priority: 10,
        },
      },
    },
  },
};
```

## Vite

No special configuration needed! Works perfectly with Vite's default settings.

### vite.config.ts

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
  },
});
```

### With React

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
  },
});
```

## Rollup

```javascript
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    resolve({
      browser: true,
    }),
    typescript(),
    terser(),
  ],
};
```

## Parcel

No configuration needed! Just import and use.

### package.json

```json
{
  "source": "src/index.html",
  "scripts": {
    "start": "parcel",
    "build": "parcel build"
  }
}
```

## esbuild

```javascript
import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  target: ['es2020'],
  outfile: 'dist/bundle.js',
  format: 'esm',
  platform: 'browser',
});
```

## Next.js

Works out of the box with Next.js 13+.

### Using in Client Components

```tsx
'use client';

import { useState } from 'react';
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

export function ResourceViewer() {
  const [result, setResult] = useState<string>('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const parseResult = load(data);
    if (isOk(parseResult)) {
      setResult(`Loaded ${parseResult.value.tree.size} resource types`);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFile} />
      <p>{result}</p>
    </div>
  );
}
```

### Dynamic Import (for SSR)

If you need to avoid server-side rendering issues:

```tsx
'use client';

import { useState, useEffect } from 'react';

export function ResourceViewer() {
  const [rsrcdump, setRsrcdump] = useState<any>(null);

  useEffect(() => {
    import('@lachlanwright/rsrcdump-ts').then(setRsrcdump);
  }, []);

  if (!rsrcdump) return <div>Loading...</div>;

  // Use rsrcdump here...
}
```

## Create React App

Works out of the box with CRA.

### src/App.tsx

```tsx
import { useState } from 'react';
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

function App() {
  const [result, setResult] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const parseResult = load(data);
    if (isOk(parseResult)) {
      setResult(`Loaded ${parseResult.value.tree.size} resource types`);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFile} />
      <p>{result}</p>
    </div>
  );
}

export default App;
```

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

## Bundle Size Optimization

### Tree Shaking

The package is fully tree-shakable. Only import what you need:

```typescript
// Good - only imports what you need
import { load, isOk } from '@lachlanwright/rsrcdump-ts';

// Less optimal - imports everything
import * as rsrcdump from '@lachlanwright/rsrcdump-ts';
```

### Code Splitting

Split rsrcdump-ts into a separate chunk for better caching:

```javascript
// webpack.config.js
optimization: {
  splitChunks: {
    cacheGroups: {
      rsrcdump: {
        test: /[\\/]node_modules[\\/]@lachlanwright[\\/]rsrcdump-ts/,
        name: 'rsrcdump',
        chunks: 'all',
      },
    },
  },
}
```

### Dynamic Import

Load rsrcdump-ts only when needed:

```typescript
async function loadResourceFork(data: Uint8Array) {
  const { load, isOk } = await import('@lachlanwright/rsrcdump-ts');
  const result = load(data);
  return result;
}
```

## Testing with Bundlers

### Jest (with jsdom)

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
```

### Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
});
```

## Common Issues

### Issue: "Cannot find module"

**Solution**: Make sure you have the correct import path:

```typescript
// Correct
import { load } from '@lachlanwright/rsrcdump-ts';

// Wrong
import { load } from '@lachlanwright/rsrcdump-ts/dist/index';
```

### Issue: "Unexpected token 'export'"

**Solution**: Configure your bundler to handle ES modules:

```javascript
// webpack.config.js
module: {
  rules: [
    {
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    },
  ],
}
```

### Issue: Bundle size too large

**Solution**: Use tree shaking and code splitting (see above).

## Browser Compatibility Table

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| ES2020 | 80+ | 75+ | 13.1+ | 80+ |
| BigInt | 67+ | 68+ | 14+ | 79+ |
| Dynamic Import | 63+ | 67+ | 11.1+ | 79+ |
| File API | Yes | Yes | Yes | Yes |

## Resources

- [Webpack Documentation](https://webpack.js.org/)
- [Vite Documentation](https://vitejs.dev/)
- [Rollup Documentation](https://rollupjs.org/)
- [esbuild Documentation](https://esbuild.github.io/)
