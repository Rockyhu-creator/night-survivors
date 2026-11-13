#!/usr/bin/env bash
# ==============================================================================
# 《夜裔幸存者》Night Survivors —— 腾讯云轻量应用服务器 Lighthouse 部署脚本
#
# ⚠️ 2026-10-08 前提修正：产品已从「云服务器 CVM」更正为
#    「轻量应用服务器 Lighthouse」（实例 lhins-475yjttw / 上海 / Ubuntu 22.04）。
#    端口放行走轻量控制台左侧「防火墙」标签页（轻量没有「安全组」概念）。
#
# ------------------------------------------------------------------------------
# 四种模式（互斥，必须且只能选一个）
#
#   --init        【全新机器首次初始化】装 nginx/rsync → 建 releases/ 骨架 →
#                 写入「阶段一 HTTP-only」nginx 配置 → nginx -t → enable --now
#                 ⚠️ 不构建、不上传；⚠️ 不改系统防火墙（轻量在控制台侧放行）
#   --http-only   【阶段一发版】构建 → 上传 → 切 current → 写入阶段一配置 → HTTP 冒烟
#                 （重装后第一次上线走这个：先把 HTTP 跑通，再拿证书）
#   --https       【阶段二发版】构建 → 上传 → 切 current → certbot webroot 拿证 →
#                 写入阶段二 HTTPS 配置 → nginx -t → reload → HTTPS 冒烟
#   （无模式参数）【日常发版】构建 → 上传 → 切 current → nginx -t → reload → 冒烟
#                 不改动服务器上的 nginx 配置（已稳定上线后用这个）
#
# 典型首次上线顺序（顺序不能反）：
#   1) 轻量控制台重装 Ubuntu 22.04 + 绑定 SSH 密钥 + 防火墙放行 22/80/443
#   2) bash docs/deploy/deploy.sh --init --dry-run
#   3) bash docs/deploy/deploy.sh --init
#   4) bash docs/deploy/deploy.sh --http-only --dry-run  &&  bash docs/deploy/deploy.sh --http-only
#   5) 浏览器/curl 验证 HTTP 站点可访问（含微信验证文件）
#   6) export CERTBOT_EMAIL=you@example.com
#      bash docs/deploy/deploy.sh --https --skip-build     # 复用第 4 步已上传的产物
#   7) 验证 HTTPS + certbot renew --dry-run
#
# 用法：
#   export SERVER_IP="1.2.3.4"          # 轻量实例公网 IP（重装后以控制台实际值为准）
#   export SSH_USER="ubuntu"            # Ubuntu 22.04 镜像默认 ubuntu；重装有 root 则用 root
#   export SSH_PORT="22"                # 可选，默认 22
#   export DOMAIN="example.com"
#   export REMOTE_DIR="/var/www/night-survivors"   # 可选，默认值如上
#   export CERTBOT_EMAIL="you@example.com"         # 仅 --https 需要
#
# 可选参数：
#   --dry-run       只打印远程命令，不上传/不写配置/不 reload（本地仍会构建+校验）
#   --skip-build    跳过本地构建，直接上传现有 .ns-build-2x/
#   --skip-reload   上传并切软链接，但不 reload nginx
#   -h / --help     显示帮助
#
# 配套文档：docs/deploy/tencent-lighthouse-deploy.md
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# 配置（全部可环境变量覆盖）
# ------------------------------------------------------------------------------
SERVER_IP="${SERVER_IP:-YOUR_SERVER_IP}"
SSH_USER="${SSH_USER:-YOUR_SSH_USER}"
SSH_PORT="${SSH_PORT:-22}"
DOMAIN="${DOMAIN:-YOUR_DOMAIN}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/night-survivors}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"         # 可选：附加域名列表（空格分隔），如 "ns.example.com game2.example.com"；
                                           # 会追加到 nginx server_name 与 certbot -d，实现一机多站/一证多域（v5.0 多游戏规划）
REMOTE_SUDO="${REMOTE_SUDO:-sudo}"          # 若已是 root，可设为 ""
KEEP_RELEASES="${KEEP_RELEASES:-5}"         # 服务器上保留几份历史 release（回滚用）
LOCAL_OUT="${LOCAL_OUT:-.ns-build-2x}"      # 红线：不要改成 dist
WECHAT_TXT="f3cf20e70ac09eb3e2c94fba4342e616.txt"
EXPECTED_WECHAT_BODY="25e8d922468d22341497499f1ee07c2c6ee7beb6"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-YOUR_EMAIL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NGINX_TEMPLATE="${NGINX_TEMPLATE:-${SCRIPT_DIR}/nginx-night-survivors.conf}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/night-survivors.conf}"
CERT_LIVE_DIR="${CERT_LIVE_DIR:-/etc/letsencrypt/live/${DOMAIN}}"
PLACEHOLDER_RELEASE="00000000-placeholder"

MODE="deploy"        # init | http | https | deploy
DRY_RUN=0
SKIP_BUILD=0
SKIP_RELOAD=0

SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=30)

# ------------------------------------------------------------------------------
# 工具函数
# ------------------------------------------------------------------------------
c_reset=''; c_red=''; c_green=''; c_yellow=''; c_dim=''
if [ -t 1 ]; then
  c_reset=$'\033[0m'; c_red=$'\033[31m'; c_green=$'\033[32m'
  c_yellow=$'\033[33m'; c_dim=$'\033[2m'
fi

log()  { printf '%s\n' "${c_dim}[deploy]${c_reset} $*"; }
ok()   { printf '%s\n' "${c_green}  ✓${c_reset} $*"; }
warn() { printf '%s\n' "${c_yellow}  !${c_reset} $*" >&2; }
fail() { printf '%s\n' "${c_red}  ✗${c_reset} $*" >&2; }
die()  { fail "$*"; exit 1; }

usage() {
  awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"
}

# 远程执行。DRY_RUN 时只打印。
remote() {
  local cmd="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s\n' "${c_dim}[dry-run] ssh -p ${SSH_PORT} ${SSH_USER}@${SERVER_IP} -- ${cmd}${c_reset}"
    return 0
  fi
  ssh -p "$SSH_PORT" "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$cmd"
}

# 远程静默探测（不打印、失败不中断）
remote_probe() {
  local cmd="$1"
  if [ "$DRY_RUN" -eq 1 ]; then
    return 1
  fi
  ssh -p "$SSH_PORT" "${SSH_OPTS[@]}" "${SSH_USER}@${SERVER_IP}" "$cmd" 2>/dev/null || true
}

now_ts() { date +%Y%m%d%H%M%S; }

# ------------------------------------------------------------------------------
# Nginx 配置渲染
#
# 单一事实来源 = docs/deploy/nginx-night-survivors.conf。
# 该文件里用 4 个 marker 切成三段：公共段（map）、STAGE1、STAGE2。
# STAGE2 段内每行以 "#@ " 开头（渲染标记），渲染时去掉；行首单个 "#" 的是真注释，保留。
# ------------------------------------------------------------------------------
render_nginx_conf() {
  local stage="$1"
  [ -f "$NGINX_TEMPLATE" ] || die "找不到 nginx 模板：${NGINX_TEMPLATE}"
  CONTENT="$(awk -v stage="$stage" '
    /^# >>>>> NS_STAGE1_BEGIN/ {in1=1; next}
    /^# <<<<< NS_STAGE1_END/   {in1=0; next}
    /^# >>>>> NS_STAGE2_BEGIN/ {in2=1; next}
    /^# <<<<< NS_STAGE2_END/   {in2=0; next}
    {
      if (in1) { if (stage=="stage1") print; next }
      if (in2) { if (stage=="stage2") { sub(/^#@ ?/, ""); print } next }
      print
    }
  ' "$NGINX_TEMPLATE" \
    | sed -e "s/YOUR_DOMAIN/${DOMAIN}/g" \
          -e "s#/var/www/night-survivors#${REMOTE_DIR}#g" \
          -e "s#/etc/letsencrypt/live/${DOMAIN}#${CERT_LIVE_DIR}#g")"
  # EXTRA_DOMAINS：追加到所有 server_name 行（若为空则原样不动）
  if [ -n "$EXTRA_DOMAINS" ]; then
    ESC_D="$(printf '%s' "$DOMAIN" | sed 's/\./\\./g')"
    CONTENT="$(printf '%s\n' "$CONTENT" | sed -E "s/server_name ${ESC_D} www\.${ESC_D};/server_name ${ESC_D} www.${ESC_D} ${EXTRA_DOMAINS};/g")"
  fi
  printf '%s\n' "$CONTENT"
}

# 写入远程 nginx 配置（先备份 → 写入 → nginx -t；校验失败自动回滚配置）
write_nginx_conf() {
  local stage="$1" label="$2" content ts backup
  ts="$(now_ts)"
  content="$(render_nginx_conf "$stage")"

  if [ "$DRY_RUN" -eq 1 ]; then
    local tmp="/tmp/ns-nginx-${stage}-${ts}.conf"
    printf '%s\n' "$content" > "$tmp"
    printf '%s\n' "${c_dim}[dry-run] 渲染「阶段${label}」配置 → 本地预览文件 ${tmp}${c_reset}"
    printf '%s\n' "${c_dim}[dry-run] ${REMOTE_SUDO} tee ${NGINX_CONF_PATH} > /dev/null （$(printf '%s\n' "$content" | wc -l | tr -d '[:space:]') 行）${c_reset}"
    printf '%s\n' "${c_dim}[dry-run] ${REMOTE_SUDO} nginx -t && ${REMOTE_SUDO} systemctl reload nginx${c_reset}"
    return 0
  fi

  # 备份现有配置
  backup="${NGINX_CONF_PATH}.bak.${ts}"
  remote "if [ -f '${NGINX_CONF_PATH}' ]; then ${REMOTE_SUDO} cp -a '${NGINX_CONF_PATH}' '${backup}' && echo 'backed-up ${backup}'; else echo 'no-existing-conf'; fi" \
    | sed 's/^/    /'
  ok "阶段${label}配置已备份（若原有）"

  # 写入（heredoc 走 tee，避免本地/远程引号二次转义）
  remote "${REMOTE_SUDO} tee '${NGINX_CONF_PATH}' > /dev/null <<'NS_NGINX_CONF_EOF'
${content}
NS_NGINX_CONF_EOF"
  remote "${REMOTE_SUDO} chmod 644 '${NGINX_CONF_PATH}'"
  ok "已写入 ${NGINX_CONF_PATH}（阶段${label}）"

  if ! remote "${REMOTE_SUDO} nginx -t"; then
    warn "nginx -t 失败，回滚到备份配置 ${backup}"
    remote "if [ -f '${backup}' ]; then ${REMOTE_SUDO} cp -a '${backup}' '${NGINX_CONF_PATH}'; fi"
    die "阶段${label}配置未生效，已回滚。请检查模板后重跑。"
  fi
  ok "nginx -t 通过（阶段${label}）"
}

reload_nginx() {
  if ! remote "${REMOTE_SUDO} systemctl reload nginx"; then
    warn "reload 失败（nginx 可能未在运行），尝试 restart"
    remote "${REMOTE_SUDO} systemctl restart nginx"
  fi
  ok "nginx 已平滑重载（reload，非 restart）"
}

# ------------------------------------------------------------------------------
# 参数解析
# ------------------------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --init)        MODE="init" ;;
    --http-only)   MODE="http" ;;
    --https)       MODE="https" ;;
    --dry-run)     DRY_RUN=1 ;;
    --skip-build)  SKIP_BUILD=1 ;;
    --skip-reload) SKIP_RELOAD=1 ;;
    -h|--help)     usage; exit 0 ;;
    *)             usage; die "未知参数：$1" ;;
  esac
  shift
done

case "$MODE" in
  init)   MODE_LABEL="首次初始化（--init）" ;;
  http)   MODE_LABEL="阶段一 HTTP-only（--http-only）" ;;
  https)  MODE_LABEL="阶段二 HTTPS（--https）" ;;
  deploy) MODE_LABEL="日常发版（不改动 nginx 配置）" ;;
esac

echo
log "夜裔幸存者 · 腾讯云轻量应用服务器 Lighthouse"
log "模式：${MODE_LABEL}${DRY_RUN:+  ｜  DRY-RUN（不上传 / 不写配置 / 不 reload）}"
log "目标：${SSH_USER}@${SERVER_IP}:${SSH_PORT} → ${REMOTE_DIR}"
log "域名：${DOMAIN}"
echo

# ------------------------------------------------------------------------------
# Step 0 · 前置检查
# ------------------------------------------------------------------------------
log "Step 0 前置检查"

[ "$SERVER_IP" != "YOUR_SERVER_IP" ] || die "SERVER_IP 仍是占位符，请先 export SERVER_IP=<轻量应用服务器 Lighthouse 公网 IP>"
[ "$SSH_USER"  != "YOUR_SSH_USER"  ] || die "SSH_USER 仍是占位符，请先 export SSH_USER=<SSH 用户名>"
[ "$DOMAIN"    != "YOUR_DOMAIN"    ] || die "DOMAIN 仍是占位符，请先 export DOMAIN=<已备案域名>"

command -v ssh   >/dev/null 2>&1 || die "本机缺少 ssh"
command -v curl  >/dev/null 2>&1 || warn "本机缺少 curl，最后的 HTTP 冒烟会跳过"

if [ "$MODE" = "init" ]; then
  # --init 不构建，不需要项目根目录；只需要模板文件
  [ -f "$NGINX_TEMPLATE" ] || die "找不到 nginx 模板：${NGINX_TEMPLATE}"
else
  command -v node  >/dev/null 2>&1 || die "本机缺少 node"
  command -v rsync >/dev/null 2>&1 || die "本机缺少 rsync"
  [ -f package.json ]   || die "当前目录不是项目根目录（找不到 package.json）"
  [ -f vite.config.js ] || die "当前目录不是项目根目录（找不到 vite.config.js）"
fi

if [ "$MODE" = "https" ]; then
  [ "$CERTBOT_EMAIL" != "YOUR_EMAIL" ] || die "CERTBOT_EMAIL 仍是占位符，请先 export CERTBOT_EMAIL=<你的邮箱>（Let's Encrypt 注册用）"
fi

ok "配置与工具检查通过"

# ==============================================================================
# 模式 A：--init 首次初始化（全新 Ubuntu 22.04）
#
# ⚠️ 刻意不做的事：
#   · 不改系统防火墙（ufw/iptables）—— 轻量服务器的端口放行在腾讯云控制台侧
#   · 不构建、不上传产物（那是 --http-only 的活）
#   · 不申请证书（此时还没有站点内容可验证，且 80 可能还没放行）
# ==============================================================================
if [ "$MODE" = "init" ]; then

  log "Step 1/6 SSH 连通性"
  CONN="$(remote_probe "echo OK" || true)"
  if [ "$DRY_RUN" -eq 0 ] && [ "$CONN" != "OK" ]; then
    die "SSH 连不上 ${SSH_USER}@${SERVER_IP}:${SSH_PORT} —— 常见原因：① 重装未完成 ② 轻量控制台「防火墙」未放行 22 ③ SSH 密钥未绑定（改密码登录）④ 公网 IP 变了"
  fi
  [ "$DRY_RUN" -eq 1 ] || ok "SSH 连通（${CONN}）"
  OS_REL="$(remote "cat /etc/os-release | grep -E '^(NAME|VERSION_ID)=' | tr '\n' ' '")"
  log "远端系统：${OS_REL}"

  log "Step 2/6 安装 nginx / rsync（幂等，已装则跳过）"
  remote "export DEBIAN_FRONTEND=noninteractive; ${REMOTE_SUDO} apt-get update -y && ${REMOTE_SUDO} apt-get install -y nginx rsync"
  ok "nginx / rsync 就绪"
  remote "nginx -v 2>&1 | sed 's/^/    版本：/'"

  log "Step 3/6 建立部署目录骨架（releases/ + current 软链接）"
  remote "${REMOTE_SUDO} mkdir -p '${REMOTE_DIR}/releases'"
  if [ "$SSH_USER" != "root" ]; then
    remote "${REMOTE_SUDO} chown -R '${SSH_USER}':'${SSH_USER}' '${REMOTE_DIR}'"
  fi
  # 占位 release：首次发版前访问域名会看到这个页面 —— 用来提前证明
  # 「防火墙 80 已放行 + DNS 已生效 + nginx 已起」，而不必等产物上传完。
  remote "mkdir -p '${REMOTE_DIR}/releases/${PLACEHOLDER_RELEASE}'"
  # 注意：这段 HTML 里不能出现双引号 —— 它会作为字面文本嵌进 ssh 的双引号命令串里。
  remote "cat > '${REMOTE_DIR}/releases/${PLACEHOLDER_RELEASE}/index.html' <<'NS_PLACEHOLDER_EOF'
<!doctype html>
<html><head><meta charset=utf-8><title>Night Survivors</title></head>
<body><h1>Night Survivors</h1><p>尚未部署（占位页）。看到这页说明 80 端口与 nginx 已就绪。</p></body></html>
NS_PLACEHOLDER_EOF"
  remote "ln -sfn '${REMOTE_DIR}/releases/${PLACEHOLDER_RELEASE}' '${REMOTE_DIR}/current' && readlink -f '${REMOTE_DIR}/current'"
  ok "目录骨架就绪：${REMOTE_DIR}/{releases,current}"

  log "Step 4/6 写入阶段一（HTTP-only）nginx 配置"
  write_nginx_conf "stage1" "一 · HTTP-only"

  log "Step 5/6 启动 nginx（enable --now）"
  remote "${REMOTE_SUDO} systemctl enable --now nginx"
  ACTIVE="$(remote_probe "${REMOTE_SUDO} systemctl is-active nginx" || true)"
  if [ "$DRY_RUN" -eq 0 ]; then
    [ "$ACTIVE" = "active" ] || die "nginx 未处于 active 状态（当前：${ACTIVE:-unknown}）—— 检查 journalctl -u nginx"
    ok "nginx 状态：${ACTIVE}"
  fi

  log "Step 6/6 HTTP 可达性探测（仅提示，失败不中断）"
  if [ "$DRY_RUN" -eq 0 ] && command -v curl >/dev/null 2>&1; then
    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${DOMAIN}/" || echo 000)"
    case "$CODE" in
      200) ok "http://${DOMAIN}/ → 200（占位页，说明 80 放行 + DNS + nginx 都通了）" ;;
      000) warn "http://${DOMAIN}/ 无响应 —— 检查：轻量控制台防火墙是否放行 80、DNS 是否已解析到 ${SERVER_IP}" ;;
      *)   warn "http://${DOMAIN}/ → ${CODE}（预期 200 占位页）—— 检查 DNS 与防火墙" ;;
    esac
  else
    warn "跳过 HTTP 探测（dry-run 或本机无 curl）"
  fi

  echo
  log "==================== 初始化完成 ===================="
  log "服务器已可承载站点，但**还没有产物**。下一步："
  log "  bash docs/deploy/deploy.sh --http-only --dry-run"
  log "  bash docs/deploy/deploy.sh --http-only"
  echo
  log "⚠️ 待办清单（人工，脚本不会代劳）："
  log "  1. 轻量控制台 → 实例详情 → 左侧「防火墙」标签页 → 放行 TCP 22 / 80 / 443"
  log "     （⚠️ 轻量没有「安全组」，别去 CVM 的安全组页面找；脚本不会改系统 ufw/iptables）"
  log "  2. 确认域名 A 记录已指向 ${SERVER_IP}（dig +short ${DOMAIN}）"
  log "  3. 确认域名已备案且接入腾讯云（未接入可能被阻断 80/443）"
  log "  4. 若仍用密码登录，建议补绑 SSH 密钥后关闭密码登录"
  log "  5. 可选：sudo rm -f /etc/nginx/sites-enabled/default（避免用 IP 直接访问时落到默认欢迎页）"
  echo
  exit 0
fi

# ==============================================================================
# 模式 B/C/D：--http-only / --https / 日常发版
# ==============================================================================

# ------------------------------------------------------------------------------
# Step 1 · 本地构建
# ------------------------------------------------------------------------------
log "Step 1/7 本地构建"

if [ "$SKIP_BUILD" -eq 1 ]; then
  warn "已指定 --skip-build，跳过构建，直接使用现有 ${LOCAL_OUT}/"
else
  # 1a. 发布门控：技能树校验
  #     npx vite build 不会触发 package.json 的 prebuild，这里手动补齐，
  #     否则等于把技能树校验这道门控悄悄绕过去了。
  log "技能树校验（发布门控）…"
  node scripts/validate_skilltree.mjs
  ok "技能树校验通过"

  # 1b. 归档旧产物目录
  #     红线：Vite 对已存在的 outDir 会调用 emptyDir() 批量删除；本机的安全删除
  #     守卫会在文件数 > 50 时拦截，而且是"删到一半才失败"，产物会被破坏成残缺状态。
  #     mv 是 rename，不触发删除守卫 —— 必须这么做。
  if [ -d "$LOCAL_OUT" ]; then
    ARCHIVE="/tmp/ns-build-archive-$(now_ts)"
    mv "$LOCAL_OUT" "$ARCHIVE"
    ok "旧产物已归档 → ${ARCHIVE}"
  fi

  # 1c. 构建（红线命令）
  #     注入 CF_PAGES_COMMIT_SHA 让 buildId 可追溯（version.json 里能看到线上跑的是
  #     哪个 commit），同时让产物可复现 —— 不注入的话 buildId 是 Date.now()，
  #     每次构建 JS/CSS 文件名都会变，白白击穿玩家缓存。
  BUILD_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
  # 只统计「已跟踪文件的改动」，不看 untracked：
  # .ns-build-2x/ 本身未加入 .gitignore，若统计 untracked 则每次都是 dirty，标记就失去意义。
  if [ -n "$(git status --porcelain --untracked-files=no 2>/dev/null || true)" ]; then
    BUILD_SHA="${BUILD_SHA}-dirty"
    warn "工作区有未提交改动，buildId 标记为 ${BUILD_SHA}"
  fi
  log "构建（buildId=${BUILD_SHA}）…"
  CF_PAGES_COMMIT_SHA="$BUILD_SHA" npx vite build --outDir "$LOCAL_OUT"
  ok "构建完成 → ${LOCAL_OUT}/"
fi

# ------------------------------------------------------------------------------
# Step 2 · 本地产物完整性校验（任一失败立即 exit 1，绝不上传残缺产物）
# ------------------------------------------------------------------------------
log "Step 2/7 本地产物校验"

[ -f "${LOCAL_OUT}/index.html" ] || die "产物缺少 index.html —— 构建失败，中止"
ok "index.html 存在"

PNG_COUNT="$(find "${LOCAL_OUT}/assets" -maxdepth 1 -name '*.png' 2>/dev/null | wc -l | tr -d '[:space:]')"
[ "${PNG_COUNT}" -gt 0 ] || die "assets/ 下没有 PNG —— 中止"
ok "assets/ 下 PNG：${PNG_COUNT} 张（基线 165，新增资产会递增）"

[ -f "${LOCAL_OUT}/${WECHAT_TXT}" ] || die "产物缺少微信域名验证文件 ${WECHAT_TXT} —— 微信内会被风控拦截，中止"
WECHAT_BODY="$(tr -d '[:space:]' < "${LOCAL_OUT}/${WECHAT_TXT}")"
[ -n "$WECHAT_BODY" ] || die "${WECHAT_TXT} 内容为空 —— 中止"
if [ "$WECHAT_BODY" != "$EXPECTED_WECHAT_BODY" ]; then
  warn "${WECHAT_TXT} 内容为 '${WECHAT_BODY}'，与预期 '${EXPECTED_WECHAT_BODY}' 不一致，请人工确认"
else
  ok "微信域名验证文件存在（${WECHAT_BODY}）"
fi

[ -f "${LOCAL_OUT}/version.json" ] || die "产物缺少 version.json —— 中止"
ok "version.json 存在：$(tr -d '\n' < "${LOCAL_OUT}/version.json")"

# 无 dist/ 依赖：产物必须是根绝对路径，不能指向 dist
if grep -q '/dist/' "${LOCAL_OUT}/index.html" 2>/dev/null; then
  die "index.html 里存在 /dist/ 依赖 —— 说明构建输出错了，中止"
fi
ok "index.html 无 dist/ 依赖"

# 入口必须是根绝对路径（保证挂在域名根目录可用）
grep -q 'src="/assets/' "${LOCAL_OUT}/index.html" || die "index.html 未引用 /assets/ 根路径资源 —— 中止"
ok "资源使用根绝对路径 /assets/"

# ------------------------------------------------------------------------------
# Step 3 · 上传到服务器的独立 release 目录
# ------------------------------------------------------------------------------
RELEASE="$(date +%Y%m%d-%H%M%S)"
REMOTE_RELEASE="${REMOTE_DIR}/releases/${RELEASE}"

log "Step 3/7 上传到 ${REMOTE_RELEASE}"

remote "mkdir -p '${REMOTE_DIR}/releases' '${REMOTE_RELEASE}'"
ok "远程 release 目录已就绪：${REMOTE_RELEASE}"

if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s\n' "${c_dim}[dry-run] rsync -az --delete --exclude .git/src/node_modules ${LOCAL_OUT}/ → ${SSH_USER}@${SERVER_IP}:${REMOTE_RELEASE}/${c_reset}"
else
  rsync -az --delete \
    --exclude '.git' --exclude 'src' --exclude 'node_modules' --exclude '.DS_Store' \
    -e "ssh -p ${SSH_PORT} ${SSH_OPTS[*]}" \
    "${LOCAL_OUT}/" "${SSH_USER}@${SERVER_IP}:${REMOTE_RELEASE}/"
  ok "rsync 完成"
fi

# ------------------------------------------------------------------------------
# Step 4 · 远程复核（关键：微信验证文件是否真的到了服务器）
# ------------------------------------------------------------------------------
log "Step 4/7 远程产物复核"

if [ "$DRY_RUN" -eq 1 ]; then
  warn "DRY-RUN：跳过远程复核"
else
  REMOTE_CHECK="$(remote "
    set -e
    test -f '${REMOTE_RELEASE}/index.html' || { echo 'MISSING index.html'; exit 1; }
    test -f '${REMOTE_RELEASE}/${WECHAT_TXT}' || { echo 'MISSING ${WECHAT_TXT}'; exit 1; }
    printf 'OK %s %s %s\n' \"\$(ls -1 '${REMOTE_RELEASE}/assets' | grep -c '\.png\$' || true)\" \"\$(cat '${REMOTE_RELEASE}/${WECHAT_TXT}')\" \"\$(cat '${REMOTE_RELEASE}/version.json' | tr -d '\n')\"
  ")"
  log "远程：${REMOTE_CHECK}"
  case "$REMOTE_CHECK" in
    OK*) ok "远程产物完整（index.html / ${WECHAT_TXT} / PNG）" ;;
    *)   die "远程产物校验失败：${REMOTE_CHECK} —— 未切换 current 软链接，线上仍是旧版本" ;;
  esac

  REMOTE_PNG="$(printf '%s' "$REMOTE_CHECK" | awk '{print $2}')"
  [ "${REMOTE_PNG}" -gt 0 ] || die "远程 assets/ 下 PNG 数为 0 —— 中止"
  ok "远程 PNG 数量：${REMOTE_PNG}"
fi

# ------------------------------------------------------------------------------
# Step 5 · 切换 current 软链接
# ------------------------------------------------------------------------------
log "Step 5/7 切换 current 软链接"

PREV_RELEASE=""
if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s\n' "${c_dim}[dry-run] ln -sfn ${REMOTE_RELEASE} ${REMOTE_DIR}/current${c_reset}"
else
  PREV_RELEASE="$(remote "readlink -f '${REMOTE_DIR}/current' 2>/dev/null || echo ''")"
  remote "ln -sfn '${REMOTE_RELEASE}' '${REMOTE_DIR}/current' && readlink -f '${REMOTE_DIR}/current'"
  ok "current → ${REMOTE_RELEASE}"
  if [ -n "$PREV_RELEASE" ]; then
    log "上一版：${PREV_RELEASE}（保留在服务器上，可直接回滚）"
  else
    warn "没有上一版（首次部署）—— 本机 releases/ 只有这一份，出问题只能重新构建"
  fi
fi

# ------------------------------------------------------------------------------
# Step 6 · nginx 配置与重载（按模式分三种走法）
# ------------------------------------------------------------------------------
log "Step 6/7 Nginx 配置与重载"

case "$MODE" in
  http)
    write_nginx_conf "stage1" "一 · HTTP-only"
    if [ "$SKIP_RELOAD" -eq 1 ]; then
      warn "已指定 --skip-reload，配置已写入但未 reload，需手工 reload 才生效"
    else
      reload_nginx
    fi
    ;;

  https)
    # 6a. 若证书还不存在，先把阶段一（HTTP-only）顶上去，
    #     否则 webroot 挑战没有 server 块可用，certbot 必然失败。
    #     （证书已存在时不要切回 HTTP，避免短暂降级）
    CERT_EXISTS="$(remote_probe "${REMOTE_SUDO} test -f '${CERT_LIVE_DIR}/fullchain.pem' && echo yes || echo no" || true)"
    if [ "$CERT_EXISTS" != "yes" ]; then
      log "证书不存在 → 先切阶段一（HTTP-only），为 certbot HTTP-01 挑战让出 80 通道"
      write_nginx_conf "stage1" "一 · HTTP-only"
      reload_nginx

      # 6b. 拿证前自检：80 必须能从公网访问（这是 certbot 唯一的硬前置；
      #     ⚠️ 443 不是 certbot 的前置，而是"切 HTTPS 后对外服务"的前置，别混淆）
      if [ "$DRY_RUN" -eq 0 ] && command -v curl >/dev/null 2>&1; then
        CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${DOMAIN}/" || echo 000)"
        if [ "$CODE" = "200" ]; then
          ok "http://${DOMAIN}/ → 200（80 可达，certbot 具备拿证条件）"
        else
          warn "http://${DOMAIN}/ → ${CODE}（期望 200）—— certbot 很可能失败。"
          warn "  排查顺序：① 轻量控制台防火墙放行 80 ② dig ${DOMAIN} 是否解析到 ${SERVER_IP} ③ nginx 是否在跑 ④ 阶段一配置是否已 reload"
        fi
      fi
    else
      ok "证书已存在：${CERT_LIVE_DIR}/fullchain.pem（跳过阶段一切换，避免降级）"
    fi

    # 6c. 安装 certbot（Ubuntu 22.04：snap 优先，apt 源里是 1.21.0 旧包）
    log "检查/安装 certbot…"
    remote "if command -v certbot >/dev/null 2>&1; then echo 'certbot-exists'; else ${REMOTE_SUDO} snap install --classic certbot && ${REMOTE_SUDO} ln -sf /snap/bin/certbot /usr/bin/certbot; fi"
    CB_VER="$(remote_probe "certbot --version 2>/dev/null | awk '{print \$2}'" || true)"
    if [ -n "$CB_VER" ]; then
      case "$CB_VER" in
        1.*) warn "certbot 版本 ${CB_VER}（apt 旧包）。建议：sudo apt remove -y certbot && sudo snap install --classic certbot" ;;
        *)   ok "certbot 版本 ${CB_VER}" ;;
      esac
    fi

    # 6d. webroot 拿证（幂等；--keep-until-expiring 保证未到期不重复签发）
    log "certbot webroot 拿证…"
    CB_DOMAIN_ARGS="-d '${DOMAIN}' -d 'www.${DOMAIN}'"
    for d in $EXTRA_DOMAINS; do CB_DOMAIN_ARGS="$CB_DOMAIN_ARGS -d '$d'"; done
    remote "${REMOTE_SUDO} certbot certonly --webroot -w '${REMOTE_DIR}/current' ${CB_DOMAIN_ARGS} --agree-tos -m '${CERTBOT_EMAIL}' --no-eff-email --keep-until-expiring --non-interactive"
    if [ "$DRY_RUN" -eq 0 ]; then
      # /etc/letsencrypt/live 目录权限 700（root only），必须 sudo 检查，否则已签发也误判失败（2026-11-12 实测踩坑）
      [ "$(remote_probe "${REMOTE_SUDO} test -f '${CERT_LIVE_DIR}/fullchain.pem' && echo yes || echo no")" = "yes" ] \
        || die "证书未生成：${CERT_LIVE_DIR}/fullchain.pem 不存在 —— certbot 失败，未切换 HTTPS 配置"
      ok "证书就位：${CERT_LIVE_DIR}/fullchain.pem"
    fi

    # 6e. 切阶段二
    write_nginx_conf "stage2" "二 · HTTPS"
    if [ "$SKIP_RELOAD" -eq 1 ]; then
      warn "已指定 --skip-reload，HTTPS 配置已写入但未 reload，线上仍是 HTTP"
    else
      reload_nginx
    fi
    ;;

  deploy)
    if [ "$SKIP_RELOAD" -eq 1 ]; then
      warn "已指定 --skip-reload，跳过 nginx 重载（线上仍指向旧版本，需手工 reload）"
    else
      remote "${REMOTE_SUDO} nginx -t" || die "远程 nginx -t 失败 —— 配置有问题。已上传但未生效，请修正 ${NGINX_CONF_PATH} 后手工 reload"
      ok "nginx -t 通过"
      reload_nginx
    fi
    ;;
esac

# ------------------------------------------------------------------------------
# Step 7 · 冒烟 + 清理旧 release
# ------------------------------------------------------------------------------
log "Step 7/7 上线冒烟与清理"

SMOKE_SCHEME="https"
[ "$MODE" = "http" ] && SMOKE_SCHEME="http"

if [ "$DRY_RUN" -eq 1 ] || [ "$SKIP_RELOAD" -eq 1 ]; then
  warn "跳过冒烟"
else
  if command -v curl >/dev/null 2>&1; then
    smoke() {
      local path="$1" expect="$2"
      local code
      code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -L "${SMOKE_SCHEME}://${DOMAIN}${path}" || echo 000)"
      if [ "$code" = "$expect" ]; then
        ok "${SMOKE_SCHEME}://${DOMAIN}${path} → ${code}"
      else
        fail "${SMOKE_SCHEME}://${DOMAIN}${path} → ${code}（期望 ${expect}）"
        return 1
      fi
    }
    smoke "/"                 "200" || true
    smoke "/${WECHAT_TXT}"    "200" || true
    smoke "/version.json"     "200" || true
    smoke "/assets/icon_skull.png" "200" || true
    smoke "/fonts/PressStart2P.woff2" "200" || true

    BODY="$(curl -s --max-time 15 "${SMOKE_SCHEME}://${DOMAIN}/${WECHAT_TXT}" || true)"
    if [ "$(printf '%s' "$BODY" | tr -d '[:space:]')" = "$EXPECTED_WECHAT_BODY" ]; then
      ok "微信验证文件线上可读且内容正确"
    else
      warn "微信验证文件线上内容不符：'$(printf '%s' "$BODY" | tr -d '[:space:]')'"
    fi

    if [ "$MODE" = "http" ]; then
      # 阶段一专属自检：ACME 挑战通道必须命中 location（返回 404 = location 生效；
      # 返回 301 = 被跳转吞掉，certbot 会失败）
      ACME_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${DOMAIN}/.well-known/acme-challenge/probe" || echo 000)"
      if [ "$ACME_CODE" = "404" ]; then
        ok "ACME 挑战通道就绪（/.well-known/acme-challenge/probe → 404，location 已命中）"
      else
        warn "ACME 挑战通道异常（→ ${ACME_CODE}，期望 404）—— certbot HTTP-01 会失败，别急着跑 --https"
      fi

      # 阶段一专属自检：确认 HTTP 没有被 301 掉（说明阶段一配置真的生效）
      HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${DOMAIN}/" || echo 000)"
      [ "$HTTP_CODE" = "200" ] || warn "http://${DOMAIN}/ → ${HTTP_CODE}（期望 200，若是 301 说明阶段二配置还挂着）"
    fi

    if [ "$MODE" = "https" ]; then
      # 阶段二专属自检：HTTP → HTTPS 301 + 续期链路
      R_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${DOMAIN}/" || echo 000)"
      R_URL="$(curl -s -o /dev/null -w '%{redirect_url}' --max-time 10 "http://${DOMAIN}/" || true)"
      if [ "$R_CODE" = "301" ]; then
        ok "HTTP → HTTPS 跳转：301 → ${R_URL}"
      else
        warn "HTTP 未 301 跳转（→ ${R_CODE}），检查阶段二 80 server 块是否生效"
      fi
      remote "${REMOTE_SUDO} certbot renew --dry-run" || warn "certbot renew --dry-run 未通过 —— 续期链路有隐患，请排查（不影响当前上线）"
    fi
  fi
fi

# 清理超过 KEEP_RELEASES 的旧 release（只删符合时间戳命名规范的目录，占位版不删）
if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s\n' "${c_dim}[dry-run] 清理超过 ${KEEP_RELEASES} 份的旧 release${c_reset}"
else
  OLD_LIST="$(remote "ls -1 '${REMOTE_DIR}/releases' 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{6}\$' | sort -r | tail -n +$((KEEP_RELEASES + 1))" || true)"
  if [ -n "$OLD_LIST" ]; then
    while IFS= read -r d; do
      [ -n "$d" ] || continue
      remote "rm -rf -- '${REMOTE_DIR}/releases/${d}'"
      log "已清理旧 release：${d}"
    done <<< "$OLD_LIST"
  else
    log "无需清理（当前保留 ${KEEP_RELEASES} 份以内）"
  fi
fi

# ------------------------------------------------------------------------------
# 汇总
# ------------------------------------------------------------------------------
echo
log "==================== 部署完成 ===================="
log "模式：${MODE_LABEL}"
log "版本目录：${REMOTE_RELEASE}"
log "线上入口：${SMOKE_SCHEME}://${DOMAIN}/"
log "版本自检：curl -s ${SMOKE_SCHEME}://${DOMAIN}/version.json"
echo
if [ "$MODE" = "http" ]; then
  log "⚠️ 当前是 HTTP-only（阶段一），仅供验证与拿证，不要长期对外。"
  log "下一步（确认 HTTP 全绿后）："
  log "  export CERTBOT_EMAIL=<你的邮箱>"
  log "  bash docs/deploy/deploy.sh --https --skip-build"
fi
if [ "$MODE" = "https" ]; then
  log "⚠️ 轻量控制台「防火墙」必须已放行 443，否则玩家打不开（证书拿到了也白搭）。"
  log "  验证：nc -vz ${SERVER_IP} 443"
fi
echo
log "回滚（改软链接即可，10 秒内生效，无需重新构建）："
log "  ssh -p ${SSH_PORT} ${SSH_USER}@${SERVER_IP} \\"
if [ -n "$PREV_RELEASE" ]; then
  log "    \"ln -sfn ${PREV_RELEASE} ${REMOTE_DIR}/current && ${REMOTE_SUDO} nginx -t && ${REMOTE_SUDO} systemctl reload nginx\""
else
  log "    \"ln -sfn ${REMOTE_DIR}/releases/<PREV_TIMESTAMP> ${REMOTE_DIR}/current && ${REMOTE_SUDO} nginx -t && ${REMOTE_SUDO} systemctl reload nginx\""
  log "  （可用版本列表：ssh -p ${SSH_PORT} ${SSH_USER}@${SERVER_IP} 'ls -1t ${REMOTE_DIR}/releases'）"
  log "  ⚠️ 全新机器首个版本没有历史可回滚 —— 出问题只能修好重新构建上传"
fi
echo
log "剩余必做人工验证：微信内真机打开 + 开局看贴图（curl 过不代表微信 X5 内核过）"
echo
