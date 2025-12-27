# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-27

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
