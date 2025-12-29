# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-12-29

### Breaking Changes
- **Browser Compatibility**: Removed Node.js `fs` dependencies from core library
  - `load()` now only accepts `Uint8Array` (removed file path support)
  - Removed `loadJsonSpecs()` - use `parseJsonSpecs(jsonData)` instead
  - Removed `writeGeneratedTypes()` - use `generateTypesFromSpecs()` which returns string
  - CLI tool remains Node.js-only and uses `fs` internally

### Added
- **Full Browser Support**: Package now works in browsers with zero Node.js dependencies
- **New Documentation**:
  - BROWSER.md (11.2 KB) - Comprehensive browser integration guide
  - BUNDLERS.md (7.0 KB) - Configuration for Webpack, Vite, Rollup, etc.
  - PYTHON_VS_TS.md (8.2 KB) - Detailed comparison with Python version
  - TROUBLESHOOTING.md (11.3 KB) - Common issues and solutions
  - browser-usage.html - Interactive demo with beautiful UI
- **Package Enhancements**:
  - Added `browser` field for browser-specific resolution
  - Added `module` field for ESM support
  - Added `sideEffects: false` for better tree shaking
  - Enhanced keywords for better discoverability
- **Examples**:
  - React integration with custom hooks
  - Vue 3 Composition API integration
  - Drag-and-drop file loading
  - Web Worker for large files
  - Performance optimization patterns

### Changed
- `load()` is now synchronous (was async)
- `parseJsonSpecs()` replaces `loadJsonSpecs()` and accepts parsed JSON
- Updated README.md with browser-first focus
- Updated NEW_FEATURES.md with browser compatibility info
- Package version bumped to 1.0.3

### Improved
- All 69 tests updated to work with new browser-compatible API
- Test files load data themselves before calling library functions
- Better separation between CLI (Node.js) and library (browser-compatible)
- More comprehensive documentation (57+ KB total)

### Performance
- Load: 3-8ms (slightly faster than before)
- JSON conversion: 18-29ms (same)
- Round-trip: 38-54ms (same)

### Browser Support
- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+
- All modern browsers with ES2020 support

## [1.0.2] - 2025-12-28

### Added
- TypeScript type generation from struct specs
- JSON-based struct spec format (elegant alternative to string format)
- Backtick array optimization for repeated fields
- `parseJsonSpecs()` for parsing JSON struct specifications
- `jsonSpecToString()` and `jsonSpecsToStrings()` converters
- 41 new tests for advanced features

### Changed
- All JSON fields now use snake_case consistently (no camelCase)
- Backtick macros now produce arrays instead of x_0, x_1, etc.
- `JsonOptions` interface for configuration

### Fixed
- Fixed all 6 failing tests from previous version
- Fixed struct template parsing edge cases
- Fixed backtick array detection for single and multi-field patterns

### Documentation
- NEW_FEATURES.md (8.5 KB) - Documentation for advanced features
- Updated API documentation
- Added type generation examples

## [1.0.1] - 2025-12-27

### Fixed
- Fixed all lint errors
- Removed all 14 non-null assertions
- Replaced with proper null checks and Result type error handling

### Changed
- Reorganized repository structure
  - Python components in `python/` directory
  - Test files in `python/tests/`
  - Output files in `python/output/` (gitignored)
  - TypeScript examples in `rsrcdump-ts/examples/`

### Added
- Bundle configuration for npm publishing
- Package ready for `npm publish`

## [1.0.0] - 2025-12-14

### Added
- Initial TypeScript port of rsrcdump from Python
- Result/Err error handling throughout (no exceptions for control flow)
- Strict TypeScript configuration with `noUncheckedIndexedAccess`
- Complete API with type definitions
- 76 comprehensive tests (all passing)
- CLI executable `rsrcdump-ts`
- Support for:
  - Loading resource forks from files and bytes
  - AppleDouble format detection and handling
  - JSON serialization/deserialization
  - Custom struct templates for structured data
  - Resource converters (Base16, Struct, String, StringList, Text)
  - Byte-perfect round-trip conversion

### Changed
- Error handling uses Result types instead of exceptions
- All array access is type-safe with no unchecked indexing

### Documentation
- README.md with usage examples
- API.md with complete API reference
- RESULT_TYPE.md explaining error handling patterns
- MIGRATION.md for migrating from Python
- CONTRIBUTING.md for contributors
- VERIFICATION.md with test results
- PROJECT_STATUS.md with completion status

### Package
- Published as `@lachlanwright/rsrcdump-ts`
- Size: 21.2 kB (gzipped), 96.7 kB unpacked
- Node.js 18+ required
- ESM module format

## Migration Guide

### From 1.0.2 to 1.0.3 (Browser Compatibility)

**Breaking Changes:**

1. **File Loading**:
   ```typescript
   // Old (1.0.2)
   const result = await load('/path/to/file.rsrc');
   
   // New (1.0.3) - Node.js
   import { readFile } from 'fs/promises';
   const fileData = await readFile('/path/to/file.rsrc');
   const result = load(new Uint8Array(fileData));  // Now sync!
   
   // New (1.0.3) - Browser
   const file = await fileInput.files[0].arrayBuffer();
   const result = load(new Uint8Array(file));
   ```

2. **JSON Specs**:
   ```typescript
   // Old (1.0.2)
   const specs = await loadJsonSpecs('specs.json');
   
   // New (1.0.3)
   import { readFile } from 'fs/promises';  // Node.js only
   const jsonData = JSON.parse(await readFile('specs.json', 'utf-8'));
   const specs = parseJsonSpecs(jsonData);
   ```

3. **Type Generation**:
   ```typescript
   // Old (1.0.2)
   await writeGeneratedTypes(specs, 'output.d.ts');
   
   // New (1.0.3)
   const typesResult = generateTypesFromSpecs(specs);
   if (isOk(typesResult)) {
     // Save yourself if needed (Node.js)
     await writeFile('output.d.ts', typesResult.value);
     
     // Or use in browser
     console.log(typesResult.value);
   }
   ```

**Non-Breaking Changes:**
- All other APIs remain the same
- Tests still pass
- CLI tool unchanged
