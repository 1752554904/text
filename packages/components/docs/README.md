# @my-tdesign-ui/components 组件库

基于 `tdesign-vue-next` 深度定制的 Vue 3 桌面端组件库。

## 安装

本组件库为本地 monorepo 包。使用方需在 `package.json` 中通过 workspace 引入：

```json
{
  "dependencies": {
    "@my-tdesign-ui/components": "workspace:*"
  }
}
```

## 使用

### 全量引入

```ts
// main.ts
import { createApp } from 'vue'
import MyTDesignUI from '@my-tdesign-ui/components'
import '@my-tdesign-ui/components/style.css'

const app = createApp(App)
app.use(MyTDesignUI)
```

### 按需引入

```ts
import { MyButton, MyInput } from '@my-tdesign-ui/components'
import '@my-tdesign-ui/components/style.css'
```

### 透传 tdesign 组件

tdesign-vue-next 的全部组件可直接从本包 import：

```ts
import { Button as TButton, Table, Dialog, Form, FormItem } from '@my-tdesign-ui/components'
```

## 主题定制

本库提供两层主题机制，详见 [theming.md](./theming.md)。

## 组件列表

| 组件 | 类型 | 说明 |
| --- | --- | --- |
| [MyButton](./components/my-button.md) | 定制 | 简化 API 的按钮 |
| [MyInput](./components/my-input.md) | 定制 | 极简输入框 |
| tdesign 全部组件 | 透传 | Button/Input/Table/Dialog/Form/Select 等 |
