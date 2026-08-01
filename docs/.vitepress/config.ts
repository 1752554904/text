import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'MyVueUI',
  description: '公司内部 Vue 3 组件库 · 基于 TDesign 二次开发',
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: '组件', link: '/components/button' },
      {
        text: '相关链接',
        items: [
          { text: 'TDesign Vue Next', link: 'https://tdesign.tencent.com/vue-next/overview' },
          { text: 'Vue 3', link: 'https://cn.vuejs.org/' },
        ],
      },
    ],
    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '主题定制', link: '/guide/theme' },
          ],
        },
      ],
      '/components/': [
        {
          text: '基础组件',
          items: [
            { text: 'Button 按钮', link: '/components/button' },
            { text: 'Input 输入框', link: '/components/input' },
          ],
        },
        {
          text: '表单组件',
          items: [{ text: 'Form 表单', link: '/components/form' }],
        },
        {
          text: '数据展示',
          items: [{ text: 'Table 表格', link: '/components/table' }],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/' }],
    footer: {
      message: '基于 TDesign 二次开发，仅供公司内部使用',
      copyright: 'Copyright © 内部研发团队',
    },
  },
})
