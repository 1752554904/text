# 主题定制

TDesign 通过 CSS 变量（`--td-*` 前缀）驱动整套主题。本库在 `src/theme/tokens.css` 中覆盖了关键变量，将默认的 TDesign 蓝替换为公司品牌色，并调整了圆角与字体。

## 修改主题

直接编辑 [src/theme/tokens.css](file:///workspace/src/theme/tokens.css)：

```css
:root {
  --td-brand-color: #4f46e5;        /* 品牌主色 */
  --td-brand-color-hover: #4338ca;
  --td-brand-color-active: #3730a3;
  --td-radius-default: 6px;          /* 全局圆角 */
  --td-font-family: -apple-system, 'PingFang SC', sans-serif;
}
```

## 完整调色板

`--td-brand-color-1` ~ `--td-brand-color-10` 是从浅到深的背景梯度，用于 tag、选中态、hover 等。建议用 TDesign 官方主题生成器基于主色自动产出整套梯度后粘贴进来：

> https://tdesign.tencent.com/vue-next/getting-started#%E8%87%AA%E5%AE%9A%E4%B9%89%E4%B8%BB%E9%A2%98

## 运行时切换主题（暗色模式）

TDesign 内置暗色变量集合，可在最外层包裹 `<t-config-provider>`，或手动给根节点添加 `.t-theme-dark` 类切换暗色。组件级颜色差异请通过覆盖 `--td-*` 变量实现，不要写死颜色值。

## 组件级覆盖

每个组件目录下都有 `style/index.css`，用于 Token 无法覆盖的局部样式，例如：

```css
/* src/components/button/style/index.css */
.my-button--emphasis {
  font-weight: 600;
}
```

::: tip 原则
优先用 Token，其次组件级 CSS，最后才考虑在封装层注入 props 默认值。三层优先级保证了主题的一致性与可维护性。
:::
