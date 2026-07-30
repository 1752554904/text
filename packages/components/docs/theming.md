# 主题定制指南

本组件库提供两层主题机制，可满足从「品牌色微调」到「运行时换肤」的全场景需求。

## 第一层：SCSS 编译期变量（适合固化品牌风格）

文件位置：`src/styles/variables.scss`

修改这里会改变所有组件的最终样式，但需要重新 build。

```scss
// 修改主色
$brand-color-6: #ff6600;

// 修改圆角
$radius-default: 8px;
```

修改后执行：

```bash
pnpm build
```

## 第二层：CSS 运行时变量（适合动态换肤）

文件位置：`src/styles/theme.scss`

使用方无需重新构建，在页面根节点覆盖 `--my-*` 变量即可：

```css
:root {
  --my-brand-color: #ff6600;
  --my-radius-default: 12px;
}
```

### 暗色主题

本库内置了暗色主题预设，在根节点加 `theme-dark` 类即可启用：

```html
<html class="theme-dark">
  <!-- 整站暗色 -->
</html>
```

或局部应用：

```vue
<div class="theme-dark">
  <MyInput v-model="value" />
</div>
```

### 运行时切换主题示例

```ts
function toggleDark(isDark: boolean) {
  document.documentElement.classList.toggle('theme-dark', isDark)
}
```

## 第三层：tdesign 原生类覆盖

文件位置：`src/styles/overrides.scss`

透传的 tdesign 组件（如 `Table`、`Dialog`）默认会使用 tdesign 原生样式。本文件负责把它们的内部类映射到我们的 `--my-*` CSS 变量。

例如要让 tdesign 的 Button 也走品牌色：

```scss
// overrides.scss 中已有
.t-button--theme-primary {
  background-color: var(--my-brand-color);
}
```

升级 tdesign 版本时，只需要检查并维护这一个文件即可，不需要改组件源码。

## 新增自定义主题预设

在 `theme.scss` 中按需新增命名主题：

```scss
.theme-brand-x {
  --my-brand-color: #00b894;
  --my-brand-color-hover: #00cec9;
  --my-bg-color-page: #f0fff4;
}
```

使用：

```html
<div class="theme-brand-x">
  <MyButton>定制主题按钮</MyButton>
</div>
```
