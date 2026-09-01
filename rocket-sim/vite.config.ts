import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/* Vite 配置 · 环境资源**直接引自 tellux.cyanfish.site **的官方原文件
 *   1. 本地优先：所有 tellux 资产已镜像到 public/tellux-assets/assets/*
 *      Vite 开发/构建会直接以静态文件下发（200，字节级等价 tellux 站）
 *   2. 远端兜底：本地若缺失某个 hash 文件才代理到 tellux.cyanfish.site
 *      （通过 configureServer 自写中间件，保证 public 静态命中后不走代理）
 */
export default defineConfig({
  root: '.',
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    fs: { allow: ['..'] },
  },
  plugins: [
    {
      name: 'tellux-assets-fallback-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';
          if (!url.startsWith('/tellux-assets/')) return next();
          const localFile = path.join(server.config.publicDir, url.split('?')[0]);
          try {
            if (fs.existsSync(localFile) && fs.statSync(localFile).isFile()) {
              return next(); // 命中本地 public 静态，交给 vite 默认中间件处理
            }
          } catch { /* ignore */ }
          // 本地缺失 → 代理直取 tellux.cyanfish.site (等价于"直接引用"官网同源资源)
          const upstream = 'https://tellux.cyanfish.site' + url.replace(/^\/tellux-assets/, '');
          try {
            const mod = await import('node:https');
            mod.get(upstream, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (tellux-assets-fallback)',
                'Accept': '*/*',
              },
              timeout: 8000,
            }, (upRes) => {
              res.statusCode = upRes.statusCode || 502;
              for (const [k, v] of Object.entries(upRes.headers || {})) {
                if (/^access-control|^content-type|^cache-control|^content-length$/i.test(k) && v) {
                  res.setHeader(k, Array.isArray(v) ? v.join(', ') : v);
                }
              }
              res.setHeader('x-tellux-proxy', 'fallback-direct');
              upRes.pipe(res);
            }).on('timeout', function (this: any) { this.destroy(new Error('ETIMEDOUT')); })
              .on('error', () => { res.statusCode = 502; res.end('tellux upstream unreachable'); });
          } catch {
            next();
          }
        });
      },
    },
  ],
  preview: {
    host: '0.0.0.0',
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/postprocessing/')) return 'postprocessing';
        },
      },
    },
    chunkSizeWarningLimit: 2048,
  },
  optimizeDeps: {
    include: ['three', 'postprocessing'],
  },
});
