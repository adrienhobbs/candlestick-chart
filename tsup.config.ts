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
  // fast-technical-indicators ships CommonJS under its `import` condition, so Node's
  // ESM loader rejects the named imports in src/indicators/registry. Bundling it
  // lets the library load under Node (host tests, SSR) as well as in bundlers.
  noExternal: ['fast-technical-indicators'],
});
