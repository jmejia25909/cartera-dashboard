import { defineConfig } from "vite";

export default defineConfig({
  build: {
    ssr: "tests/crm/crm-persistence.integration.ts",
    target: "node20",
    outDir: "tests/.build/crm",
    emptyOutDir: true,
    rollupOptions: {
      external: [
        "better-sqlite3",
        "node:assert/strict",
        "node:fs",
        "node:os",
        "node:path",
      ],
      output: {
        format: "cjs",
        entryFileNames: "crm-persistence.integration.cjs",
      },
    },
  },
  ssr: {
    external: ["better-sqlite3"],
  },
});
