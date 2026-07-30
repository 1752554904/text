import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

// playground 直接引用源码包，HMR 即时生效，便于调试样式
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@my-tdesign-ui/components': resolve(__dirname, '../packages/components/src/index.ts')
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
