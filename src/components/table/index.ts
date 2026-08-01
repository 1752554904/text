import { defineComponent, h } from 'vue'
import { Table as TTable } from 'tdesign-vue-next'
import './style/index.css'

/**
 * MyTable —— 基于 TDesign Table 的二次封装
 * columns / data / 分页 / 排序 / 虚拟滚动等 API 与 TDesign 完全一致。
 */
const _Table = defineComponent({
  name: 'MyTable',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h(TTable, attrs, slots)
  },
})

export const Table = _Table as typeof TTable
export default Table
