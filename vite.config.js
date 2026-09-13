import { defineConfig } from 'vite';

export default defineConfig({
  // 相对路径，方便直接部署到任意子目录 / 静态托管
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5183,
    strictPort: true,
    open: false,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // rolldown（Vite 8）要求 manualChunks 用函数形式
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          return undefined;
        },
      },
    },
  },
});
