<template>
  <button
    :class="['my-btn', `my-btn--${variant}`, `my-btn--${size}`, { 'my-btn--block': block }]"
    :disabled="disabled"
    :type="type"
    @click="handleClick"
  >
    <span v-if="loading" class="my-btn__spinner" aria-hidden="true"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
// ============================================================================
// MyButton - 基于 tdesign 设计语言二次封装的按钮
// ----------------------------------------------------------------------------
// 与原生 tdesign Button 的差异：
//   1. API 简化：只暴露常用 variant/size，不暴露 50+ props
//   2. 样式走 --my-* CSS 变量，运行时可换肤
//   3. 内置 loading 旋转动画
// ============================================================================
type Variant = 'primary' | 'outline' | 'ghost' | 'text'
type Size = 'sm' | 'md' | 'lg'
type NativeType = 'button' | 'submit' | 'reset'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  disabled?: boolean
  loading?: boolean
  block?: boolean
  type?: NativeType
}>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  type: 'button'
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<style lang="scss" scoped>
.my-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--my-spacing-xs);
  border: 1px solid transparent;
  border-radius: var(--my-radius-default);
  cursor: pointer;
  font-weight: 500;
  line-height: 1.4;
  transition: all 0.2s ease;
  user-select: none;
  white-space: nowrap;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  // 尺寸
  &--sm { padding: 4px 12px; font-size: 12px; }
  &--md { padding: 6px 16px; font-size: 14px; }
  &--lg { padding: 8px 20px; font-size: 16px; }

  &--block { display: flex; width: 100%; }

  // 变体
  &--primary {
    background-color: var(--my-brand-color);
    color: #fff;
    &:hover:not(:disabled) { background-color: var(--my-brand-color-hover); }
    &:active:not(:disabled) { background-color: var(--my-brand-color-active); }
  }

  &--outline {
    background-color: transparent;
    border-color: var(--my-brand-color);
    color: var(--my-brand-color);
    &:hover:not(:disabled) { background-color: var(--my-brand-color-1, rgba(43,108,255,0.08)); }
  }

  &--ghost {
    background-color: transparent;
    color: var(--my-text-color-primary);
    &:hover:not(:disabled) { background-color: rgba(0,0,0,0.04); }
  }

  &--text {
    background-color: transparent;
    padding-left: 4px;
    padding-right: 4px;
    color: var(--my-brand-color);
    &:hover:not(:disabled) { opacity: 0.8; }
  }
}

.my-btn__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: my-btn-spin 0.6s linear infinite;
}

@keyframes my-btn-spin {
  to { transform: rotate(360deg); }
}
</style>
