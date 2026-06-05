import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      buffer:  path.resolve(require.resolve("buffer/"), ".."),
      process: require.resolve("process/browser"),
      stream:  "stream-browserify",
      crypto:  "crypto-browserify",
      util:    path.resolve(require.resolve("util/"), ".."),
      http:    "stream-http",
      https:   "https-browserify",
      assert:  "assert",
      url:     "url",
    },
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
      ],
    },
    include: [
      "buffer",
      "crypto-browserify",
      "stream-browserify",
      "util",
      "assert",
      "stream-http",
      "https-browserify",
      "url",
    ],
  },

  define: {
    global: "globalThis",
    "process.env": "{}",
  },
});