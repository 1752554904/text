# MyButton

基于 tdesign 设计语言二次封装的按钮组件。

## 与原生 tdesign Button 的差异

1. API 简化：只暴露 `variant` / `size` 等常用 props，不暴露 50+ 配置项
2. 样式走 `--my-*` CSS 变量，运行时可通过覆盖变量换肤
3. 内置 loading 旋转动画

## 引入

```ts
import { MyButton } from '@my-tdesign-ui/components'
import '@my-tdesign-ui/components/style.css'
```

## 基础用法

```vue
<template>
  <MyButton @click="onClick">点击我</MyButton>
</template>

<script setup lang="ts">
import { MyButton } from '@my-tdesign-ui/components'

function onClick() {
  console.log('clicked')
}
</script>
```

## 变体 variant

- `primary`（默认）：实心品牌色按钮
- `outline`：描边按钮
- `ghost`：幽灵按钮，hover 显示浅灰底
- `text`：纯文本按钮

```vue
<MyButton variant="primary">主要</MyButton>
<MyButton variant="outline">描边</MyButton>
<MyButton variant="ghost">幽灵</MyButton>
<MyButton variant="text">文本</MyButton>
```

## 尺寸 size

- `sm`：12px 字号，紧凑
- `md`（默认）：14px
- `lg`：16px，宽松

## 加载态

```vue
<MyButton :loading="true">提交中</MyButton>
```

加载态下点击不会触发 `click` 事件。

## 撑满父容器

```vue
<MyButton block>占满整行</MyButton>
```

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| variant | `'primary' \| 'outline' \| 'ghost' \| 'text'` | `'primary'` | 视觉变体 |
| size | `'sm' \| 'md' \| 'lg'` | `'md'` | 尺寸 |
| disabled | `boolean` | `false` | 禁用 |
| loading | `boolean` | `false` | 加载态 |
| block | `boolean` | `false` | 撑满父容器宽度 |
| type | `'button' \| 'submit' \| 'reset'` | `'button'` | 原生 button type |

## Events

| 名称 | 载荷 | 触发条件 |
| --- | --- | --- |
| click | `MouseEvent` | 点击且非禁用/非加载态 |

## Slots

| 名称 | 说明 |
| --- | --- |
| default | 按钮内容 |
