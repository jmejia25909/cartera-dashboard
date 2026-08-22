import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    ssr: 'tests/tasks/seguimientos-renderer.integration.tsx',
    target: 'node20',
    outDir: 'tests/.build/seguimientos',
    emptyOutDir: true,
    rollupOptions: {
      external: ['node:assert/strict', 'node:fs', 'node:path'],
      output: { format: 'cjs', entryFileNames: 'seguimientos-renderer.integration.cjs' },
    },
  },
});
