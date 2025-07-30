import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 443,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:80',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      input: 'index.html'
    }
  },
  base: './'
}) 