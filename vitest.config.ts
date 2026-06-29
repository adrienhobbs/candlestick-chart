import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // fast-technical-indicators ships CommonJS; inline it so Vitest transforms
    // it and the named imports (e.g. `macd`) interop correctly under ESM.
    server: {
      deps: {
        inline: ['fast-technical-indicators'],
      },
    },
  },
});
