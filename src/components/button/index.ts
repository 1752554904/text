import { defineComponent, h } from 'vue'
import { Button as TButton } from 'tdesign-vue-next'
import './style/index.css'

/**
 * MyButton —— 基于 TDesign Button 的二次封装
 *
 * 通过 render 函数透传 attrs / slots，并断言为 TDesign Button 类型，
 * 使使用方获得与 TDesign 一致的 props / 事件 / 插槽类型提示。
 *
 * 需要注入公司默认值或约束时，在 setup 的返回渲染函数里合并 attrs，例如：
 *   return () => h(TButton, { theme: 'primary', ...attrs }, slots)
 */
const _Button = defineComponent({
  name: 'MyButton',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(TButton, attrs, slots)
  },
})

export const Button = _Button as typeof TButton
export default Button
