# Contributing to rsrcdump-ts

Thank you for your interest in contributing! This TypeScript port maintains strict quality standards.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/LachlanBWWright/rsrcdump.git
cd rsrcdump/rsrcdump-ts

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Code Standards

### TypeScript Configuration

This project uses strict TypeScript settings:

- `strict`: true
- `noUncheckedIndexedAccess`: true (prevents unsafe index access)
- `noUnusedLocals`: true
- `noUnusedParameters`: true
- `noImplicitReturns`: true
- `noFallthroughCasesInSwitch`: true

All code must compile without errors or warnings.

### Error Handling

**DO NOT use exceptions for control flow!**

✅ **Correct:**
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return err('Division by zero');
  }
  return ok(a / b);
}
```

❌ **Incorrect:**
```typescript
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

Use the `Result<T, E>` type for all operations that can fail.

### Coding Style

- Use TypeScript's type inference where possible
- Avoid `any` types
- Use `const` over `let` when possible
- Prefer functional patterns over imperative
- Use descriptive variable names
- Add JSDoc comments to public APIs

### File Structure

Follow the existing structure:

```
src/
  ├── result.ts         # Result/Err type definitions
  ├── textio.ts         # Text encoding utilities
  ├── packutils.ts      # Binary pack/unpack
  ├── resfork.ts        # Resource fork structures
  ├── adf.ts            # AppleDouble format
  ├── structtemplate.ts # Struct template parsing
  ├── resconverters.ts  # Resource converters
  ├── jsonio.ts         # JSON I/O
  ├── cli.ts            # CLI interface
  └── index.ts          # Public API
```

## Testing

### Writing Tests

All new features must include tests. Use Vitest:

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './mymodule.js';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Test Categories

1. **Unit Tests**: Test individual functions
2. **Integration Tests**: Test module interactions
3. **Round-trip Tests**: Verify data integrity
4. **Performance Tests**: Ensure reasonable performance

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test resfork

# Run tests in watch mode
npm run test:watch
```

## Pull Request Process

1. **Create a branch**: `git checkout -b feature/my-feature`
2. **Write code**: Follow the standards above
3. **Write tests**: Ensure >90% coverage
4. **Run tests**: `npm test` must pass
5. **Build**: `npm run build` must succeed
6. **Update docs**: If you changed APIs
7. **Commit**: Use clear commit messages
8. **Push**: `git push origin feature/my-feature`
9. **Create PR**: Include description and test results

### Commit Messages

Use clear, descriptive commit messages:

```
✅ Good:
- Add support for compressed resources
- Fix struct template parsing for edge cases
- Improve performance of large file loading

❌ Bad:
- Fix bug
- Update code
- WIP
```

## Result Type Guidelines

When adding new functions:

1. **Return Results for fallible operations**
   ```typescript
   function readFile(path: string): Result<Uint8Array, string> { ... }
   ```

2. **Check Results before using values**
   ```typescript
   const result = readFile(path);
   if (isOk(result)) {
     const data = result.value;
     // Use data...
   }
   ```

3. **Propagate errors**
   ```typescript
   function process(path: string): Result<Output, string> {
     const readResult = readFile(path);
     if (!isOk(readResult)) {
       return readResult; // Propagate error
     }
     // Continue processing...
   }
   ```

## Documentation

### Code Comments

Add comments for:
- Complex algorithms
- Non-obvious behavior
- Public APIs (use JSDoc)

```typescript
/**
 * Parses a resource fork from binary data.
 * 
 * @param data - The binary data to parse
 * @returns A Result containing the parsed ResourceFork or an error message
 */
export function resourceForkFromBytes(data: Uint8Array): Result<ResourceFork, string> {
  // Implementation...
}
```

### Documentation Files

Update relevant docs when making changes:
- `README.md` - Usage examples
- `RESULT_TYPE.md` - Error handling patterns
- `MIGRATION.md` - Migration guides
- `VERIFICATION.md` - Verification details

## Performance Considerations

- Avoid unnecessary array copies
- Use `Map` for O(1) lookups
- Profile before optimizing
- Test performance impact of changes

## Compatibility

This project targets:
- Node.js 18+
- ES2022
- TypeScript 5.8+

Ensure your changes work on these platforms.

## Questions?

If you have questions:
1. Check existing documentation
2. Look at existing code for examples
3. Open an issue for discussion

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
