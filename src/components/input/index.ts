import { defineComponent, h } from 'vue'
import { Input as TInput } from 'tdesign-vue-next'
import './style/index.css'

/**
 * MyInput —— 基于 TDesign Input 的二次封装
 * 支持 v-model（modelValue），透传 attrs / slots，类型与 TDesign 一致。
 */
const _Input = defineComponent({
  name: 'MyInput',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(TInput, attrs, slots)
  },
})

export const Input = _Input as typeof TInput
export default Input
