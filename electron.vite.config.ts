// electron.vite.config.ts
import { defineConfig } from "vite";
import electron from "vite-plugin-electron/simple";

const external = [
  // Nativo / problemáticos si se bundlea en ESM:
  "better-sqlite3",
  "bindings",

  // Node builtins (por seguridad):
  "node:fs",
  "node:path",
  "node:url",
  "fs",
  "path",
  "url",
];

export default defineConfig({
  plugins: [
    electron({
      // MAIN PROCESS (mantener ESM, pero sin bundlear better-sqlite3/bindings)
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: true,
            sourcemap: true,
            rollupOptions: {
              external,
              output: {
                format: "es",
                entryFileNames: "main.js",
              },
            },
          },
        },
      },

      // PRELOAD (forzar CJS para que Electron lo cargue sin líos)
      preload: {
        input: "electron/preload.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            emptyOutDir: false,
            sourcemap: true,
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "cjs",
                entryFileNames: "preload.cjs",
              },
            },
          },
        },
      },
    }),
  ],
});