import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0', // 모든 네트워크 인터페이스에서 접근 허용  
    port: 5173,
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