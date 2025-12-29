# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.3   | :white_check_mark: |
| 1.0.2   | :white_check_mark: |
| 1.0.1   | :x:                |
| 1.0.0   | :x:                |

## Security Features

### Browser Safety

rsrcdump-ts is designed with browser security in mind:

- ✅ **No eval()** - No dynamic code execution
- ✅ **No DOM manipulation** - Pure data transformation
- ✅ **No network requests** - Offline-first design
- ✅ **No file system access** - User provides all data
- ✅ **Memory safe** - TypeScript with strict checks
- ✅ **No dependencies** - Zero runtime dependencies

### Input Validation

All input is validated before processing:

```typescript
// Binary data validation
if (data.length < 16) {
  return err('File too small to be a valid resource fork');
}

// Struct template validation
const templateResult = structTemplateFromString(format);
if (!templateResult.ok) {
  return templateResult;  // Error with details
}
```

### Error Handling

No exceptions are used for control flow. All errors are explicit:

```typescript
const result = load(data);
if (!isOk(result)) {
  // Handle error explicitly
  console.error('Parse error:', result.error);
  return;
}
```

### Type Safety

Strict TypeScript configuration prevents common vulnerabilities:

- `noUncheckedIndexedAccess` - No unsafe array access
- `strict` mode enabled - Null/undefined checks enforced
- No `any` types in production code
- Result/Err types for all operations

## Potential Security Concerns

### 1. Large File Processing

**Risk**: Memory exhaustion from extremely large files

**Mitigation**:
```typescript
// Check file size before processing
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
if (data.length > MAX_SIZE) {
  return err('File too large');
}
```

**User Action**: Implement size limits in your application.

### 2. Malformed Resource Forks

**Risk**: Crafted files could cause excessive parsing time

**Mitigation**:
- Input validation at all levels
- Bounds checking on all reads
- No recursion in parsing
- Early exit on invalid data

**User Action**: Consider timeout wrappers for untrusted input.

### 3. JSON Output Size

**Risk**: Very large resource forks produce large JSON

**Mitigation**:
- Use streaming for large outputs
- Filter resource types to reduce size
- Consider pagination for UI

**User Action**: 
```typescript
// Filter to only needed types
const result = await saveToJson(
  data,
  [],
  ['Hedr', 'Itms'],  // Only these types
  []
);
```

### 4. Struct Template Injection

**Risk**: User-provided struct templates could be malicious

**Mitigation**:
- Templates are parsed, not executed
- No code generation from templates
- Validation of all template syntax
- Limited format character set

**Best Practice**:
```typescript
// Validate struct specs before use
const ALLOWED_FORMATS = /^[<>]?[cbhilqfd]+[+:]?[\w,]*$/i;
if (!ALLOWED_FORMATS.test(structSpec)) {
  return err('Invalid struct spec format');
}
```

## Best Practices

### In Browser Applications

1. **Validate file types**:
```typescript
const ALLOWED_EXTENSIONS = ['.rsrc', '.adf'];
const ext = file.name.substring(file.name.lastIndexOf('.'));
if (!ALLOWED_EXTENSIONS.includes(ext)) {
  throw new Error('Invalid file type');
}
```

2. **Limit file size**:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
if (file.size > MAX_FILE_SIZE) {
  throw new Error('File too large');
}
```

3. **Use Web Workers for untrusted files**:
```typescript
// Isolate parsing in worker thread
const worker = new Worker('/parser-worker.js');
worker.postMessage(fileData);
```

4. **Sanitize JSON output before display**:
```typescript
// Don't trust resource names
const safeName = escapeHtml(resourceName);
```

### In Node.js Applications

1. **Validate file paths**:
```typescript
import { resolve, normalize } from 'path';

// Prevent path traversal
const safePath = normalize(userProvidedPath);
if (!safePath.startsWith(allowedDir)) {
  throw new Error('Invalid path');
}
```

2. **Use rate limiting**:
```typescript
// Limit parsing requests
const rateLimiter = new RateLimiter({
  tokensPerInterval: 10,
  interval: 'minute'
});

await rateLimiter.removeTokens(1);
```

3. **Monitor memory usage**:
```typescript
const before = process.memoryUsage().heapUsed;
const result = load(data);
const after = process.memoryUsage().heapUsed;
const used = after - before;

if (used > MAX_MEMORY) {
  console.warn('High memory usage:', used);
}
```

## Reporting a Vulnerability

If you discover a security vulnerability in rsrcdump-ts, please report it by:

1. **Email**: Open an issue on GitHub with `[SECURITY]` in the title
2. **Do not** disclose publicly until fix is available
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Fix Timeline**: Depends on severity
  - Critical: 7 days
  - High: 14 days
  - Medium: 30 days
  - Low: 60 days

## Security Updates

Security updates will be:
1. Released as patch versions (e.g., 1.0.4)
2. Announced in CHANGELOG.md
3. Tagged with `[SECURITY]` in release notes
4. Backported to supported versions

## Acknowledgments

We thank the security community for responsible disclosure of vulnerabilities.

## Contact

For security concerns: Open an issue at https://github.com/LachlanBWWright/rsrcdump/issues

---

Last updated: December 29, 2025
