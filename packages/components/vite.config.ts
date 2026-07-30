import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      outDir: 'dist',
      // 仅打包类型，不打包样式与 css
      includeRoot: false,
      cleanVueFileName: true
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  // tdesign-vue-next 不打进包里，作为 peerDependency 由使用方提供
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyTDesignUI',
      fileName: (format) => format === 'es' ? 'my-tdesign-ui.js' : 'my-tdesign-ui.umd.cjs'
    },
    rollupOptions: {
      external: ['vue', 'tdesign-vue-next', /^tdesign-vue-next\//],
      output: {
        // 同时有具名导出和默认导出时，统一用 named 避免警告
        exports: 'named',
        globals: {
          vue: 'Vue',
          'tdesign-vue-next': 'TDesignVueNext'
        },
        // 样式单独抽取到 style.css，方便按需引入
        assetFileNames: (asset) => {
          if (asset.name && asset.name.endsWith('.css')) return 'style.css'
          return asset.name || 'asset'
        }
      }
    },
    cssCodeSplit: false
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  }
})
