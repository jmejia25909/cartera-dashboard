import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/reconciliation/test-reversal-determinism.ts",
    target: "node20",
    outDir: "tests/.build/_test_reversal_build",
    emptyOutDir: true,

    rollupOptions: {
      external: [
        "better-sqlite3",
        "xlsx",
        "node:fs",
        "node:path",
        "node:crypto",
      ],

      output: {
        format: "cjs",
        entryFileNames: "test-reversal-determinism.cjs",
      },
    },
  },

  ssr: {
    external: [
      "better-sqlite3",
      "xlsx",
    ],
  },
});

