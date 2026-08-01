import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import MyVueUI from '../../../src/index'
// 文档站点需要完整加载 TDesign 基础样式 + 公司主题 Token
import 'tdesign-vue-next/es/style/index.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout),
  enhanceApp({ app }) {
    // 全局注册 My* 组件，文档内可直接 <MyButton /> 使用
    app.use(MyVueUI)
  },
}
