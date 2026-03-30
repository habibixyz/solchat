// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import rollupNodePolyFill from 'rollup-plugin-polyfill-node'
import path from 'path'

export default defineConfig({
  plugins: [react()],

  define: {
    global: 'globalThis',
    'process.env': {},
  },

  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        NodeGlobalsPolyfillPlugin({
          buffer: true,
          process: true,
        }),
      ],
    },
  },

  resolve: {
    alias: {
      buffer: 'buffer',
      process: path.resolve(__dirname, 'node_modules/process/browser.js'),
      stream: 'stream-browserify',
      util: 'util',
    },
  },

  build: {
    rollupOptions: {
      plugins: [
        rollupNodePolyFill(),
      ],
    },
  },
})