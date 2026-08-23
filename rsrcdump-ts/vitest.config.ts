import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 92,
        branches: 84,
        functions: 92,
        lines: 94,
      },
      exclude: [
        'node_modules/',
        'build/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts',
        'examples/',
        'scripts/'
      ]
    },
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'build', 'dist'],
    testTimeout: 30000,
  },
});
