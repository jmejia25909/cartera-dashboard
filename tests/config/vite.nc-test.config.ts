import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/rehydrate/test-nc-rehydrate.ts",
    target: "node20",
    outDir: "tests/.build/_test_nc_build",
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
        entryFileNames: "test-nc-rehydrate.cjs",
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

