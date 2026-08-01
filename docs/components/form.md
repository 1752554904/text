<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstanceFunctions, FormRule } from 'tdesign-vue-next'

const formData = reactive({
  name: '',
  account: '',
})

const rules: Record<string, FormRule[]> = {
  name: [{ required: true, message: '请输入姓名', type: 'error' }],
  account: [
    { required: true, message: '请输入账号', type: 'error' },
    { min: 4, message: '账号至少 4 个字符', type: 'warning' },
  ],
}

const formRef = ref<FormInstanceFunctions>()

const onSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid === true) {
    alert('校验通过：' + JSON.stringify(formData))
  }
}

const onReset = () => {
  formRef.value?.reset()
}
</script>

# Form 表单

基于 [TDesign Form](https://tdesign.tencent.com/vue-next/components/form) 封装，`MyForm` 与 `MyFormItem` 配合使用，校验规则、方法均与 TDesign 一致。

## 带校验的表单

<div class="demo">
  <MyForm ref="formRef" :data="formData" :rules="rules" label-width="80px" style="width: 420px">
    <MyFormItem label="姓名" name="name">
      <MyInput v-model="formData.name" placeholder="请输入姓名" />
    </MyFormItem>
    <MyFormItem label="账号" name="account">
      <MyInput v-model="formData.account" placeholder="请输入账号" />
    </MyFormItem>
    <MyFormItem>
      <MyButton theme="primary" @click="onSubmit">提交</MyButton>
      <MyButton variant="base" style="margin-left: 12px" @click="onReset">重置</MyButton>
    </MyFormItem>
  </MyForm>
</div>

## API

- `MyForm` props / 方法见 [TDesign Form](https://tdesign.tencent.com/vue-next/components/form#form-%E5%B1%9E%E6%80%A7)
- `MyFormItem` props 见 [TDesign FormItem](https://tdesign.tencent.com/vue-next/components/form#formitem-%E5%B1%9E%E6%80%A7)

<style scoped>
.demo {
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--td-border-level-2-color, #e7e7e7);
  border-radius: 6px;
}
</style>
