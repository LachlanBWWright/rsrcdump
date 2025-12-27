# Development Guide

Guide for contributing to and developing rsrcdump-ts.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or later
- npm 9.0.0 or later
- Git

### Setup

```bash
git clone https://github.com/LachlanBWWright/rsrcdump.git
cd rsrcdump/rsrcdump-ts
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
npm run test:watch  # Watch mode
npm run test:coverage  # With coverage
```

## Project Structure

```
rsrcdump-ts/
├── src/
│   ├── result.ts           # Result/Err type definitions
│   ├── textio.ts           # Text encoding utilities
│   ├── packutils.ts        # Binary packing/unpacking
│   ├── resfork.ts          # Resource fork structures
│   ├── adf.ts              # AppleDouble format
│   ├── structtemplate.ts   # Struct template parsing
│   ├── resconverters.ts    # Resource converters
│   ├── jsonio.ts           # JSON I/O
│   ├── cli.ts              # CLI interface
│   ├── index.ts            # Public API
│   └── *.test.ts           # Test files
├── build/                  # Compiled output (gitignored)
├── bin/                    # CLI executables
├── examples/               # Usage examples
├── scripts/                # Helper scripts
├── .github/workflows/      # CI/CD workflows
└── docs/                   # Additional documentation
```

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Follow the coding standards below.

### 3. Write Tests

All new code must have tests. See [TESTING.md](TESTING.md).

### 4. Run Verification

```bash
npm run verify  # Runs lint + build + test
```

### 5. Commit

```bash
git add .
git commit -m "feat: add new feature"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `test:` - Test changes
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### 6. Push and Create PR

```bash
git push origin feature/my-feature
```

Then create a Pull Request on GitHub.

## Coding Standards

### TypeScript

- **Strict Mode**: All strict compiler options enabled
- **No `any`**: Avoid `any` types
- **No Non-null Assertions**: Never use `!` operator (use proper checks)
- **Result Types**: All fallible operations return `Result<T, E>`

### Error Handling

❌ **Don't use exceptions:**
```typescript
function divide(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}
```

✅ **Use Result types:**
```typescript
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err('Division by zero');
  return ok(a / b);
}
```

### Null Safety

❌ **Don't use non-null assertions:**
```typescript
const value = array[index]!;
```

✅ **Use proper checks:**
```typescript
const value = array[index];
if (value === undefined) {
  return err('Index out of bounds');
}
// Use value safely
```

### Naming Conventions

- **Functions**: `camelCase`
- **Types/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Files**: `kebab-case.ts` or `camelCase.ts`

### File Organization

1. Imports
2. Type definitions
3. Constants
4. Functions (exported first, then private)
5. Classes (if needed)

Example:
```typescript
import { Result, ok, err } from './result.js';

export interface MyType {
  field: string;
}

const MY_CONSTANT = 42;

export function publicFunction(): Result<MyType, string> {
  // Implementation
}

function privateHelper(): void {
  // Implementation
}
```

## Testing

See [TESTING.md](TESTING.md) for comprehensive testing guide.

### Quick Reference

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run test:ui       # UI mode
```

### Test Requirements

- All new features must have tests
- Test both success and error paths
- Use Result type guards
- Include edge cases
- No console.log (use console.error for debugging)

## Linting

### Run Linter

```bash
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

### ESLint Configuration

Located in `.eslintrc.cjs`. Key rules:
- `@typescript-eslint/no-explicit-any`: error
- `@typescript-eslint/no-unused-vars`: error
- `no-console`: warn (except console.error)

## Building

### Development Build

```bash
npm run build
```

### Watch Mode

```bash
npm run build:watch
```

### Clean Build

```bash
rm -rf build/
npm run build
```

## Package Management

### Testing Package

```bash
npm run pack:test
```

### Local Testing

```bash
# In rsrcdump-ts directory
npm pack

# In another project
npm install /path/to/lachlanwright-rsrcdump-ts-1.0.0.tgz
```

### Publishing

```bash
# Ensure you're logged in
npm login

# Publish
npm publish --access public
```

Or use the automated GitHub Actions workflow by creating a release.

## Debugging

### VS Code

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test:watch"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/src/cli.ts",
      "args": ["list", "../EarthFarm.ter.rsrc"],
      "runtimeArgs": ["--loader", "tsx"],
      "console": "integratedTerminal"
    }
  ]
}
```

### Console Debugging

```typescript
// Temporary debugging (remove before commit)
console.error('Debug:', value);
```

## Performance

### Profiling

```typescript
const start = Date.now();
// ... code to profile ...
console.error(`Elapsed: ${Date.now() - start}ms`);
```

### Performance Tests

Located in `src/performance.test.ts`. Run with:

```bash
npm test performance
```

## Documentation

### Code Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Loads a resource fork from a file or bytes.
 * 
 * @param pathOrData - File path or binary data
 * @returns Result containing ResourceFork or error message
 * 
 * @example
 * ```typescript
 * const result = await load('file.rsrc');
 * if (isOk(result)) {
 *   const fork = result.value;
 * }
 * ```
 */
export async function load(
  pathOrData: string | Uint8Array
): Promise<Result<ResourceFork, string>> {
  // Implementation
}
```

### Updating Documentation

When making changes:
1. Update relevant .md files
2. Update code comments
3. Update examples if API changes
4. Update CHANGELOG.md

## Troubleshooting

### Build Issues

```bash
# Clean and rebuild
rm -rf build/ node_modules/
npm install
npm run build
```

### Test Issues

```bash
# Clear Vitest cache
rm -rf node_modules/.vitest
npm test
```

### Type Issues

```bash
# Check TypeScript compilation
npx tsc --noEmit
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [Conventional Commits](https://www.conventionalcommits.org/)

## Getting Help

- Check existing issues on GitHub
- Review documentation in this repository
- Ask questions in pull request reviews
- Contact maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
