# MyInput

极简风格输入框，支持 v-model 双向绑定。前后缀通过具名插槽提供。

## 引入

```ts
import { MyInput } from '@my-tdesign-ui/components'
import '@my-tdesign-ui/components/style.css'
```

## 基础用法

```vue
<template>
  <MyInput v-model="value" placeholder="请输入" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MyInput } from '@my-tdesign-ui/components'

const value = ref('')
</script>
```

## 前后缀插槽

```vue
<MyInput v-model="value" placeholder="搜索关键词">
  <template #prefix>
    <SearchIcon />
  </template>
  <template #suffix>
    <span>字符</span>
  </template>
</MyInput>
```

## 密码框 / 数字框

```vue
<MyInput v-model="pwd" type="password" />
<MyInput v-model="age" type="number" />
```

## 编程式聚焦

```vue
<template>
  <MyInput ref="inputRef" v-model="value" />
  <MyButton @click="inputRef?.focus()">聚焦</MyButton>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const inputRef = ref<{ focus: () => void }>()
</script>
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| modelValue | `string \| number` | `''` | v-model 绑定值 |
| type | `'text' \| 'password' \| 'number' \| 'email' \| 'tel'` | `'text'` | input 类型 |
| placeholder | `string` | - | 占位文本 |
| disabled | `boolean` | `false` | 禁用 |
| readonly | `boolean` | `false` | 只读 |
| maxlength | `number` | - | 最大长度 |

## Events

| 名称 | 载荷 | 说明 |
| --- | --- | --- |
| update:modelValue | `string` | 输入时触发 |
| focus | `FocusEvent` | 聚焦 |
| blur | `FocusEvent` | 失焦 |

## Slots

| 名称 | 说明 |
| --- | --- |
| prefix | 输入框前缀 |
| suffix | 输入框后缀 |

## Exposed

| 名称 | 签名 | 说明 |
| --- | --- | --- |
| focus | `() => void` | 编程式聚焦 |
