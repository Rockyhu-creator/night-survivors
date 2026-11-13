#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
夜裔幸存者 · 云存档 API（Python 标准库，零第三方依赖）

设计要点（2026-11-12）：
  - 账号密码体系：scrypt 哈希（每用户独立盐），永不存明文
  - 会话：Bearer token（secrets.token_hex，30 天过期），存 SQLite
  - 存档：每用户一行，data 为完整 JSON blob（三个 localStorage 块合并），时间戳新者胜
  - 限流双层：Nginx limit_req（单 IP 层）+ 本服务应用级防线（2026-11-13 加固）：
      ① 全局注册窗口上限（防换 IP 刷库）
      ② 单 IP 注册频控（防单机批量注册，NAT 兼容）
      ③ 登录失败锁定（防密码爆破）
      ④ scrypt 并发闸门（核心：scrypt 是故意慢的哈希，高频请求 = CPU 耗尽攻击，
         用信号量把同时进行的哈希计算钉在 2 个，超出直接 429）
  - 端口：仅监听 127.0.0.1:8787，由 Nginx /api/ 反代对外（HTTPS 由 Nginx 终结）

部署：/opt/ns-save-api/（server.py + data.db），systemd 单元 ns-save-api.service
"""

import hashlib
import json
import os
import re
import secrets
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.db")
LISTEN = ("127.0.0.1", 8787)
TOKEN_TTL = 30 * 24 * 3600          # 30 天
SESSION_SWEEP_INTERVAL = 3600       # 每小时清一次过期会话
SCRYPT_N, SCRYPT_R, SCRYPT_P = 16384, 8, 1

USERNAME_RE = re.compile(r"^[\w\u4e00-\u9fa5]{2,16}$")   # 字母/数字/下划线/中文，2-16 位
MAX_SAVE_BYTES = 512 * 1024                              # 单用户存档上限 512KB

# ---- 应用级防线（2026-11-13）----
MAX_REGS_PER_HOUR = 40            # 全局注册窗口上限（防换 IP 刷库；NAT 场景可调）
MAX_REGS_PER_IP_DAY = 5           # 单 IP 每日注册上限（家庭/校园 NAT 多人够用）
LOGIN_MAX_FAILS = 5               # 连续失败 N 次后锁定
LOGIN_BLOCK_SECONDS = 15 * 60     # 锁定时长 15 分钟
AUTH_SEM_SIZE = 2                 # 同时进行的 scrypt 计算数（≈CPU 核数）
AUTH_SEM_TIMEOUT = 5              # 闸门排队超时（秒），超时返回 429

import threading
import collections

_auth_sem = threading.BoundedSemaphore(AUTH_SEM_SIZE)
_reg_global_ts = collections.deque()      # 全局注册时间戳（滑窗 1 小时）
_reg_ip_ts = {}                           # ip -> deque（滑窗 24h）
_login_fail = {}                          # ip -> [连续失败次数, 锁定截止时间戳]
_limits_lock = threading.Lock()

_last_session_sweep = [0.0]


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            pass_hash BLOB NOT NULL,
            pass_salt BLOB NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS saves (
            user_id INTEGER PRIMARY KEY,
            data TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
        """)
        # v1.1 迁移：记录注册来源 IP（应用级单 IP 频控用）
        cols = [r[1] for r in c.execute("PRAGMA table_info(users)").fetchall()]
        if "reg_ip" not in cols:
            c.execute("ALTER TABLE users ADD COLUMN reg_ip TEXT DEFAULT ''")


def hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode("utf-8"), salt=salt,
                          n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, dklen=32)


def verify_password(password: str, salt: bytes, expected: bytes) -> bool:
    return secrets.compare_digest(hash_password(password, salt), expected)


def sweep_sessions():
    now = int(time.time())
    if now - _last_session_sweep[0] < SESSION_SWEEP_INTERVAL:
        return
    _last_session_sweep[0] = now
    with db() as c:
        c.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    # 顺带清理内存防线里的陈旧条目（防 dict 无限增长）
    with _limits_lock:
        for ip in [ip for ip, ts in _reg_ip_ts.items() if not ts or now - ts[-1] > 86400]:
            _reg_ip_ts.pop(ip, None)
        for ip in [ip for ip, (cnt, until) in _login_fail.items()
                   if cnt == 0 and until < now]:
            _login_fail.pop(ip, None)


def client_ip(headers, remote_addr: str) -> str:
    """取真实客户端 IP。应用只监听 127.0.0.1，请求必经 Nginx 反代，
    X-Real-IP 由 nginx 设置（proxy_set_header），可安全采信。"""
    return headers.get("X-Real-IP") or remote_addr or "unknown"


def check_register_limit(ip: str) -> "str | None":
    """注册限流。返回 None=放行，返回 str=拒绝原因。"""
    now = time.time()
    with _limits_lock:
        # ① 全局滑窗（1 小时）
        while _reg_global_ts and now - _reg_global_ts[0] > 3600:
            _reg_global_ts.popleft()
        if len(_reg_global_ts) >= MAX_REGS_PER_HOUR:
            return "注册太过频繁（全局），请一小时后再试"
        # ② 单 IP 滑窗（24 小时）
        dq = _reg_ip_ts.setdefault(ip, collections.deque())
        while dq and now - dq[0] > 86400:
            dq.popleft()
        if len(dq) >= MAX_REGS_PER_IP_DAY:
            return "该网络今日注册次数已达上限"
        # 记录（先记后验，被拒绝的尝试也占额度——防并发绕过）
        _reg_global_ts.append(now)
        dq.append(now)
    return None


def login_blocked(ip: str) -> int:
    """返回剩余锁定秒数（0=未锁定）。"""
    with _limits_lock:
        cnt, until = _login_fail.get(ip, (0, 0))
        if until > time.time():
            return int(until - time.time())
        return 0


def record_login_fail(ip: str):
    with _limits_lock:
        cnt, until = _login_fail.get(ip, (0, 0))
        # 仅在「曾触发锁定且已过期」时重置计数；until=0 表示从未锁定，不能重置
        # （原写法 `if until < time.time()` 把未锁定态也当过期处理，计数永远停在 1——2026-11-13 单测抓出）
        if 0 < until < time.time():
            cnt = 0
        cnt += 1
        until = time.time() + LOGIN_BLOCK_SECONDS if cnt >= LOGIN_MAX_FAILS else 0
        _login_fail[ip] = (cnt, until)


def record_login_ok(ip: str):
    with _limits_lock:
        _login_fail.pop(ip, None)


def auth_user(headers) -> "sqlite3.Row | None":
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    if not token or len(token) > 128:
        return None
    now = int(time.time())
    with db() as c:
        row = c.execute(
            "SELECT s.user_id, s.token, u.username FROM sessions s "
            "JOIN users u ON u.id = s.user_id "
            "WHERE s.token = ? AND s.expires_at > ?", (token, now)).fetchone()
    return row


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "NSSaveAPI/1.0"

    # ---------- 基础 ----------
    def log_message(self, fmt, *args):  # 静默默认访问日志（systemd journal 里有 nginx 记录即可）
        pass

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> "dict | None":
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None
        if length <= 0 or length > 640 * 1024:
            return None
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return None

    # ---------- 路由 ----------
    def do_GET(self):
        if self.path == "/api/me":
            user = auth_user(self.headers)
            if not user:
                return self._json(401, {"error": "未登录或会话已过期"})
            return self._json(200, {"username": user["username"]})

        if self.path == "/api/save":
            user = auth_user(self.headers)
            if not user:
                return self._json(401, {"error": "未登录或会话已过期"})
            with db() as c:
                row = c.execute("SELECT data, updated_at FROM saves WHERE user_id = ?",
                                (user["user_id"],)).fetchone()
            if not row:
                return self._json(404, {"error": "云端无存档"})
            return self._json(200, {"data": json.loads(row["data"]),
                                    "updatedAt": row["updated_at"]})
        return self._json(404, {"error": "not found"})

    def do_POST(self):
        sweep_sessions()

        if self.path == "/api/auth/register":
            return self._auth(register=True)
        if self.path == "/api/auth/login":
            return self._auth(register=False)
        if self.path == "/api/auth/logout":
            user = auth_user(self.headers)
            if user:
                with db() as c:
                    c.execute("DELETE FROM sessions WHERE token = ?", (user["token"],))
            return self._json(200, {"ok": True})

        if self.path == "/api/save":
            user = auth_user(self.headers)
            if not user:
                return self._json(401, {"error": "未登录或会话已过期"})
            payload = self._read_json()
            if not payload or not isinstance(payload.get("data"), dict):
                return self._json(400, {"error": "data 字段缺失或格式错误"})
            blob = json.dumps(payload["data"], ensure_ascii=False, separators=(",", ":"))
            if len(blob.encode("utf-8")) > MAX_SAVE_BYTES:
                return self._json(413, {"error": "存档体积超限"})
            now = int(time.time())
            with db() as c:
                c.execute(
                    "INSERT INTO saves (user_id, data, updated_at) VALUES (?, ?, ?) "
                    "ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                    (user["user_id"], blob, now))
            return self._json(200, {"ok": True, "updatedAt": now})

        return self._json(404, {"error": "not found"})

    # ---------- 注册 / 登录 ----------
    def _auth(self, register: bool):
        payload = self._read_json()
        if not payload:
            return self._json(400, {"error": "请求格式错误"})
        username = str(payload.get("username", "")).strip()
        password = str(payload.get("password", ""))
        if not USERNAME_RE.match(username):
            return self._json(400, {"error": "用户名需 2-16 位（中文/字母/数字/下划线）"})
        if len(password) < 6 or len(password) > 64:
            return self._json(400, {"error": "密码需 6-64 位"})

        ip = client_ip(self.headers, self.client_address[0])

        # 应用级防线（先做便宜的检查，再做昂贵的 scrypt）
        if register:
            deny = check_register_limit(ip)
            if deny:
                return self._json(429, {"error": deny})
        else:
            remain = login_blocked(ip)
            if remain > 0:
                return self._json(429, {"error": f"失败次数过多，已锁定 {remain // 60 + 1} 分钟"})

        # scrypt 并发闸门：把同时进行的慢哈希钉在上限内，超出排队/429
        # （这是防「高频请求烧 CPU」的核心——Nginx 只限单 IP，挡不住分布式）
        if not _auth_sem.acquire(timeout=AUTH_SEM_TIMEOUT):
            return self._json(429, {"error": "服务器繁忙，请稍后再试"})
        try:
            return self._auth_inner(register, username, password, ip)
        finally:
            _auth_sem.release()

    def _auth_inner(self, register: bool, username: str, password: str, ip: str):
        with db() as c:
            if register:
                exists = c.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
                if exists:
                    return self._json(409, {"error": "用户名已被占用"})
                salt = secrets.token_bytes(16)
                ph = hash_password(password, salt)
                cur = c.execute(
                    "INSERT INTO users (username, pass_hash, pass_salt, created_at, reg_ip) VALUES (?, ?, ?, ?, ?)",
                    (username, ph, salt, int(time.time()), ip))
                uid = cur.lastrowid
            else:
                row = c.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
                if not row or not verify_password(password, row["pass_salt"], row["pass_hash"]):
                    record_login_fail(ip)
                    return self._json(401, {"error": "用户名或密码错误"})
                record_login_ok(ip)
                uid = row["id"]

            # 会话上限：每用户最多保留 5 个有效会话（旧的先过期）
            c.execute(
                "DELETE FROM sessions WHERE user_id = ? AND token NOT IN ("
                "  SELECT token FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 4)",
                (uid, uid))
            token = secrets.token_hex(32)
            now = int(time.time())
            c.execute("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
                      (token, uid, now, now + TOKEN_TTL))

        return self._json(200, {"token": token, "username": username})


def main():
    init_db()
    srv = ThreadingHTTPServer(LISTEN, Handler)
    srv.daemon_threads = True
    print(f"[ns-save-api] listening on http://{LISTEN[0]}:{LISTEN[1]}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
