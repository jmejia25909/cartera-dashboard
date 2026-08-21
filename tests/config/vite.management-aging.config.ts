import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/management/test-management-aging.ts",
    target: "node20",
    outDir: "tests/.build/_test_management_aging",
    emptyOutDir: true,

    rollupOptions: {
      external: [
        "better-sqlite3",
        "node:fs",
        "node:path",
      ],

      output: {
        format: "cjs",
        entryFileNames:
          "test-management-aging.cjs",
      },
    },
  },

  ssr: {
    external: ["better-sqlite3"],
  },
});

