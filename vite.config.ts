import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      exclude: ['src/**/*.spec.ts', 'src/**/__tests__/**'],
      // 透传 tdesign-vue-next 的类型，避免把上游类型一起打包出来
      cleanVueFileName: true,
    }),
  ],
  resolve: {
    alias: {
      'my-vue-ui': resolve(__dirname, 'src/index.ts'),
    },
  },
  build: {
    // 库模式：vue 与 tdesign-vue-next 作为 peerDependency，由宿主提供
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyVueUI',
      fileName: 'my-vue-ui',
    },
    rollupOptions: {
      external: ['vue', 'tdesign-vue-next'],
      output: {
        globals: {
          vue: 'Vue',
          'tdesign-vue-next': 'TDesignVueNext',
        },
        // 把所有组件样式合并到一个 style.css，通过 ./style 子路径引入
        assetFileNames: (assetInfo) =>
          assetInfo.name === 'style.css' ? 'style.css' : assetInfo.name ?? '[name][extname]',
      },
    },
  },
})
