import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    ssr: 'tests/tasks/task-domain.integration.ts',
    target: 'node20',
    outDir: 'tests/.build/tasks',
    emptyOutDir: true,
    rollupOptions: {
      external: ['better-sqlite3', 'node:assert/strict', 'node:fs', 'node:os', 'node:path'],
      output: { format: 'cjs', entryFileNames: 'task-domain.integration.cjs' },
    },
  },
  ssr: { external: ['better-sqlite3'] },
});
