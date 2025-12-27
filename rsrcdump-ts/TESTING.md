# Testing Guide

This document describes the testing approach for rsrcdump-ts.

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### With Coverage
```bash
npm run test:coverage
```

### UI Mode
```bash
npm run test:ui
```

## Test Structure

### Test Files
- `src/rsrcdump.test.ts` - Core functionality tests
- `src/structtemplate.test.ts` - Struct template parsing tests
- `src/performance.test.ts` - Performance benchmarks
- `src/integration.test.ts` - End-to-end integration tests

### Test Organization

```typescript
describe('Feature', () => {
  describe('Subfeature', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

## Test Coverage

Current test coverage includes:

- **Resource Fork Loading**: Loading from files, bytes, AppleDouble format
- **JSON Serialization**: Converting to/from JSON with struct specs
- **Struct Templates**: Parsing, packing, unpacking
- **Error Handling**: Result type error paths
- **Round-trip Conversion**: Byte-perfect conversions
- **Integration**: Full extract-create cycles

### Coverage Goals

- Line coverage: >80%
- Branch coverage: >75%
- Function coverage: >85%

## Writing Tests

### Using Result Types

Always check Result types in tests:

```typescript
const result = await load('file.rsrc');
expect(isOk(result)).toBe(true);

if (!isOk(result)) return; // Type guard

const fork = result.value; // Now TypeScript knows this is safe
```

### Testing Error Paths

Test both success and failure paths:

```typescript
it('should handle invalid input', () => {
  const result = someFunction(invalidInput);
  expect(isOk(result)).toBe(false);
  
  if (!isOk(result)) {
    expect(result.error).toContain('expected error message');
  }
});
```

### Performance Tests

Performance tests use simple timing:

```typescript
it('should load in reasonable time', async () => {
  const start = Date.now();
  const result = await load('file.rsrc');
  const elapsed = Date.now() - start;
  
  expect(isOk(result)).toBe(true);
  expect(elapsed).toBeLessThan(100); // 100ms
});
```

## Integration Tests

Integration tests verify end-to-end workflows:

```typescript
it('should complete full extract-create cycle', async () => {
  // Load original
  const loadResult = await load('file.rsrc');
  expect(isOk(loadResult)).toBe(true);
  
  // Convert to JSON
  const jsonResult = await saveToJson(data);
  expect(isOk(jsonResult)).toBe(true);
  
  // Convert back
  const bytesResult = await loadBytesFromJsonAsync(json);
  expect(isOk(bytesResult)).toBe(true);
  
  // Verify
  const regenResult = await load(bytesResult.value);
  expect(isOk(regenResult)).toBe(true);
  
  // Compare
  expect(regenResult.value.tree.size).toBe(originalSize);
});
```

## Test Data

Test files are located in the repository root:
- `EarthFarm.ter.rsrc` - Sample Otto Matic terrain file
- `sample-specs.txt` - Struct specifications for Otto Matic

## Continuous Integration

Tests run automatically on:
- Every push to main/master
- Every pull request
- Multiple Node.js versions (18.x, 20.x, 21.x)

See `.github/workflows/typescript-ci.yml` for details.

## Best Practices

1. **Test One Thing**: Each test should verify one specific behavior
2. **Use Descriptive Names**: Test names should clearly describe what they test
3. **Arrange-Act-Assert**: Structure tests in three clear phases
4. **Don't Repeat**: Use helper functions for common setup
5. **Test Edge Cases**: Include tests for boundary conditions
6. **Check Results**: Always verify Result types before accessing values
7. **Clean Up**: Remove temporary files created during tests

## Debugging Tests

### Run Single Test
```bash
npx vitest run -t "test name pattern"
```

### Debug in VS Code
Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Vitest Debug",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:watch"],
  "console": "integratedTerminal"
}
```

## Adding New Tests

When adding new features:

1. Write tests first (TDD approach)
2. Test both success and error paths
3. Include edge cases
4. Add integration test if it affects multiple modules
5. Update this guide if introducing new test patterns
