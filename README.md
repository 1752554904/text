# MyVueUI

公司内部 Vue 3 组件库，基于 [tdesign-vue-next](https://tdesign.tencent.com/vue-next/overview) 二次开发。

## 技术栈

- Vue 3 + `<script setup>` + TypeScript
- Vite 库模式打包（ESM / UMD），`vite-plugin-dts` 产出类型声明
- VitePress 文档站点
- 以 `tdesign-vue-next` 为 peerDependency 做薄封装，API 与上游保持一致

## 目录结构

```
src/
├── components/          # 二次封装组件
│   ├── button/          # 每个组件含 index.ts / *.vue / style/index.css
│   ├── input/
│   ├── form/            # Form + FormItem
│   └── table/
├── theme/
│   └── tokens.css       # 公司主题 Token，覆盖 TDesign CSS 变量
├── index.ts             # 库入口 + Vue 插件
└── env.d.ts
docs/                    # VitePress 文档站点与组件示例
vite.config.ts           # 库模式构建配置（external: vue / tdesign-vue-next）
```

## 命令

```bash
pnpm install            # 安装依赖
pnpm dev                # Vite 开发（库调试）
pnpm build              # 构建库到 dist/，产出 js + style.css + .d.ts
pnpm docs               # 本地启动文档站点
pnpm build:docs         # 构建静态文档站点
```

## 使用方式

### 全量引入

```ts
import { createApp } from 'vue'
import MyVueUI from 'my-vue-ui'
import 'my-vue-ui/style'
import App from './App.vue'

createApp(App).use(MyVueUI).mount('#app')
```

### 按需引入

```ts
import { Button } from 'my-vue-ui'
import 'my-vue-ui/style'
```

### 自定义前缀

```ts
app.use(MyVueUI, { prefix: 'Biz' }) // <BizButton />
```

## 封装约定

1. **薄封装**：组件透传 props / 事件 / 插槽到对应 TDesign 组件，仅在中间层注入公司默认值或做约束，使用方 API 与 TDesign 一致。
2. **主题优先级**：先 Token（`src/theme/tokens.css`），再组件级 CSS（`style/index.css`），最后才在封装层注入 props 默认值。
3. **新增组件**：在 `src/components/<name>/` 下新建 `index.ts` + `<name>.vue` + `style/index.css`，并在 `src/components/index.ts` 中 `export`。

## 注意事项

- 包名 `my-vue-ui` 与组件前缀 `My` 均为占位符，接入前请全局替换为公司命名。
- `vue` 与 `tdesign-vue-next` 为 peerDependency，由宿主项目提供，避免重复打包。
