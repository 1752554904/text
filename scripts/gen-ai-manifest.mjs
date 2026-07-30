// 校验 ai-manifest.json 是否合法（结构 + 必填字段）
// 用法：node scripts/gen-ai-manifest.mjs
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(__dirname, '../packages/components/ai-manifest.json')

const raw = readFileSync(manifestPath, 'utf-8')
const manifest = JSON.parse(raw)

const errors = []
if (!manifest.name) errors.push('缺少 name')
if (!manifest.version) errors.push('缺少 version')
if (!Array.isArray(manifest.components)) errors.push('components 必须是数组')
else {
  manifest.components.forEach((c, i) => {
    if (!c.name) errors.push(`components[${i}] 缺少 name`)
    if (!c.description) errors.push(`components[${i}] (${c.name || '?'}) 缺少 description`)
  })
}

if (errors.length) {
  console.error('❌ ai-manifest.json 校验失败：')
  errors.forEach(e => console.error('  - ' + e))
  process.exit(1)
}

console.log(`✅ ai-manifest.json 校验通过，共 ${manifest.components.length} 个组件`)
manifest.components.forEach(c => console.log(`  · ${c.name} [${c.category || 'unknown'}]`))
