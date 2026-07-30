import { createApp } from 'vue'
import App from './App.vue'
// 直接引入源码样式（含 variables + theme + overrides）
// 路径：playground/src -> ../ = playground -> ../../ = workspace 根
import '../../packages/components/src/styles/index.scss'

createApp(App).mount('#app')
