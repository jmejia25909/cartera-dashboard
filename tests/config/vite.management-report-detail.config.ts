import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/management/test-management-report-detail.ts",
    target: "node20",
    outDir: "tests/.build/_test_management_report_detail",
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
          "test-management-report-detail.cjs",
      },
    },
  },

  ssr: {
    external: ["better-sqlite3"],
  },
});

