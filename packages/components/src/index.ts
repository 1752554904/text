// ============================================================================
// @my-tdesign-ui/components 入口
// ----------------------------------------------------------------------------
// 使用方式：
//   import { MyButton, MyInput, Button as TButton } from '@my-tdesign-ui/components'
//   import '@my-tdesign-ui/components/style.css'
// ============================================================================

// 1. 定制组件
export { default as MyButton } from './components/button/MyButton.vue'
export { default as MyInput } from './components/input/MyInput.vue'

// 2. 透传 tdesign-vue-next 全部组件（按需引入 tree-shaking 友好）
export * from 'tdesign-vue-next'

// 3. Vue 插件形式（main.ts 中 app.use(MyTDesignUI) 即可）
import type { App, Plugin } from 'vue'
import MyButton from './components/button/MyButton.vue'
import MyInput from './components/input/MyInput.vue'

const components = { MyButton, MyInput }

const MyTDesignUI: Plugin = {
  install(app: App) {
    Object.entries(components).forEach(([name, comp]) => {
      app.component(name, comp as any)
    })
  }
}

export default MyTDesignUI
