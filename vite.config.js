import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild', // terser 대신 esbuild 사용 (더 빠르고 기본 포함)
    rollupOptions: {
      input: 'index.html'
    }
  },
  base: './'
}) 