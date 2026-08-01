# Button 按钮

基于 [TDesign Button](https://tdesign.tencent.com/vue-next/components/button) 封装，props / 事件 / 插槽与上游完全一致，并自动应用公司主题。

## 基础用法

<div class="demo">
  <MyButton>默认按钮</MyButton>
  <MyButton theme="primary">主要按钮</MyButton>
  <MyButton theme="success">成功按钮</MyButton>
  <MyButton theme="warning">警告按钮</MyButton>
  <MyButton theme="danger">危险按钮</MyButton>
</div>

## 形状与尺寸

<div class="demo">
  <MyButton theme="primary" shape="round">圆角按钮</MyButton>
  <MyButton theme="primary" shape="circle">T</MyButton>
  <MyButton theme="primary" size="small">小</MyButton>
  <MyButton theme="primary" size="medium">中</MyButton>
  <MyButton theme="primary" size="large">大</MyButton>
</div>

## 图标按钮

<div class="demo">
  <MyButton theme="primary" :icon="() => '🔍'">搜索</MyButton>
  <MyButton variant="outline" :icon="() => '⬇'">下载</MyButton>
</div>

## 禁用与加载

<div class="demo">
  <MyButton theme="primary" disabled>禁用</MyButton>
  <MyButton theme="primary" loading>加载中</MyButton>
</div>

## API

完整 props 见 [TDesign Button 文档](https://tdesign.tencent.com/vue-next/components/button#button-%E5%B1%9E%E6%80%A7)。

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
