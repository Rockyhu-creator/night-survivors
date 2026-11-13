// ============================================================
// 云存档同步层（v5.13 账号密码体系）
// 设计：自包含模块——自带 DOM 装配，不侵入 data.js/ui.js 的存档函数。
// 同步对象：night_survivors_best / _souls / _collection 三个 localStorage 块
// 策略：变更检测（JSON 比对）→ 60s 定时推 / beforeunload 推；
//       登录时拉云端 → 无本地档直接导入，有本地档询问（导入前自动备份）
// ============================================================

const CLOUD_TOKEN_KEY = 'ns_cloud_token';
const CLOUD_USER_KEY = 'ns_cloud_user';
const CLOUD_BACKUP_PREFIX = 'night_survivors_cloud_backup_';

// 与 data.js 的三个 key 保持一致（若改 key 需同步这里）
const SAVE_KEYS = {
  best: 'night_survivors_best',
  souls: 'night_survivors_souls',
  collection: 'night_survivors_collection',
};
const SAVE_KEYS_ORDER = ['best', 'souls', 'collection'];

let _lastPushedJson = '';      // 上次成功推送/拉取后的本地 blob 快照（变更检测基准）
let _syncTimer = null;
let _pushing = false;

// ---------- 基础工具 ----------
function getToken() { return localStorage.getItem(CLOUD_TOKEN_KEY) || ''; }
function getUsername() { return localStorage.getItem(CLOUD_USER_KEY) || ''; }
function setSession(token, username) {
  localStorage.setItem(CLOUD_TOKEN_KEY, token);
  localStorage.setItem(CLOUD_USER_KEY, username);
}
function clearSession() {
  localStorage.removeItem(CLOUD_TOKEN_KEY);
  localStorage.removeItem(CLOUD_USER_KEY);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
    keepalive: method === 'POST' && path === '/api/save', // beforeunload 时尽力送达
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.error || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---------- 存档打包 / 拆包 ----------
function readLocalBlob() {
  const blob = {};
  for (const k of SAVE_KEYS_ORDER) {
    const raw = localStorage.getItem(SAVE_KEYS[k]);
    blob[k] = raw ? JSON.parse(raw) : null;
  }
  return blob;
}

function blobJson() { return JSON.stringify(readLocalBlob()); }

function isEmptyBlob(blob) {
  return SAVE_KEYS_ORDER.every(k => blob[k] === null || blob[k] === undefined);
}

function writeBlobToLocalStorage(blob) {
  for (const k of SAVE_KEYS_ORDER) {
    if (blob[k] === null || blob[k] === undefined) continue;
    localStorage.setItem(SAVE_KEYS[k], JSON.stringify(blob[k]));
  }
}

function backupLocalBlob() {
  const key = `${CLOUD_BACKUP_PREFIX}${Date.now()}`;
  localStorage.setItem(key, blobJson());
  // 只保留最近 3 份备份
  const backs = Object.keys(localStorage).filter(k => k.startsWith(CLOUD_BACKUP_PREFIX)).sort();
  while (backs.length > 3) localStorage.removeItem(backs.shift());
}

// ---------- 同步动作 ----------
async function pushSave() {
  if (!getToken() || _pushing) return false;
  const json = blobJson();
  if (json === _lastPushedJson) return false; // 无变更不推
  _pushing = true;
  try {
    await api('/api/save', { method: 'POST', body: { data: readLocalBlob() } });
    _lastPushedJson = json;
    updateStatus('✓ 已同步到云端');
    return true;
  } catch (e) {
    updateStatus(`✗ 同步失败：${e.message}`);
    return false;
  } finally {
    _pushing = false;
  }
}

async function pullSave({ silent = false } = {}) {
  if (!getToken()) return false;
  try {
    const res = await api('/api/save');
    const cloudBlob = res.data;
    const localBlob = readLocalBlob();
    if (JSON.stringify(cloudBlob) === JSON.stringify(localBlob)) {
      _lastPushedJson = blobJson();
      if (!silent) updateStatus('✓ 本地与云端一致');
      return true;
    }
    if (!isEmptyBlob(localBlob) && !silent) {
      const ok = window.confirm(
        '云端已有存档，与本地不一致。\n\n' +
        '「确定」= 用云端覆盖本地（本地会先自动备份）\n' +
        '「取消」= 保留本地，稍后手动上传覆盖云端'
      );
      if (!ok) return false;
    }
    backupLocalBlob();
    writeBlobToLocalStorage(cloudBlob);
    _lastPushedJson = blobJson();
    updateStatus('✓ 已从云端导入，刷新生效');
    if (!silent) {
      window.alert('云端存档已导入本地（原本地档已备份），点击确定刷新页面。');
      location.reload();
    }
    return true;
  } catch (e) {
    if (e.status === 404) {
      // 云端无存档：把本地推上去
      _lastPushedJson = '';
      await pushSave();
      return true;
    }
    if (!silent) updateStatus(`✗ 拉取失败：${e.message}`);
    return false;
  }
}

function startAutoSync() {
  if (_syncTimer) return;
  _syncTimer = setInterval(() => { if (getToken()) pushSave(); }, 60000);
  window.addEventListener('beforeunload', () => { if (getToken()) pushSave(); });
}

// ---------- UI ----------
let _els = null;

function updateStatus(text) {
  if (_els && _els.status) _els.status.textContent = text;
}

function renderCloudUI() {
  const loggedIn = !!getToken();
  const user = getUsername();
  _els.formLogin.classList.toggle('hidden', loggedIn);
  _els.panelSession.classList.toggle('hidden', !loggedIn);
  // 标题屏顶部入口同步展示登录态：登录后显示用户名，未登录显示「云存档」
  if (_els.entryLabel) {
    _els.entryLabel.textContent = loggedIn ? user : '云存档';
    _els.btnOpen.title = loggedIn ? `云存档 · 已登录：${user}` : '云存档 · 点击登录/注册';
    _els.btnOpen.classList.toggle('logged-in', loggedIn);
  }
  if (loggedIn) {
    _els.userName.textContent = user;
    updateStatus('· 已连接云端');
  }
}

function switchTab(tab) {
  const isRegister = tab === 'register';
  _els.tabLogin.classList.toggle('active', !isRegister);
  _els.tabRegister.classList.toggle('active', isRegister);
  // 共享输入框：切 tab 只改提示文案（避免重复 id 的双套输入框）
  _els.inputUser.placeholder = isRegister ? '用户名（2-16位，中文/字母/数字）' : '用户名（2-16位）';
  _els.inputPass.placeholder = isRegister ? '设置密码（至少6位）' : '密码（至少6位）';
}

async function submitAuth(isRegister) {
  const username = _els.inputUser.value.trim();
  const password = _els.inputPass.value;
  if (!username || !password) { updateStatus('✗ 请输入用户名和密码'); return; }
  _els.btnSubmit.disabled = true;
  updateStatus(isRegister ? '注册中…' : '登录中…');
  try {
    const res = await api(`/api/auth/${isRegister ? 'register' : 'login'}`,
      { method: 'POST', body: { username, password } });
    setSession(res.token, res.username);
    renderCloudUI();
    updateStatus(`✓ 欢迎，${res.username}`);
    await pullSave({ silent: true }); // 登录成功立刻对齐云端（云端有档且本地有档时会询问）
  } catch (e) {
    updateStatus(`✗ ${e.message}`);
  } finally {
    _els.btnSubmit.disabled = false;
  }
}

function initCloudSaveUI() {
  _els = {
    screen: document.getElementById('cloud-screen'),
    btnOpen: document.getElementById('btn-cloud'),
    btnClose: document.getElementById('btn-cloud-close'),
    entryLabel: document.getElementById('cloud-entry-label'),
    formLogin: document.getElementById('cloud-form'),
    panelSession: document.getElementById('cloud-session'),
    userName: document.getElementById('cloud-username'),
    status: document.getElementById('cloud-status'),
    tabLogin: document.getElementById('cloud-tab-login'),
    tabRegister: document.getElementById('cloud-tab-register'),
    inputUser: document.getElementById('cloud-input-user'),
    inputPass: document.getElementById('cloud-input-pass'),
    btnSubmit: document.getElementById('cloud-btn-submit'),
    btnLogout: document.getElementById('cloud-btn-logout'),
    btnUpload: document.getElementById('cloud-btn-upload'),
    btnDownload: document.getElementById('cloud-btn-download'),
  };

  _els.btnOpen.addEventListener('click', () => {
    _els.screen.classList.remove('hidden');
    renderCloudUI();
  });
  _els.btnClose.addEventListener('click', () => _els.screen.classList.add('hidden'));
  _els.tabLogin.addEventListener('click', () => switchTab('login'));
  _els.tabRegister.addEventListener('click', () => switchTab('register'));
  _els.btnSubmit.addEventListener('click', () =>
    submitAuth(_els.tabRegister.classList.contains('active')));
  // 回车提交
  for (const el of [_els.inputUser, _els.inputPass]) {
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') submitAuth(_els.tabRegister.classList.contains('active'));
    });
  }
  _els.btnLogout.addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* 忽略 */ }
    clearSession();
    renderCloudUI();
    updateStatus('· 已退出登录（本地进度保留）');
  });
  _els.btnUpload.addEventListener('click', () => { _lastPushedJson = ''; pushSave(); });
  _els.btnDownload.addEventListener('click', () => { pullSave({ silent: false }); });

  renderCloudUI();
  if (getToken()) {
    // 启动时静默校验会话 + 对齐
    api('/api/me').then(async () => {
      startAutoSync();
      await pullSave({ silent: true });
      renderCloudUI();
    }).catch(() => {
      clearSession();
      renderCloudUI();
      updateStatus('· 会话已过期，请重新登录');
    });
  }
}

export function initCloudSave() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCloudSaveUI);
  } else {
    initCloudSaveUI();
  }
}
