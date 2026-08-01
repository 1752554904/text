import { defineComponent, h } from 'vue'
import { Form as TForm, FormItem as TFormItem } from 'tdesign-vue-next'
import './style/index.css'

/**
 * MyForm / MyFormItem —— 基于 TDesign Form 的二次封装
 * 校验规则、方法（validate / reset / clearValidate）等均与 TDesign 一致。
 */
const _Form = defineComponent({
  name: 'MyForm',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(TForm, attrs, slots)
  },
})

const _FormItem = defineComponent({
  name: 'MyFormItem',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(TFormItem, attrs, slots)
  },
})

export const Form = _Form as typeof TForm
export const FormItem = _FormItem as typeof TFormItem
export default Form
