import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    banner: { js: '#!/usr/bin/env node' },
  },
]);
