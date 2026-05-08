import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { createRequire } from "module";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      buffer: "buffer",
      process: require.resolve("process/browser"), // ✅ absolute path now
    },
  },

  optimizeDeps: {
    force: true,
    include: [
      "buffer",
      "process",
      "process/browser", // ✅ add this
      "crypto-browserify",
    ],
  },

  define: {
    global: "globalThis",
  },
});