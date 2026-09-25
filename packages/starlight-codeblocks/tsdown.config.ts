import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/expressive-code/index.ts'],
  format: 'esm',
  dts: true,
});
