# 《夜裔幸存者》腾讯云轻量应用服务器（Lighthouse）部署发布清单

> 迁移目标：从 Cloudflare Pages（`https://night-survivors.pages.dev`）→ 腾讯云**轻量应用服务器（Lighthouse）** + Nginx 静态托管
> 文档状态：**部署准备物，尚未执行任何上线动作**（未 SSH、未上传、未提交代码）
> 撰写人：路远行（发布与运维） · 任务 REL-DEPLOY-01
> 最后更新：2026-10-09（**前提修订：CVM → 轻量应用服务器 Lighthouse**）

---

## 0. 前提修订（2026-10-09）：不是 CVM，是轻量应用服务器 Lighthouse

上一版文档按「云服务器 CVM」撰写，**实际产品是腾讯云轻量应用服务器（Lighthouse）**。全文已按新前提修订。三条关键差异：

1. **端口放行的入口不同**：Lighthouse **没有「安全组」**这一层，规则在**轻量控制台 → 实例详情 → 左侧「防火墙」标签页**配置。文档里所有"安全组"表述已改为"**防火墙（轻量控制台）**"。
2. **实例信息**（以控制台实际值为准，重装后 IP 可能变）：
   - 实例 ID：`lhins-475yjttw`
   - 地域/可用区：上海四区
   - 套餐：入门型 2 核 / 4GB / SSD 60GB / 5Mbps
   - 公网 IP（当前观测值）：`118.89.76.27`
   - 镜像：**Ubuntu Server 22.04 LTS**（用户已决定重装，全新干净系统）
3. **独占 80/443**：原先 80 端口上跑的 Next.js 站点（Skills Store）随重装被清空 → **不再需要与任何站点共存**，本游戏独占 80/443。

> ⚠️ 当前探测到的端口状态（外部探测，重装后会变）：80 开放（跑着 Skills Store）、**22 关闭（被防火墙拦）**、443 关闭。
> 重装后用户会在控制台放行 22 与 443。**在放行完成前，SSH 连不上、certbot 也拿不到证**（详见 §3.0 与 §5）。

### 本次交付物

| 文件 | 用途 |
| --- | --- |
| `docs/deploy/tencent-lighthouse-deploy.md` | 本文件（原 `tencent-cvm-deploy.md`，已重命名 + 全文修订） |
| `docs/deploy/nginx-night-survivors.conf` | Nginx 配置模板，**已拆分为阶段一（HTTP-only）/ 阶段二（HTTPS）**，两阶段共用「单一事实来源」，由 `deploy.sh` 按 marker 渲染 |
| `docs/deploy/deploy.sh` | 部署脚本：**`--init`（首次初始化）/ `--http-only`（阶段一发版）/ `--https`（阶段二发版）/ 无参数（日常发版）** |

**上线前必须先填齐的占位符**：`SERVER_IP`、`SSH_USER`、`DOMAIN`、`REMOTE_DIR`（可选，有默认值）、`CERTBOT_EMAIL`（仅 `--https` 需要）。

### 四种模式一览

| 模式 | 构建上传 | 动 nginx 配置 | 拿证书 | 冒烟 | 何时用 |
| --- | --- | --- | --- | --- | --- |
| `--init` | ❌ | 写入**阶段一**（HTTP-only） | ❌ | HTTP 探测（仅提示） | 全新机器**第一次**，装环境建骨架 |
| `--http-only` | ✅ | 写入/保持**阶段一** | ❌ | HTTP | 首次上线、以及拿证前的验证 |
| `--https` | ✅ | 先阶段一（若无证）→ 拿证 → 写**阶段二** | ✅ | HTTPS + 301 + 续期自检 | 拿到证书后的正式上线与后续发版 |
| 无参数 | ✅ | ❌（保持服务器现有配置） | ❌ | HTTPS | 已稳定上线后的日常发版 |

> `--init` **不会**改系统防火墙（ufw/iptables）—— 轻量服务器的端口放行在腾讯云控制台侧，脚本只在结束时打印待办清单。

---

## 1. 架构摘要（决定了下面的所有决策）

本项目是**纯前端静态站点**，无后端、无 SSR、无框架、无 TypeScript：

- 构建工具：Vite 5.4.21（Node v22.22.2 本地验证通过）
- 产物目录：`.ns-build-2x/`（**不是 `dist/`**）
- 产物构成（2026-10-08 本地实测）：

| 项 | 值 |
| --- | --- |
| 总体积 | **1.2 MB** |
| `index.html` | 16.87 kB（gzip 6.16 kB） |
| `assets/index-*.js` | 231.42 kB（gzip 72.43 kB） |
| `assets/index-*.css` | 55.51 kB（gzip 11.31 kB） |
| `assets/*.png` | **165 张** |
| `fonts/PressStart2P.woff2` | 12.5 kB |
| `version.json` | 运行时版本自检端点 |
| `f3cf20e70ac09eb3e2c94fba4342e616.txt` | **微信域名验证文件（关键）** |
| `_headers` / `_redirects` | Cloudflare Pages 专有文件（Nginx 用不到，已对公网 404） |

- 入口 `index.html` **无 `<base>` 标签**，全部资源使用根绝对路径 `/assets/...`、`/fonts/...`
  → 直接挂域名根目录；挂子路径需要改 `vite.config.js` 的 `base` + `src/assets.js`/`src/ui.js` 里 3 处硬编码根路径。**本次按根目录部署。**
- 资源缓存击穿：PNG URL 形如 `/assets/xxx.png?v=<内容哈希>`，JS/CSS 文件名自带内容哈希。
- **5Mbps 带宽**：165 张 PNG 共 1.2MB，满载首屏理论 ~2s。gzip 已开（JS 72KB / CSS 11KB），PNG 不二次压缩。

---

## 2. ⚠️ 三条硬红线（违反必失败或必出事故）

### 红线 1：构建命令只能用 `npx vite build --outDir .ns-build-2x`

- **禁止 `npm run build`**：默认输出到 `dist/`，`dist/` 会被本机安全删除守卫拦截导致构建失败。
- `npx vite build` **不会触发** `package.json` 的 `prebuild`（技能树校验）→ `deploy.sh` Step 1 已手动补齐这道门控。

### 红线 2：已存在的输出目录必须先 `mv` 走，再构建

实测（2026-10-08）：当 `.ns-build-2x/` 已存在且文件数 > 50 时，Vite 调 `emptyDir()` 批量删除旧产物，触发本机安全删除守卫：

```
[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":170,"threshold":50,...}
```

**更糟的是它"删到一半才失败"** —— 实测 `_headers`/`_redirects` 已被删掉后才在 `assets/` 上被拦截，产物残缺。

✅ 正确做法（`deploy.sh` 已内置）：

```bash
[ -d .ns-build-2x ] && mv .ns-build-2x /tmp/ns-build-archive-$(date +%Y%m%d%H%M%S)
npx vite build --outDir .ns-build-2x
```

`mv` 是 rename 不是 delete，不触发守卫。

> 💡 建议（未改，待你确认）：`.ns-build-2x/` 目前不在 `.gitignore` 里，`git status` 永远脏 + 有 1.2MB 误提交风险。建议加一行 `.ns-build-2x/`。

### 红线 3：`f3cf20e70ac09eb3e2c94fba4342e616.txt` 必须在站点根目录且可 200 访问

微信域名验证文件（内容 `25e8d922468d22341497499f1ee07c2c6ee7beb6`）。丢了它，微信内链接会被风控拦截。

- 源文件：`public/f3cf20e70ac09eb3e2c94fba4342e616.txt`（Vite 原样拷入产物根目录）
- 验证：`curl -s https://<DOMAIN>/f3cf20e70ac09eb3e2c94fba4342e616.txt` → 200 + 上述 40 位字符串
- `deploy.sh` 本地+远程双重强制校验，缺失即 `exit 1`，**不会上传**

---

## 3. 前置条件检查表

### 3.0 轻量实例与防火墙（Lighthouse 专属，**最先确认**）

| # | 检查项 | 期望 | 验证方式 |
| --- | --- | --- | --- |
| **L1** | 产品类型确认为**轻量应用服务器 Lighthouse** | 实例 ID `lhins-475yjttw`（上海四区） | 轻量控制台 → 实例列表 |
| **L2** | **重装已完成**，系统为 Ubuntu Server 22.04 LTS | `cat /etc/os-release` 显示 22.04 | SSH 登录后执行 |
| **L3** | **SSH 密钥已绑定**（重装时绑定本机 `~/.ssh/id_ed25519.pub`） | 密钥可登录；绑定失败则退化为密码登录 | `ssh -i ~/.ssh/id_ed25519 <user>@<IP> 'echo OK'` |
| **L4** | **防火墙放行 TCP 22**（SSH） | 建议**来源限制为本机出口 IP** | 轻量控制台「防火墙」标签页；本地 `nc -vz <IP> 22` |
| **L5** | **防火墙放行 TCP 80**（HTTP） | 来源 `0.0.0.0/0` | 本地 `nc -vz <IP> 80` |
| **L6** | **防火墙放行 TCP 443**（HTTPS） | 来源 `0.0.0.0/0` | 本地 `nc -vz <IP> 443` |
| **L7** | 记录重装后的**真实公网 IP** | 可能与 `118.89.76.27` 不同 | 轻量控制台 → 实例详情 |

> ⚠️ **Lighthouse 没有「安全组」**：所有放行都在轻量控制台 → 实例详情 → **左侧「防火墙」标签页**。别去 CVM 的安全组页面找，那是另一个产品。
>
> ⚠️ **双防火墙**：轻量控制台防火墙 **+** 系统内 `ufw`/`iptables` 是两层，都要通。Ubuntu 22.04 默认 `ufw` 是 inactive（不拦），但装完 nginx 后如果在系统里开了 ufw 需一并放行。

### 3.1 服务器端（首次部署前逐条确认）

| # | 检查项 | 期望 | 验证命令（服务器上执行） |
| --- | --- | --- | --- |
| S1 | OS | Ubuntu 22.04 LTS | `cat /etc/os-release` |
| S2 | Nginx 已安装 | 1.18+（Ubuntu 22.04 源默认 1.18，够用） | `nginx -v` |
| S3 | rsync 已安装 | 有 | `rsync --version \| head -1` |
| S4 | 目录可写 | 能创建 `/var/www/night-survivors` | `sudo mkdir -p /var/www/night-survivors && echo OK` |
| S5 | 系统防火墙未拦截 | ufw inactive 或已放行 80/443 | `sudo ufw status` |
| S6 | SSH 可登录 | 密钥（优先）或密码 | `ssh -p 22 <user>@<IP> 'echo OK'` |
| S7 | 能 sudo 执行 nginx | 有 sudo 权限或本身是 root | `sudo nginx -t` |
| S8 | **已备案且备案接入指向腾讯云** | 见 §8 R1 | 腾讯云控制台 → 备案 |

### 3.2 域名与 DNS

| # | 检查项 | 期望 | 验证命令（本地） |
| --- | --- | --- | --- |
| D1 | A 记录已指向**轻量实例公网 IP** | `dig +short <DOMAIN>` == L7 记录值 | `dig +short <DOMAIN>` |
| D2 | `www` 子域（如要用） | A 记录或 CNAME | `dig +short www.<DOMAIN>` |
| D3 | DNS 已生效 | 多地解析一致 | `nslookup <DOMAIN> 119.29.29.29` |
| D4 | 旧解析（CF Pages）已移除 | 不留 CNAME 到 `pages.dev` | `dig <DOMAIN> CNAME` |
| D5 | 域名 ICP 备案 | 已完成 | 见 §8 R1 |

> ⚠️ 切换前把 TTL 降到 300s（提前一天），否则切换后可能数小时不生效。

### 3.3 HTTPS 证书（三选一）

| 方案 | 说明 | 落地要点 |
| --- | --- | --- |
| **A. Let's Encrypt + certbot（推荐）** | 免费 90 天，自动续期 | 见 §5 阶段二；Ubuntu 22.04 用 **snap** 装（见下方"apt 还是 snap"） |
| **B. 腾讯云免费 SSL（TrustAsia，1 年）** | 控制台申请，下载 Nginx 格式 | `fullchain.pem` + `privkey.pem` 放到 `/etc/nginx/ssl/<DOMAIN>/` |
| **C. 自签证书** | ❌ **禁止用于生产** | 微信内报"证书不受信任"，直接触发风控 |

证书权限：`chmod 600 privkey.pem`，`chown root:root`。

#### certbot 在 Ubuntu 22.04 上：apt 还是 snap？

**结论：用 snap，不要用 apt 的旧包。**

| 方式 | 命令 | 版本 | 评价 |
| --- | --- | --- | --- |
| **snap（推荐）** | `sudo snap install --classic certbot`<br>`sudo ln -sf /snap/bin/certbot /usr/bin/certbot` | 最新（2.x+） | Certbot 官方推荐；Ubuntu 22.04 自带 snapd；自动续期 timer 由 snap 管理 |
| **apt（不推荐）** | `sudo apt install -y certbot python3-certbot-nginx` | Ubuntu 22.04 源里是 **1.21.0**（较旧） | 旧包在 ACME 协议演进、续期兼容上更容易出问题；且**不要与 snap 版混装** |

```bash
# 若之前 apt 装过，先卸载再装 snap，避免 /usr/bin/certbot 与 /snap/bin/certbot 冲突
sudo apt remove -y certbot
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version    # 期望 2.x
```

#### ❗"放行 443 之前 certbot 会失败"要不要写进前置检查？

**要写，但必须把因果写对**，否则会误导排障方向：

| 场景 | 实际依赖 | 说明 |
| --- | --- | --- |
| **certbot HTTP-01 拿证** | **只需要 80 端口入站放行** | Let's Encrypt 校验只访问 `http://<DOMAIN>/.well-known/acme-challenge/...`，**不连 443**。所以严格来说 **443 没放行，certbot 依然能拿到证书**。 |
| **切换 HTTPS 后对外服务** | **必须放行 443** | 443 未放行 → 玩家/微信内打不开 HTTPS，表现为"证书都拿到了但网站访问不了"。 |
| **`certbot --nginx` 插件** | 需要 80，且会改配置 | 它会在 80 server 块里临时插入挑战响应，同样不依赖 443 入站。 |

**因此本清单把它拆成两条前置检查**（对应上表 L5 / L6）：

- **L5（80 放行）** —— certbot 拿证的**硬前置**，拿证前必须已放行。
- **L6（443 放行）** —— **不是 certbot 的前置**，而是**"切换阶段二 HTTPS 配置"的前置**。写成"certbot 会因为 443 没开而失败"是**错误因果**，会让人在 443 上白排查半天（真正让 certbot 失败的通常是：80 没开 / DNS 没解析到本机 / nginx 没监听 80 / webroot 路径不对）。

---

## 4. 阶段一部署：HTTP-only（重装后立刻可用）

目标：先把站点跑在 80 上，验证资源可访问 + 微信验证文件可访问，并为 certbot 的 HTTP-01 挑战留好 `/.well-known/acme-challenge/`。

### Step 1 — 服务器初始化（脚本 `--init`，全新 Ubuntu 22.04）

```bash
cd /Users/a34481/Documents/Trae_game
export SERVER_IP="<轻量公网 IP>"   # 以控制台实际值为准（重装后可能变）
export SSH_USER="ubuntu"           # Ubuntu 22.04 镜像默认是 ubuntu；重装有 root 则用 root
export SSH_PORT="22"
export DOMAIN="<你的域名>"

bash docs/deploy/deploy.sh --init --dry-run   # 先空跑
bash docs/deploy/deploy.sh --init             # 真跑
```

**`--init` 的完整执行顺序（6 步，任一步失败即 `exit 1`）**：

| # | 动作 | 关键细节 |
| --- | --- | --- |
| 1 | SSH 连通性探测 | `ssh … 'echo OK'`；失败直接给出 4 个排查方向（重装未完成 / 防火墙未放行 22 / 密钥未绑定 / IP 变了），并打印远端 `/etc/os-release` |
| 2 | `apt-get update && apt-get install -y nginx rsync` | `DEBIAN_FRONTEND=noninteractive`，**幂等**（已装则跳过）；打印 `nginx -v` |
| 3 | 建目录骨架 `REMOTE_DIR/{releases,current}` | `sudo mkdir -p` + `chown` 给 SSH 用户（root 则跳过）；再建一个占位 release `00000000-placeholder` 并写占位 `index.html`，把 `current` 指过去 |
| 4 | 写入**阶段一（HTTP-only）** nginx 配置 | 从 `nginx-night-survivors.conf` 渲染（`YOUR_DOMAIN`→`DOMAIN`、站点根→`REMOTE_DIR`）；**先备份**现有配置为 `.bak.<时间戳>` → `tee` 写入 → `nginx -t`；**校验失败自动回滚备份** |
| 5 | `systemctl enable --now nginx` | 再校验 `systemctl is-active nginx` 必须为 `active`，否则 `exit 1` |
| 6 | HTTP 可达性探测（仅提示，不中断） | `curl http://<DOMAIN>/` 期望 **200 占位页** —— 这一步能在传产物之前就证明「防火墙 80 已放行 + DNS 已生效 + nginx 已起」 |

结尾打印**待办清单**（脚本不代劳）：轻量控制台「防火墙」放行 22/80/443、DNS A 记录、备案接入、SSH 密钥、可选删除 `sites-enabled/default`。

#### 手工等价命令（不用 `--init` 时）

```bash
ssh -p 22 <SSH_USER>@<SERVER_IP>

sudo apt update
sudo apt install -y nginx rsync          # 幂等：已装则跳过
sudo mkdir -p /var/www/night-survivors/releases
sudo chown -R "$USER":"$USER" /var/www/night-survivors   # root 可跳过
# 再把 nginx-night-survivors.conf 的「STAGE1」段落拷到 /etc/nginx/conf.d/night-survivors.conf
# （YOUR_DOMAIN → 真实域名）
sudo nginx -t
sudo systemctl enable --now nginx
```

目录规范（**回滚能力的基础**）：

```
/var/www/night-survivors/
├── releases/
│   ├── 00000000-placeholder/  ← --init 建的占位版（首次发版前访问域名看到它）
│   ├── 20261009-101500/       ← 每次发版一份完整产物（不覆盖）
│   └── 20261010-093000/
└── current -> releases/20261009-101500    ← Nginx root 指向这个软链接
```

### Step 2 — 本地构建 + 上传（用脚本的 `--http-only`）

```bash
# 沿用 Step 1 已 export 的变量（新开终端需重新 export）
bash docs/deploy/deploy.sh --http-only --dry-run   # 先空跑
bash docs/deploy/deploy.sh --http-only             # 真跑
```

`--http-only` 会：技能树校验 → 归档旧产物 → 构建 → 本地产物校验 → rsync 上传 → 远程校验 → 切 `current` → 写入阶段一 nginx 配置（备份 → `nginx -t`）→ reload → HTTP 冒烟。

阶段一专属自检（脚本自动跑）：

- `http://<DOMAIN>/.well-known/acme-challenge/probe` → **404** 才算通道就绪（若是 301，说明挑战被跳转规则吞掉，certbot 会失败）
- `http://<DOMAIN>/` → **200**（若是 301，说明阶段二配置还挂着）

### Step 3 — HTTP 阶段验证（**不通过就不要往下走拿证**）

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://<DOMAIN>/                                # 期望 200
curl -s http://<DOMAIN>/f3cf20e70ac09eb3e2c94fba4342e616.txt                            # 期望 25e8d922…beb6
curl -s -o /dev/null -w '%{http_code}\n' http://<DOMAIN>/version.json                   # 期望 200
curl -s -o /dev/null -w '%{http_code}\n' http://<DOMAIN>/assets/icon_skull.png          # 期望 200
curl -s -o /dev/null -w '%{http_code}\n' http://<DOMAIN>/fonts/PressStart2P.woff2       # 期望 200
curl -s -o /dev/null -w '%{http_code}\n' http://<DOMAIN>/.well-known/acme-challenge/probe  # 期望 404（说明 location 生效、不是被兜底吞掉）
```

---

## 5. 阶段二部署：certbot 拿证 + 切换 HTTPS

### Step 1 — 确认 443 已放行（轻量控制台「防火墙」）

```bash
nc -vz <SERVER_IP> 443     # 通了再继续
```

### Step 2 — 安装 certbot（snap）

```bash
sudo apt remove -y certbot 2>/dev/null || true
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version
```

### Step 3 — 拿证（webroot，指向 current）

```bash
sudo certbot certonly --webroot \
  --webroot-path /var/www/night-survivors/current \
  -d <DOMAIN> -d www.<DOMAIN> \
  --agree-tos -m <你的邮箱> --no-eff-email
```

证书落在 `/etc/letsencrypt/live/<DOMAIN>/{fullchain.pem,privkey.pem}`。

> 幂等：证书已存在时 certbot 会提示可跳过或 `--keep-until-expiring`；重复执行不会破坏现有站点。
> 若用腾讯云免费证书（方案 B），跳过 Step 2–3，手动把 pem 放到 `/etc/nginx/ssl/<DOMAIN>/` 即可。

### Step 4 — 切换阶段二 nginx 配置

```bash
sudo sed -i 's|/etc/nginx/ssl/YOUR_DOMAIN|/etc/letsencrypt/live/<DOMAIN>|g' \
  /etc/nginx/conf.d/night-survivors.conf
# 或直接按 nginx-night-survivors.conf 模板的「阶段二」段替换整个文件
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5 — 一键跑（脚本的 `--https`）

```bash
export CERTBOT_EMAIL="<你的邮箱>"
bash docs/deploy/deploy.sh --https --dry-run
bash docs/deploy/deploy.sh --https --skip-build   # 复用 Step 2 已上传的产物，不重新构建
```

`--https` 会（顺序固定）：

1. 构建 + 上传 + 切 `current`（同阶段一；`--skip-build` 可跳过构建，直接复用已上传的 release）
2. **若证书不存在** → 先切阶段一（HTTP-only）并 reload，给 HTTP-01 挑战让出 80 通道；证书已存在则跳过（避免短暂降级）
3. 拿证前自检：`curl http://<DOMAIN>/` 必须 200，否则**警告**并给出排查顺序（防火墙 80 → DNS → nginx 是否在跑 → 阶段一是否 reload）
4. certbot 安装检查：没有就 `snap install --classic certbot` + `ln -sf /snap/bin/certbot /usr/bin/certbot`；版本是 `1.*` 则警告（apt 旧包）
5. `certbot certonly --webroot -w <REMOTE_DIR>/current -d <DOMAIN> -d www.<DOMAIN> --keep-until-expiring --non-interactive`（幂等）
6. 确认 `fullchain.pem` 真的生成了，否则 `exit 1`（不会带着假配置 reload）
7. 写入阶段二配置（备份 → `tee` → `nginx -t`，失败自动回滚）→ reload
8. 冒烟：HTTPS 200 / 微信验证文件 200 / HTTP→HTTPS 301 / `certbot renew --dry-run`

> 全程可加 `--dry-run`：只打印远程命令，并把渲染出的 nginx 配置落到 `/tmp/ns-nginx-stage{1,2}-<时间戳>.conf` 供本地预览。

### Step 6 — HTTPS 验证

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/                  # 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://<DOMAIN>/   # 301 https://<DOMAIN>/
curl -s https://<DOMAIN>/f3cf20e70ac09eb3e2c94fba4342e616.txt              # 25e8d922…beb6
curl -sI https://<DOMAIN>/ | grep -i cache-control                          # no-store
curl -sI https://<DOMAIN>/assets/index-*.js | grep -i cache-control         # immutable
sudo certbot renew --dry-run                                                # 续期链路自检
```

---

## 6. 日常发版

```bash
export SERVER_IP="..."; export SSH_USER="..."; export DOMAIN="..."
bash docs/deploy/deploy.sh              # 已上线后：默认全流程（构建+上传+切版本+reload+冒烟）
bash docs/deploy/deploy.sh --skip-build # 跳过构建，直接上传现有 .ns-build-2x/
```

脚本幂等，`--dry-run` 只打印不执行。

---

## 7. 回滚方案

### 方案 A：软链接回滚（首选，10 秒内）

```bash
ssh -p 22 <SSH_USER>@<SERVER_IP> "ls -1t /var/www/night-survivors/releases"   # 列出版本
ssh -p 22 <SSH_USER>@<SERVER_IP> "
  ln -sfn /var/www/night-survivors/releases/<PREV> /var/www/night-survivors/current &&
  sudo nginx -t && sudo systemctl reload nginx
"
curl -s -o /dev/null -w '%{http_code}\n' https://<DOMAIN>/
curl -s https://<DOMAIN>/version.json
```

回滚**不需要重新构建/上传**。`KEEP_RELEASES`（默认 5）控制保留份数。

### 方案 B：Git tag 回滚重建（兜底）

```bash
git tag | tail -20
git worktree add /tmp/ns-rollback v5.12 && cd /tmp/ns-rollback
[ -d .ns-build-2x ] && mv .ns-build-2x /tmp/ns-archive-$(date +%s)
CF_PAGES_COMMIT_SHA="$(git rev-parse --short HEAD)" npx vite build --outDir .ns-build-2x
# 再按 §4 Step 2 上传
cd /Users/a34481/Documents/Trae_game && git worktree remove /tmp/ns-rollback
```

### ⚠️ 全新机器首个版本**没有历史可回滚**

重装后的第一次部署，`releases/` 里只有一份产物，`current` 没有"上一版"可切。因此**首次上线前必须**：

1. 本地跑 `bash docs/deploy/deploy.sh --http-only --dry-run` 过一遍；
2. 本地产物校验全绿（index.html / 165 PNG / 微信 txt / version.json / 无 dist 依赖）；
3. 先按阶段一（HTTP）验证通过，再走阶段二（HTTPS）——**把风险切成两半，别一次跳到 HTTPS**；
4. 阶段二上线后立刻跑一遍 §5 Step 6 的验证清单。

确认无误后，后续每次发版才真正拥有"一键回滚"能力。

---

## 8. 已知风险与缓解（Lighthouse 前提更新版）

| ID | 风险 | 影响 | 概率 | 缓解 |
| --- | --- | --- | --- | --- |
| **R1** | **备案接入不在腾讯云**：域名在别的服务商备案，解析到腾讯云轻量后 80/443 可能被阻断 | 站点完全打不开 | 中 | 上线前在腾讯云备案系统确认域名已**接入腾讯云**；必要时做备案接入迁移（**耗时数天，最可能拖慢上线，第一天就确认**） |
| **R2** | **微信验证文件丢失** | 微信内被风控拦截 | 中 | `deploy.sh` 本地+远程双重校验，缺失 exit 1；上线后必跑验证 |
| **R3** | 微信验证文件 Content-Type 不对 / 被缓存 | 微信抓取校验失败 | 低 | Nginx 用 `map` 给默认 `no-store`，该文件单独 `default_type text/plain` |
| **R4** | **轻量防火墙未放行 22/80/443** | SSH 连不上 / 网站打不开 | **高** | §3.0 L4–L6；走轻量控制台「防火墙」标签页（**不是安全组**）+ 系统 ufw 两层都查 |
| **R5** | 缓存导致更新不生效（微信 X5 内核顽固） | 玩家看到老版本 | 高 | index.html/version.json `no-store`；JS/CSS 文件名哈希；PNG URL 内容哈希 `?v=`；游戏内置 90s 版本自检横幅 |
| **R6** | 误用 `npm run build` 输出到 `dist/` | 构建被安全删除守卫拦 | 中 | 红线 1；脚本固定 `npx vite build --outDir .ns-build-2x` |
| **R7** | **在已存在的 `.ns-build-2x` 上直接构建** → 删一半被拦，产物残缺 | 上传残缺站点 | **高（已实测）** | 红线 2；脚本内置 `mv` 归档 |
| **R8** | 证书自签 / 链不全 | 微信内告警或拦截 | 中 | 用 certbot 或腾讯云免费证书；`curl -vI` 确认链完整 |
| **R9** | DNS 缓存未刷新，仍在访问 Cloudflare Pages | "改了没生效"假象 | 高 | 提前降 TTL 到 300s；`dig` 确认解析到新 IP |
| **R10** | 迁移期 Cloudflare Pages 与轻量同时在跑 | 玩家分流两套环境 | 中 | 存档在 localStorage（按域名隔离），**换域名=存档清零**，需提前告知玩家 |
| **R11** | 165 张 PNG（1.2MB）在 5Mbps 下首屏偏慢 | 移动端首屏慢 | 中 | gzip 已开（JS 72KB/CSS 11KB）；PNG 不二次压缩；后续可考虑 WebP |
| **R12** | `_headers`/`_redirects` 被公网访问 | 泄漏内部配置（低危） | 低 | Nginx 模板对这两个文件返回 404 |
| **R13** | 22 端口暴露被爆破 | 安全风险 | 中 | 防火墙限制 22 来源为本机 IP；**优先密钥登录**，必要时禁用密码登录 |
| **R14** | **重装后公网 IP 变化**，沿用旧 IP 连不上 | 部署失败 | 中 | 每次重装后到控制台抄新 IP 再 `export SERVER_IP`；`118.89.76.27` 仅为当前观测值 |
| **R15** | SSH 密钥绑定失败，退化为密码登录 | 安全性下降 | 中 | §3.0 L3；先跑通，随后补绑密钥并禁用密码登录 |
| **R16** | certbot 装成 apt 旧包（1.21.0） | 续期/协议兼容隐患 | 中 | §3.3 用 **snap**；apt 版不要与 snap 混装 |
| **R17** | 误判"443 没开导致 certbot 失败" | 排障方向错误 | 中 | §3.3 已澄清：certbot 只需 80；443 是切 HTTPS 的前置 |
| **R18** | 全新机器首个版本出问题无历史可回滚 | 只能重新构建 | 中 | §7 首次上线先 `--dry-run` + 阶段一 HTTP 验证，再上 HTTPS |
| **R19** | **`listen [::]:80/443` 在轻量实例未启用 IPv6 时让 nginx 直接起不来**（`socket() [::]:80 failed (97: Address family not supported by protocol)`） | 站点全挂、`--init` 卡在 Step 5 | 中 | 模板已把 IPv6 监听**默认注释掉**，确认实例已分配 IPv6 后再手动打开 |
| **R20** | Ubuntu 22.04 apt 源里的 nginx 是 **1.18**，不支持 `http2 on;`（该指令 1.25.1+ 才有） | 写了就 `nginx -t` 失败 | 中 | 模板默认**不开 HTTP/2**；注释里给出两种写法（`listen 443 ssl http2;` 用于 1.18） |
| **R21** | 默认站点 `/etc/nginx/sites-enabled/default` 仍在，用 IP 直访落到 nginx 欢迎页 | 误判"部署成功/失败" | 低 | `--init` 待办清单第 5 条：`sudo rm -f /etc/nginx/sites-enabled/default`；域名访问不受影响（server_name 精确匹配优先） |
| **R22** | `deploy.sh --http-only/--https` 会**覆盖**服务器上的 nginx 配置 | 手工改过的配置丢失 | 低 | 每次写入前自动备份为 `.bak.<时间戳>`；`nginx -t` 失败自动回滚备份 |

---

## 9. Cloudflare Pages 专有文件的等价处理

`_headers`/`_redirects` Nginx 不识别，已对公网 404；其规则在 Nginx 侧手工补齐：

| Cloudflare `_headers` 规则 | Nginx 等价实现 |
| --- | --- |
| `/`、`/index.html` → `no-store` | `map $uri $ns_cache_control` 默认 `no-store` |
| `/version.json` → `no-store` | 同上（默认即 no-store） |
| `/assets/*.js|css` → `immutable` | map 正则分支 |
| `/assets/*.png` → `immutable` | map 正则分支 |
| `/fonts/*` → `immutable` | map 正则分支 |

| Cloudflare `_redirects` | Nginx 等价 | 本模板做法 |
| --- | --- | --- |
| `/* /index.html 200` | SPA fallback | **未实现，判断为不需要** —— 见 §10 |

---

## 10. 关于"是否需要 SPA fallback"的判断

**结论：不需要。模板用 `try_files $uri $uri/ =404;`（真 404），而非 `try_files $uri $uri/ /index.html =404`。**

依据（均经代码核实）：

1. `src/` 全量检索 `history.pushState` / `replaceState` / `location.hash` / `window.location` → **零命中**，无前端路由。
2. `index.html` 是单文件全量入口，所有界面（title/HUD/升级/技能树/图鉴/宠物/血裔）预写在同一个 HTML 里，靠增删 `.hidden` 切换，**URL 从不变化**。
3. 无深链接需求，玩家只访问 `/`。
4. `_redirects` 的 `/* /index.html 200` 是 Cloudflare Pages 模板残留，与 1、2 条矛盾。
5. **真 404 更有诊断价值**：若做 fallback，缺失的 PNG/JS 会返回 200 + HTML，浏览器只报模糊的 MIME 错误，165 张图场景排查成本极高。

将来若引入前端路由（如 `/codex`），把模板里注释掉的 `try_files $uri $uri/ /index.html;` 打开即可。

---

## 11. 附录：命令速查

```bash
# 端口连通性（轻量防火墙是否放行）
nc -vz <SERVER_IP> 22; nc -vz <SERVER_IP> 80; nc -vz <SERVER_IP> 443

# 本地构建（红线：先 mv 归档）
[ -d .ns-build-2x ] && mv .ns-build-2x /tmp/ns-archive-$(date +%s)
CF_PAGES_COMMIT_SHA="$(git rev-parse --short HEAD)" npx vite build --outDir .ns-build-2x

# 首次初始化（全新 Ubuntu 22.04）
bash docs/deploy/deploy.sh --init --dry-run
bash docs/deploy/deploy.sh --init

# 两阶段部署
bash docs/deploy/deploy.sh --http-only --dry-run
bash docs/deploy/deploy.sh --http-only
export CERTBOT_EMAIL=you@example.com
bash docs/deploy/deploy.sh --https --dry-run
bash docs/deploy/deploy.sh --https --skip-build

# 日常发版（不改动 nginx 配置）
bash docs/deploy/deploy.sh

# certbot（Ubuntu 22.04 / snap）
sudo snap install --classic certbot && sudo ln -sf /snap/bin/certbot /usr/bin/certbot
sudo certbot certonly --webroot --webroot-path /var/www/night-survivors/current -d <DOMAIN> -d www.<DOMAIN>
sudo certbot renew --dry-run

# 回滚
ssh -p 22 <user>@<ip> "ln -sfn /var/www/night-survivors/releases/<PREV> /var/www/night-survivors/current && sudo nginx -t && sudo systemctl reload nginx"

# 微信验证文件（最关键）
curl -s -w '\n[%{http_code}]\n' https://<DOMAIN>/f3cf20e70ac09eb3e2c94fba4342e616.txt
```

---

## 12. 发布门控（Go / No-Go）

| 门控 | 判定 |
| --- | --- |
| 技能树校验通过 | `node scripts/validate_skilltree.mjs` → `✓ 39 节点` |
| 产物 index.html 存在 | ✅ |
| 产物 PNG = 165 | ✅ |
| **`f3cf20e70ac09eb3e2c94fba4342e616.txt` 存在且内容正确** | ✅ |
| 产物无 `dist/` 依赖、无子路径依赖 | ✅ |
| 重装完成 + SSH 密钥可登录（L2/L3） | ☐ |
| **轻量防火墙放行 22/80/443**（L4–L6） | ☐ |
| 域名解析到轻量公网 IP（以控制台实际值为准） | ☐ |
| **`deploy.sh --init` 跑通**（nginx active + 占位页 200） | ☐ |
| **阶段一 HTTP 验证通过**（§4 Step 3，含 ACME 通道 404 自检） | ☐ |
| certbot 拿证成功（snap 版，非 apt 旧包） | ☐ |
| `nginx -t` 通过 | ☐ |
| HTTPS 验证通过（§5 Step 6） | ☐ |
| **微信内真机打开 + 开局贴图正常** | ☐ |

> 门控未清不上线，除非用户明确豁免。
