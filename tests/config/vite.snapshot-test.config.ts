import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/snapshots/test-snapshot-idempotency.ts",
    target: "node20",
    outDir: "tests/.build/_test_snapshot_build",
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
        entryFileNames: "test-snapshot-idempotency.cjs",
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

