// P5-3 精灵缺失断言：校验 src/assets.js 的 files 清单对应的 PNG 是否全部存在。
// 缺失即 exit 1（显式门禁，不接 prebuild，不阻断日常构建/发版）。
// 反向检查 public/assets 下未被清单引用的 PNG（孤儿，如 sk_* 技能图标），仅提示不阻断。
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const assetsJs = join(root, 'src', 'assets.js');
const assetsDir = join(root, 'public', 'assets');

const src = readFileSync(assetsJs, 'utf8');
const start = src.indexOf('const files = {');
if (start < 0) { console.error('✗ 无法定位 assets.js 的 files 清单'); process.exit(2); }
const end = src.indexOf('};', start);
if (end < 0) { console.error('✗ 无法定位 files 清单结束'); process.exit(2); }
const block = src.slice(start, end + 2);

// 提取清单条目：key: 'value.png'
const re = /(\w+):\s*'([^']+\.png)'/g;
let m;
const entries = [];
while ((m = re.exec(block)) !== null) entries.push({ key: m[1], file: m[2] });

// 正向：清单每项 PNG 必须存在
let missing = 0;
const lines = [];
for (const { key, file } of entries) {
  if (existsSync(join(assetsDir, file))) {
    lines.push(`OK      ${key.padEnd(20)} ${file}`);
  } else {
    missing += 1;
    lines.push(`MISSING ${key.padEnd(20)} ${file}`);
  }
}

// 反向：public/assets 下 PNG 是否都被清单引用（孤儿资源，仅提示不阻断）
const onDisk = new Set(readdirSync(assetsDir).filter((f) => f.endsWith('.png')));
const referenced = new Set(entries.map((e) => e.file));
const orphans = [...onDisk].filter((f) => !referenced.has(f) && !f.startsWith('sk_'));

console.log(`精灵清单校验：共 ${entries.length} 项`);
console.log(lines.join('\n'));
if (orphans.length) {
  console.log(`\n提示：未纳入清单的 PNG（孤儿，不阻断）：${orphans.join(', ')}`);
}

if (missing > 0) {
  console.error(`\n✗ ${missing} 个精灵资源缺失（见上方 MISSING）`);
  process.exit(1);
}
console.log(`\n✓ 全部 ${entries.length} 个精灵资源存在，无缺失`);
process.exit(0);
