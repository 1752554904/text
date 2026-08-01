import type { App, Plugin } from 'vue'
import './theme/tokens.css'
import * as components from './components'

export interface MyVueUIOptions {
  /** 全局组件前缀，默认 My；按需注册时无需关注 */
  prefix?: string
  /** 是否以默认方式全局注册所有组件，默认 true */
  registerAll?: boolean
}

const MyVueUI: Plugin = {
  install(app: App, options: MyVueUIOptions = {}) {
    const { prefix = 'My', registerAll = true } = options
    if (!registerAll) return
    for (const [name, comp] of Object.entries(components)) {
      app.component(`${prefix}${name}`, comp as never)
    }
  },
}

export default MyVueUI
export * from './components'
