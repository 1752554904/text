<script setup lang="ts">
import { ref } from 'vue'

const value = ref('')
const password = ref('123456')
</script>

# Input 输入框

基于 [TDesign Input](https://tdesign.tencent.com/vue-next/components/input) 封装，支持 `v-model`。

## 基础用法

<div class="demo">
  <MyInput v-model="value" placeholder="请输入内容" style="width: 240px" />
  <span>当前值：{{ value }}</span>
</div>

## 不同状态

<div class="demo">
  <MyInput placeholder="默认" style="width: 200px" />
  <MyInput placeholder="只读" readonly style="width: 200px" />
  <MyInput placeholder="禁用" disabled style="width: 200px" />
  <MyInput placeholder="错误" status="error" style="width: 200px" />
</div>

## 密码框

<div class="demo">
  <MyInput v-model="password" type="password" style="width: 240px" />
</div>

## 前缀 / 后缀插槽

<div class="demo">
  <MyInput placeholder="搜索" style="width: 260px">
    <template #prefix>🔍</template>
    <template #suffix>
      <MyButton theme="primary" size="small">搜索</MyButton>
    </template>
  </MyInput>
</div>

## API

完整 props 见 [TDesign Input 文档](https://tdesign.tencent.com/vue-next/components/input#input-%E5%B1%9E%E6%80%A7)。

<style scoped>
.demo {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin: 16px 0;
  padding: 16px;
  border: 1px solid var(--td-border-level-2-color, #e7e7e7);
  border-radius: 6px;
}
</style>
