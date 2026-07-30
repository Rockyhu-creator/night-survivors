import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// 构建版本号，用于美术图 URL 缓存击穿（?v=BUILD_ID）。
// Cloudflare Pages 在构建时自动注入 CF_PAGES_COMMIT_SHA（每次 push 必变），
// 本地 dev/build 无该变量时 fallback 为 Date.now()，保证开发期永远拉最新图。
const buildId = process.env.CF_PAGES_COMMIT_SHA || String(Date.now());

// 资源内容哈希映射：按 public/assets/*.png 文件内容生成（sha256 前 8 位 hex），
// 用于美术图 URL 精准缓存（?v=<内容哈希>）。仅文件内容变化时哈希才变，
// 避免原 BUILD_ID 每次 push 全量失效导致的缓存击穿（更新后进度条慢的根因）。
function buildAssetHashes() {
  const dir = resolve(process.cwd(), 'public', 'assets');
  const map = {};
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return map;
  }
  for (const name of entries) {
    if (!name.toLowerCase().endsWith('.png')) continue;
    const buf = readFileSync(resolve(dir, name));
    map[name] = createHash('sha256').update(buf).digest('hex').slice(0, 8);
  }
  return map;
}
const assetHashes = buildAssetHashes();

// 运行时版本自检：把 {buildId, commit, builtAt} 写入 dist/version.json。
// 复用模块级 buildId —— 与 __BUILD_ID__（define 注入）同源，杜绝比对错位。
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    apply: 'build', // 仅 build 生效；dev 不写文件（fetch 自然 404 → 静默跳过）
    writeBundle(options) {
      const outDir = options.dir; // 解析后的 outDir（默认 'dist'）
      const payload = JSON.stringify(
        {
          buildId,
          commit: buildId, // CF 环境即 commit SHA；本地与 buildId 同源
          builtAt: new Date().toISOString(),
        },
        null,
        2,
      );
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'version.json'), payload);
    },
  };
}

export default defineConfig({
  // 仅注入构建版本号，不改动 Vite 其他默认行为（项目一直是零配置运行）。
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __ASSET_HASHES__: JSON.stringify(assetHashes),
  },
  plugins: [emitVersionJson()],
});
