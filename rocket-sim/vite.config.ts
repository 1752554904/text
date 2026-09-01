import { defineConfig } from 'vite';

// Vite 配置 · 本地可直接 npm run dev / npm run build
export default defineConfig({
  root: '.',
  base: './',                     // 部署到子路径也能正常工作
  server: {
    host: '0.0.0.0',              // 允许同局域网其他设备访问
    port: 5173,
    strictPort: false,            // 5173 被占用时自动换端口
    open: false,
    fs: { allow: ['..'] },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    // 14MB GLB 别强行拆分 chunk，保持单文件加载连贯
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/postprocessing/')) return 'postprocessing';
        },
      },
    },
    chunkSizeWarningLimit: 2048, // 放宽到 2MB 避免 three/postprocessing 报大 chunk 警告
  },
  optimizeDeps: {
    include: ['three', 'postprocessing'],
  },
});
