import { defineConfig } from "vitest/config";

const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
};

export default defineConfig({
  base: "/bagdrop/",
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm"]
  },
  build: {
    target: "es2022",
    sourcemap: true
  },
  server: {
    headers: crossOriginIsolationHeaders
  },
  preview: {
    headers: crossOriginIsolationHeaders
  },
  test: {
    environment: "node"
  }
});
