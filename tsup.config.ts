import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  tsconfig: 'tsconfig.build.json',
  format: ['esm'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', 'lightweight-charts'],
});
