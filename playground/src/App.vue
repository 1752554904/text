<template>
  <div class="page" :class="{ 'theme-dark': isDark }">
    <header class="page__header">
      <h1>My TDesign UI · Playground</h1>
      <label class="theme-toggle">
        <input type="checkbox" v-model="isDark" />
        暗色主题
      </label>
    </header>

    <section class="block">
      <h2>MyButton 变体</h2>
      <div class="row">
        <MyButton variant="primary" @click="onClick">主要</MyButton>
        <MyButton variant="outline">描边</MyButton>
        <MyButton variant="ghost">幽灵</MyButton>
        <MyButton variant="text">文本</MyButton>
        <MyButton variant="primary" :loading="loading" @click="startLoading">加载态</MyButton>
        <MyButton variant="primary" disabled>禁用</MyButton>
        <MyButton variant="primary" block>撑满</MyButton>
      </div>
    </section>

    <section class="block">
      <h2>MyInput</h2>
      <div class="row">
        <MyInput v-model="text" placeholder="普通输入" />
        <MyInput v-model="pwd" type="password" placeholder="密码" />
        <MyInput v-model="search" placeholder="带前缀">
          <template #prefix>🔍</template>
        </MyInput>
      </div>
      <p class="preview">当前值：{{ text || '（空）' }}</p>
    </section>

    <section class="block">
      <h2>tdesign 透传组件（Button 颜色已被 overrides.scss 覆盖）</h2>
      <div class="row">
        <TButton theme="primary">tdesign 主要</TButton>
        <TButton theme="success">成功</TButton>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MyButton, MyInput, Button as TButton } from '@my-tdesign-ui/components'

const isDark = ref(false)
const loading = ref(false)
const text = ref('')
const pwd = ref('')
const search = ref('')

function onClick() {
  alert('clicked')
}
function startLoading() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1500)
}
</script>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px;
  background-color: var(--my-bg-color-page);
  color: var(--my-text-color-primary);
  min-height: 100vh;
  transition: background-color 0.2s, color 0.2s;
}
.page__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.theme-toggle {
  font-size: 14px;
  cursor: pointer;
}
.block {
  background: var(--my-bg-color-container);
  padding: 20px;
  border-radius: var(--my-radius-large);
  margin-bottom: 16px;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.preview {
  margin-top: 12px;
  color: var(--my-text-color-secondary);
  font-size: 13px;
}
</style>
