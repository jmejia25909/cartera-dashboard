import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/integration/reconciliation.integration.ts",
    target: "node20",
    outDir: "tests/.build/integration",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        "better-sqlite3",
        "xlsx",
        "node:assert/strict",
        "node:crypto",
        "node:fs",
        "node:os",
        "node:path",
      ],
      output: {
        format: "cjs",
        entryFileNames: "reconciliation.integration.cjs",
      },
    },
  },
  ssr: {
    external: ["better-sqlite3", "xlsx"],
  },
});
