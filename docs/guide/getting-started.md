# 快速开始

## 安装

```bash
# 项目内需同时安装 vue 与 tdesign-vue-next（peerDependencies）
pnpm add my-vue-ui tdesign-vue-next vue
```

## 全量引入

```ts
// main.ts
import { createApp } from 'vue'
import MyVueUI from 'my-vue-ui'
import 'my-vue-ui/style' // 公司主题 Token + 组件样式
import App from './App.vue'

createApp(App).use(MyVueUI).mount('#app')
```

```vue
<template>
  <MyButton theme="primary">主要按钮</MyButton>
</template>
```

## 按需引入

```ts
import { Button } from 'my-vue-ui'
import 'my-vue-ui/style'
```

```vue
<script setup lang="ts">
import { Button } from 'my-vue-ui'
</script>

<template>
  <Button theme="primary">主要按钮</Button>
</template>
```

## 自定义组件前缀

默认全局组件前缀为 `My`，可在安装时覆盖：

```ts
app.use(MyVueUI, { prefix: 'Biz' }) // <BizButton />
```

## 与 TDesign 的关系

- 本库**不重复造轮子**，所有交互能力来自 `tdesign-vue-next`，封装层负责注入公司主题、统一 API、预留二次扩展点。
- 组件 props / 事件 / 插槽与 TDesign 完全一致，遇到本库未覆盖的细节请直接参考 [TDesign 官方文档](https://tdesign.tencent.com/vue-next/overview)。
