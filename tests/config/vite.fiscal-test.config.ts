import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/rehydrate/test-fiscal-rehydrate.ts",
    target: "node20",
    outDir: "tests/.build/_test_build",
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
        entryFileNames: "test-fiscal-rehydrate.cjs",
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

