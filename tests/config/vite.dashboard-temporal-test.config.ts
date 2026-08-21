import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/dashboard/test-dashboard-temporal-filters.ts",
    target: "node20",
    outDir: "tests/.build/_test_dashboard_temporal_build",
    emptyOutDir: true,

    rollupOptions: {
      external: [
        "better-sqlite3",
        "node:fs",
        "node:path",
        "node:crypto",
      ],

      output: {
        format: "cjs",
        entryFileNames:
          "test-dashboard-temporal-filters.cjs",
      },
    },
  },

  ssr: {
    external: ["better-sqlite3"],
  },
});

