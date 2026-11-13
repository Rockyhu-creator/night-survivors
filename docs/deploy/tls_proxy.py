#!/usr/bin/env python3
"""
本地 TLS 代理 —— 绕过本地网络对 SSH 协议的 DPI 封锁（2026-11-12 部署实测产物）

【背景】用户本地出口网络（东莞宽带）的 DPI 设备按协议识别 SSH 并注入 RST，
22/2222/443 端口全部在 banner 阶段被掐，与端口无关。解法：服务器 stunnel
把 SSH 包进 TLS 外壳，本机用本代理转发。

【服务器侧】stunnel 监听 0.0.0.0:9443 → connect 127.0.0.1:2222（sshd）
  配置见 /etc/stunnel/ns.conf（foreground = yes，systemd 单元 stunnel-ns.service）

【用法】
  python3 docs/deploy/tls_proxy.py            # 前台常驻，监听 127.0.0.1:12222
  # 另开终端（或让 deploy.sh 走它）：
  export SERVER_IP=127.0.0.1 SSH_PORT=12222 SSH_USER=ubuntu DOMAIN=<域名>
  bash docs/deploy/deploy.sh --http-only      # ssh/rsync 全部落到本地代理

【为什么不用 openssl s_client 做 ProxyCommand】
  s_client 扛不住批量数据流（实测 256KB 即断、3MB 必断），Python ssl + 双线程
  转发 3MB 实测无损 PASS。这是本次排障最有价值的结论。

【端口全景】80→Nginx ｜ 443→Nginx(HTTPS) ｜ 2222→sshd ｜ 9443→stunnel ｜ 12222→本代理
【已知坑】
  - Ubuntu 24.04+ 改 SSH 端口必须改 ssh.socket drop-in（sshd_config 无效），
    且必须显式 ListenStream=0.0.0.0:<port> + [::]:<port> 两条（只写裸端口只绑 IPv6）
  - 改完要 systemctl restart ssh.service ssh.socket（service 持旧 FD）
  - certbot 非 2C 交互模式自带最长 8 分钟随机延迟，别误判为卡死
  - /etc/letsencrypt/live 权限 700，检查证书存在性必须 sudo
  - 长命令（snap install / certbot renew）会被隧道掐断 → 一律 nohup 后台化 + 轮询
"""
import socket, ssl, threading

LISTEN = ("127.0.0.1", 12222)
TARGET = ("118.89.76.27", 9443)  # 腾讯云轻量公网 IP + stunnel 端口，换机器改这里

def pipe(a: socket.socket, b: socket.socket):
    try:
        while True:
            data = a.recv(65536)
            if not data:
                break
            b.sendall(data)
    except OSError:
        pass
    finally:
        try: b.shutdown(socket.SHUT_WR)
        except OSError: pass

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE  # stunnel 自签证书

srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv.bind(LISTEN)
srv.listen(4)
print(f"TLS proxy listening {LISTEN[0]}:{LISTEN[1]} -> {TARGET[0]}:{TARGET[1]}", flush=True)

while True:
    client, addr = srv.accept()
    try:
        raw = socket.create_connection(TARGET, timeout=15)
        tls = ctx.wrap_socket(raw, server_hostname="ns-tunnel")
    except OSError as e:
        print("upstream fail:", e, flush=True)
        client.close()
        continue
    threading.Thread(target=pipe, args=(client, tls), daemon=True).start()
    threading.Thread(target=pipe, args=(tls, client), daemon=True).start()
