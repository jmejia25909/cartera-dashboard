import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/rehydrate/test-cobro-rehydrate.ts",
    target: "node20",
    outDir: "tests/.build/_test_cobro_build",
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
        entryFileNames:
          "test-cobro-rehydrate.cjs",
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

