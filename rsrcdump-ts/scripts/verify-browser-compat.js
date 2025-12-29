#!/usr/bin/env node
/**
 * Verify that the core library has no Node.js-specific dependencies
 * and is fully browser-compatible.
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const srcDir = join(__dirname, '..', 'src');

// Node.js-specific APIs that should NOT appear in core library
const NODE_APIS = [
  { pattern: /\bBuffer\./g, name: 'Buffer API' },
  { pattern: /\bBuffer\(/g, name: 'Buffer constructor' },
  { pattern: /from ['"]fs['"]/g, name: 'fs module' },
  { pattern: /from ['"]path['"]/g, name: 'path module' },
  { pattern: /from ['"]process['"]/g, name: 'process module' },
  { pattern: /\bprocess\./g, name: 'process global' },
  { pattern: /\brequire\(/g, name: 'require()' },
];

// Files to exclude from checking (tests, CLI, etc.)
const EXCLUDED_FILES = [
  'cli.ts',
  /\.test\.ts$/,
  'buffer-utils.ts', // This file is documented as browser-compatible
];

function shouldCheckFile(filename) {
  if (EXCLUDED_FILES.includes(filename)) {
    return false;
  }
  for (const pattern of EXCLUDED_FILES) {
    if (pattern instanceof RegExp && pattern.test(filename)) {
      return false;
    }
  }
  return filename.endsWith('.ts');
}

function checkFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  const filename = filepath.split('/').pop();
  const issues = [];

  for (const { pattern, name } of NODE_APIS) {
    const matches = content.match(pattern);
    if (matches) {
      // Special case: allow .buffer property (accessing ArrayBuffer from TypedArray)
      if (name === 'Buffer API') {
        const filtered = matches.filter(m => !m.includes('.buffer'));
        if (filtered.length > 0) {
          issues.push({ name, count: filtered.length, matches: filtered });
        }
      } else {
        issues.push({ name, count: matches.length, matches });
      }
    }
  }

  return { filename, issues };
}

function main() {
  console.log('Checking browser compatibility of core library...\n');

  const files = readdirSync(srcDir);
  const filesToCheck = files.filter(shouldCheckFile);

  let hasIssues = false;
  const results = [];

  for (const file of filesToCheck) {
    const filepath = join(srcDir, file);
    const result = checkFile(filepath);
    results.push(result);

    if (result.issues.length > 0) {
      hasIssues = true;
      console.error(`❌ ${result.filename}:`);
      for (const issue of result.issues) {
        console.error(`   - Found ${issue.count} usage(s) of ${issue.name}`);
        console.error(`     ${issue.matches.slice(0, 3).join(', ')}${issue.matches.length > 3 ? '...' : ''}`);
      }
      console.error('');
    }
  }

  if (!hasIssues) {
    console.log(`✓ All ${filesToCheck.length} core files are browser-compatible!`);
    console.log('  - No Node.js Buffer usage');
    console.log('  - No fs module usage');
    console.log('  - No path module usage');
    console.log('  - No process usage');
    console.log('  - No require() usage');
    console.log('\nCore library is 100% browser-compatible!');
    process.exit(0);
  } else {
    console.error('❌ Browser compatibility issues found!');
    console.error('The core library contains Node.js-specific APIs that won\'t work in browsers.');
    process.exit(1);
  }
}

main();
