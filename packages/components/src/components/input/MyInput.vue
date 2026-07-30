<template>
  <div :class="['my-input', { 'my-input--focused': isFocused, 'my-input--disabled': disabled }]">
    <span v-if="$slots.prefix" class="my-input__prefix"><slot name="prefix" /></span>
    <input
      ref="inputRef"
      class="my-input__inner"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      @input="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    />
    <span v-if="$slots.suffix" class="my-input__suffix"><slot name="suffix" /></span>
  </div>
</template>

<script setup lang="ts">
// ============================================================================
// MyInput - 极简风格输入框，二次封装 tdesign 设计语言
// ============================================================================
import { ref } from 'vue'

type InputType = 'text' | 'password' | 'number' | 'email' | 'tel'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: InputType
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  maxlength?: number
}>(), {
  type: 'text',
  disabled: false,
  readonly: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus', event: FocusEvent): void
  (e: 'blur', event: FocusEvent): void
}>()

const inputRef = ref<HTMLInputElement>()
const isFocused = ref(false)

function handleInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
function handleFocus(event: FocusEvent) {
  isFocused.value = true
  emit('focus', event)
}
function handleBlur(event: FocusEvent) {
  isFocused.value = false
  emit('blur', event)
}

defineExpose({ focus: () => inputRef.value?.focus() })
</script>

<style lang="scss" scoped>
.my-input {
  display: inline-flex;
  align-items: center;
  width: 100%;
  padding: 4px 12px;
  background-color: var(--my-bg-color-container);
  border: 1px solid var(--my-border-color);
  border-radius: var(--my-radius-default);
  transition: border-color 0.2s, box-shadow 0.2s;

  &--focused {
    border-color: var(--my-brand-color);
    box-shadow: 0 0 0 2px rgba(43, 108, 255, 0.2);
  }
  &--disabled {
    background-color: var(--my-bg-color-page);
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.my-input__inner {
  flex: 1;
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--my-text-color-primary);
  font-size: 14px;
  line-height: 1.6;

  &::placeholder {
    color: var(--my-text-color-placeholder);
  }
  &:disabled {
    cursor: not-allowed;
  }
}

.my-input__prefix,
.my-input__suffix {
  display: inline-flex;
  align-items: center;
  color: var(--my-text-color-secondary);
}
.my-input__prefix { margin-right: 8px; }
.my-input__suffix { margin-left: 8px; }
</style>
