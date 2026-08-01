<script setup lang="ts">
import { ref } from 'vue'
import type { PrimaryTableCol } from 'tdesign-vue-next'

const data = ref([
  { id: 1, name: '张三', role: '管理员', status: '在职' },
  { id: 2, name: '李四', role: '开发', status: '在职' },
  { id: 3, name: '王五', role: '测试', status: '离职' },
])

const columns: PrimaryTableCol[] = [
  { colKey: 'id', title: 'ID', width: 80 },
  { colKey: 'name', title: '姓名', width: 120 },
  { colKey: 'role', title: '角色', width: 120 },
  { colKey: 'status', title: '状态', width: 100 },
  { colKey: 'operate', title: '操作', width: 120, fixed: 'right' },
]
</script>

# Table 表格

基于 [TDesign Table](https://tdesign.tencent.com/vue-next/components/table) 封装，`columns` / `data` / 分页 / 排序等 API 完全一致。

## 基础表格

<div class="demo">
  <MyTable :data="data" :columns="columns" row-key="id" bordered>
    <template #operate="{ row }">
      <MyButton theme="primary" variant="text" size="small">编辑</MyButton>
      <MyButton theme="danger" variant="text" size="small">删除</MyButton>
    </template>
  </MyTable>
</div>

## 带分页

```vue
<MyTable
  :data="data"
  :columns="columns"
  :pagination="{ defaultCurrent: 1, defaultPageSize: 10, total: 100 }"
/>
```

## API

完整 props 见 [TDesign Table 文档](https://tdesign.tencent.com/vue-next/components/table#table-%E5%B1%9E%E6%80%A7)。

<style scoped>
.demo {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--td-border-level-2-color, #e7e7e7);
  border-radius: 6px;
}
</style>
