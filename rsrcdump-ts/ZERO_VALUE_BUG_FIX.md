# Zero Value Bug Fix

**Date**: December 29, 2025  
**Commits**: c966021, b88ded9  
**Issue**: Parsed numeric zero values and false booleans appearing as null/undefined in JSON output

## Problem Description

Users reported that rsrcdump-ts v1.0.4 was returning null/undefined for numeric zero values instead of 0. This affected struct parsing where legitimate zero values were being omitted from the JSON output.

## Root Cause

The bug was in `src/structtemplate.ts` at lines 237 and 271:

```typescript
// BEFORE (buggy code)
if (fieldName && value !== undefined) {
  record[fieldName] = value;
}
```

### Why This Failed

1. The check `fieldName &&` uses JavaScript's truthy/falsy evaluation
2. Empty string `""` is falsy in JavaScript
3. The codebase explicitly allows empty string field names (line 104: `expandedFieldNames.push('')`)
4. When a field has an empty name AND a zero value:
   - `fieldName` is `""` (falsy)
   - `value` is `0` (but never evaluated due to `&&` short-circuit)
   - The entire condition evaluates to false
   - The value is **never added to the output**

## Solution

Changed the check to properly distinguish between null/undefined and empty string:

```typescript
// AFTER (fixed code)
if (fieldName != null && value !== undefined) {
  record[fieldName] = value;
}
```

### Why This Works

- `!= null` (loose equality) checks for BOTH null AND undefined
- Empty string `""` passes this check (it's not null or undefined)
- Zero values `0` pass the `!== undefined` check
- False booleans `false` pass the `!== undefined` check

## Testing

Created comprehensive test suite in `src/zero-value.test.ts`:

1. **Zero values in named fields** - Verifies `{field1: 0, field2: 100}`
2. **Zero values in backtick arrays** - Verifies `{values: [0, 10, 0, 20]}`
3. **Scalar zero values** - Verifies direct zero return
4. **False boolean values** - Verifies `{flag: false}`
5. **Empty field names with zeros** - Verifies `{'.field0': 0, field2: 100}`

### Test Results

```
✓ src/zero-value.test.ts (5 tests) 8ms
  ✓ should preserve zero values in named fields
  ✓ should preserve zero values in backtick arrays
  ✓ should preserve zero in scalar values
  ✓ should preserve false boolean values
  ✓ should preserve zero values with empty string field names

Test Files: 8 passed (8)
Tests: 74 passed (74)
Duration: 5.57s
```

## Impact

- **Fixed**: Zero numeric values now correctly appear as `0` in JSON
- **Fixed**: False boolean values now correctly appear as `false` in JSON
- **Fixed**: Empty string field names work correctly with any value
- **No breaking changes**: All 69 existing tests continue to pass
- **Better type safety**: Proper null/undefined handling with TypeScript strict mode

## Files Changed

- `src/structtemplate.ts` - Lines 237 and 271 fixed
- `src/zero-value.test.ts` - 5 new comprehensive tests added

## Version

This fix will be included in v1.0.5.
