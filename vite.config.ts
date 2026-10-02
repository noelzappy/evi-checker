import { defineConfig } from 'vite';

// Vite serves index.html and compiles the TypeScript in src/ on the fly.
// Vitest reads the same file for its (default, Node) test environment.
export default defineConfig({
  server: { port: 8000, strictPort: false },
  preview: { port: 8000 },
  build: { outDir: 'dist' },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
