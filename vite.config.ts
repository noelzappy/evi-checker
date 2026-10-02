import { defineConfig } from 'vitest/config';

// Vite serves index.html and compiles the TypeScript in src/ on the fly.
// Vitest reads the same file for its (default, Node) test environment.
//
// BASE_PATH is set by the GitHub Pages workflow to "/<repo-name>/" so that
// built asset URLs resolve under the project's sub-path. Locally it is "/".
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  server: { port: 8000, strictPort: false },
  preview: { port: 8000 },
  build: { outDir: 'dist' },
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
