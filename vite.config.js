import { defineConfig } from 'vite';

// 构建版本号，用于美术图 URL 缓存击穿（?v=BUILD_ID）。
// Cloudflare Pages 在构建时自动注入 CF_PAGES_COMMIT_SHA（每次 push 必变），
// 本地 dev/build 无该变量时 fallback 为 Date.now()，保证开发期永远拉最新图。
const buildId = process.env.CF_PAGES_COMMIT_SHA || String(Date.now());

export default defineConfig({
  // 仅注入构建版本号，不改动 Vite 其他默认行为（项目一直是零配置运行）。
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
});
