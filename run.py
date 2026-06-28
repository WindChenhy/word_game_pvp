#!/usr/bin/env python3
"""
标枪单词对战 · 一键启动脚本
同时启动 Python HTTP 静态服务器 + Node.js WebSocket 服务器
"""

import os
import sys
import signal
import subprocess
import threading
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
HTTP_PORT = 8000
WS_PORT = 3001

processes = []
shutting_down = False


def log(tag, msg):
    print(f"[{tag}] {msg}", flush=True)


def run_node_server():
    """启动 Node.js WebSocket 服务器"""
    server_dir = os.path.join(ROOT, "server")
    env = os.environ.copy()
    env["PORT"] = str(WS_PORT)
    proc = subprocess.Popen(
        ["node", "index.js"],
        cwd=server_dir,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    processes.append(proc)

    # 逐行输出
    for line in proc.stdout:
        if shutting_down:
            break
        log("WS", line.rstrip())

    proc.wait()


def run_http_server():
    """启动 Python HTTP 静态服务器"""
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(HTTP_PORT)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    processes.append(proc)

    for line in proc.stdout:
        if shutting_down:
            break
        log("HTTP", line.rstrip())

    proc.wait()


def cleanup(signum=None, frame=None):
    global shutting_down
    shutting_down = True
    print("\n\n正在关闭服务...", flush=True)
    for proc in processes:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
    print("已关闭。", flush=True)
    sys.exit(0)


if __name__ == "__main__":
    print(f"""
🎯 标枪单词对战 · 启动中
   🌐 页面:     http://localhost:{HTTP_PORT}
   🔌 WebSocket: ws://localhost:{WS_PORT}
   按 Ctrl+C 停止所有服务
""")

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    t1 = threading.Thread(target=run_node_server, daemon=True)
    t1.start()

    # 等 WS 服务器就绪
    time.sleep(0.5)

    run_http_server()
