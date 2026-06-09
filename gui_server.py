import os
import sys
import re
import json
import threading
import subprocess
import time
from flask import Flask, jsonify, send_from_directory, request
from flask_socketio import SocketIO, emit

# ── Flask App ──
app = Flask(__name__, static_folder='gui_assets', static_url_path='')
app.config['SECRET_KEY'] = 'allhackingtools_secret_key_v4'
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Update PATH environment variable globally for Python packages and local bins ──
path_env = os.environ.get("PATH", "")
separator = ';' if os.name == 'nt' else ':'
py_dir  = os.path.dirname(sys.executable)
scripts = os.path.join(py_dir, "Scripts" if os.name == "nt" else "bin")
local_bin = "/root/.local/bin" if os.name != 'nt' else ""
adds = [p for p in [BASE_DIR, scripts, local_bin] if p and p not in path_env]
if adds:
    os.environ["PATH"] = separator.join(adds) + separator + path_env

# ── Fallback Repos for dead links ──
FALLBACK_REPOS = {
    "https://github.com/AngelSecurityTeam/Cam-Hackers": "https://github.com/mrprogrammer2938/Cam-Hackers",
    "https://github.com/deadbits/Intersect-2.5":        "https://github.com/bonsaiviking/Intersect-2.5",
    "https://github.com/3UMOBKA/SMS-Bomber-300-Free":   "https://github.com/shueteam/SMS-Bomber-300-Free",
    "https://github.com/MaksPV/AresBomb":               "https://github.com/joker25000/AresBomb",
}

# ══════════════════════════════════════════════════════════════
# 1. TOOLS CATALOG
# ══════════════════════════════════════════════════════════════
def load_tools_catalog():
    path = os.path.join(BASE_DIR, 'tools_data.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

tools_catalog = load_tools_catalog()
tools_by_id = {}
for cat_obj in tools_catalog:
    for t in cat_obj.get("tools", []):
        tools_by_id[t["id"]] = {**t, "categoryName": cat_obj["category"]}

# ══════════════════════════════════════════════════════════════
# 2. HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════
def get_bash_path():
    if os.name != 'nt':
        return "/bin/bash"
    paths = [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
        r"C:\Windows\System32\bash.exe",
    ]
    for p in paths:
        if os.path.exists(p):
            return p
    return "bash"

def get_tool_dir(tool):
    if tool.get("repo"):
        url = tool["repo"].strip()
        if url.endswith(".git"):
            url = url[:-4]
        url = url.rstrip('/')
        folder = url.split("/")[-1]
        if folder:
            return folder
    cmds = tool.get("commands", [])
    if cmds:
        m = re.search(r'cd\s+([a-zA-Z0-9_\-\.]+)', cmds[0])
        if m:
            folder = m.group(1)
            if folder not in ("Files", "Tool", "Uninstall", "Themes", "src", "main"):
                return folder
    return None

def is_tool_installed(tool):
    import shutil
    
    # 1. Check if the git folder exists locally (cloned tool)
    folder = get_tool_dir(tool)
    if folder:
        if os.path.isdir(os.path.join(BASE_DIR, folder)):
            return True

    # 2. Check if the execution commands resolve to a binary on PATH
    cmds = tool.get("commands", [])
    if not cmds:
        return False

    first_cmd = cmds[0].strip()

    # Clean off sudo prefixes for binary checking
    clean_cmd_str = re.sub(r'^(sudo\s+|cd\s+\S+\s+&&\s+sudo\s+|cd\s+\S+\s+;\s+sudo\s+|cd\s+\S+\s+&&|cd\s+\S+\s+;)', '', first_cmd).strip()

    # If it cd's into a local folder (e.g. cd cupp && python cupp.py)
    m = re.match(r'^cd\s+([a-zA-Z0-9_\-\.]+)', first_cmd)
    if m:
        folder = m.group(1)
        if folder not in ("Files", "Tool", "Uninstall", "Themes", "src", "main"):
            # Check if that folder exists
            if os.path.isdir(os.path.join(BASE_DIR, folder)):
                # If there's a script inside, check if script exists
                script_match = re.search(r'(?:python|bash|sh|php|py)\s+([\w\-\./]+)', clean_cmd_str)
                if script_match:
                    if os.path.isfile(os.path.join(BASE_DIR, folder, script_match.group(1).split('/')[-1])):
                        return True
                else:
                    return True
            return False

    # Check for direct local files referenced (e.g. python src/Timer1.py)
    file_matches = re.findall(r'(?:python|bash|sh|php|py)\s+([\w\-\./]+)', clean_cmd_str)
    for path_str in file_matches:
        full_path = os.path.join(BASE_DIR, path_str)
        if os.path.isfile(full_path):
            return True

    # Standalone command checks (e.g. "nmap", "wireshark", "autopsy", "bloodhound-python", "nxc")
    parts = clean_cmd_str.split()
    if parts:
        executable = parts[0].strip()
        if executable not in ("python", "python3", "python2", "bash", "sh", "php", "git", "pip", "pip3"):
            # Check if it exists on PATH
            if shutil.which(executable):
                return True
            
            # Check python package script paths
            py_dir = os.path.dirname(sys.executable)
            for scripts_dir in [os.path.join(py_dir, "Scripts"), os.path.join(py_dir, "bin")]:
                if os.path.isfile(os.path.join(scripts_dir, executable)) or \
                   os.path.isfile(os.path.join(scripts_dir, executable + ".exe")):
                    return True
            return False

    # If it is a built-in menu helper or fallback, assume True
    if "hackingtool.py" in first_cmd or "Timer" in first_cmd:
        return True

    return False

def get_all_installed_statuses():
    return {tid: is_tool_installed(t) for tid, t in tools_by_id.items()}

def get_custom_env():
    env = os.environ.copy()
    py_dir  = os.path.dirname(sys.executable)
    scripts = os.path.join(py_dir, "Scripts" if os.name == "nt" else "bin")
    path    = env.get("PATH", "")
    separator = ';' if os.name == 'nt' else ':'
    adds = [BASE_DIR, scripts]
    if os.name != 'nt':
        adds.extend(["/root/.local/bin", "/root/go/bin"])
    adds = [p for p in adds if p and p not in path]
    if adds:
        env["PATH"] = separator.join(adds) + separator + path
    pypath = env.get("PYTHONPATH", "")
    env["PYTHONPATH"] = (BASE_DIR + separator + pypath).strip(separator)
    env["PYTHONUNBUFFERED"] = "1"
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    env["TERM"] = "xterm-256color"
    # PHANTOM-X PS1 prompt
    env["PS1"] = "\\[\\e[1;34m\\]\u250c\u2500\u2500(\\[\\e[1;35m\\]root\\[\\e[1;34m\\]\u2561\\[\\e[1;31m\\]PHANTOM-X\\[\\e[1;34m\\])-[\\[\\e[1;32m\\]\\w\\[\\e[1;34m\\]]\\n\u2514\u2500# \\[\\e[0m\\]"
    return env

def clean_command(cmd):
    """Strip menu-loop redirects, fix python2/3, strip sudo, add chmod +x for sh scripts"""
    # Strip menu redirects
    cmd = re.sub(r'&&\s*(python[23]?\s+)?hackingtool\.py', '', cmd)
    cmd = re.sub(r'&&\s*(python[23]?\s+)?Files/\w+Menu\.py', '', cmd)
    cmd = re.sub(r'&&\s*sleep\s+\d+', '', cmd)
    cmd = re.sub(r'&&\s*python[23]?\s+src/Timer\d+\.py', '', cmd)
    cmd = re.sub(r'&&\s*echo\s+done!?', '', cmd)
    
    # Add --break-system-packages for system-wide pip/pip3 commands on modern Python
    cmd = re.sub(r'\bpip\s+install\b', 'pip install --break-system-packages', cmd)
    cmd = re.sub(r'\bpip3\s+install\b', 'pip3 install --break-system-packages', cmd)
    
    # Ensure apt-get install uses -y and DEBIAN_FRONTEND=noninteractive
    cmd = re.sub(r'\bapt-get\s+install\b', 'DEBIAN_FRONTEND=noninteractive apt-get install -y', cmd)
    cmd = re.sub(r'\bapt\s+install\b', 'DEBIAN_FRONTEND=noninteractive apt install -y', cmd)
    
    # Normalize python calls to just 'python'
    cmd = re.sub(r'\bpython3\b', 'python', cmd)
    cmd = re.sub(r'\bpython2\b', 'python', cmd)
    # Replace pv (pipe viewer - Linux only) with cat
    cmd = re.sub(r'\bpv\b', 'cat', cmd)
    # Strip trailing && and whitespace
    cmd = cmd.strip().strip('&&').strip()
    return cmd

def add_chmod_for_sh(cmd):
    """Prepend chmod +x for any .sh script referenced in the command"""
    # Find all .sh files in the command
    sh_files = re.findall(r'([\w\-\.]+\.sh)', cmd)
    if not sh_files:
        return cmd
    chmod_parts = []
    # Also find any cd <dir> before a bash command
    cd_match = re.match(r'^cd\s+(\S+)', cmd.strip())
    prefix = ""
    if cd_match:
        dir_name = cd_match.group(1)
        for sh in sh_files:
            chmod_parts.append(f"chmod +x {dir_name}/{sh} 2>/dev/null || chmod +x {sh} 2>/dev/null")
    else:
        for sh in sh_files:
            chmod_parts.append(f"chmod +x {sh} 2>/dev/null")
    if chmod_parts:
        return " && ".join(chmod_parts) + " && " + cmd
    return cmd

def resolve_script_file(cmd, base_dir):
    """Try to find the correct case for python script names (handles mirrors with different casing)"""
    parts = [p.strip() for p in cmd.split("&&")]
    out = []
    cwd = base_dir
    for part in parts:
        part = part.strip()
        if not part:
            continue
        cd_m = re.match(r'^cd\s+(\S+)', part)
        if cd_m:
            cwd = os.path.normpath(os.path.join(cwd, cd_m.group(1)))
            out.append(part)
            continue
        py_m = re.match(r'^(python\s+)(\S+)(.*)', part)
        if py_m:
            script = py_m.group(2)
            full = os.path.join(cwd, script)
            if not os.path.isfile(full):
                d, n = os.path.split(full)
                if os.path.isdir(d):
                    norm = n.lower().replace("-","").replace("_","")
                    for f in os.listdir(d):
                        if f.lower().replace("-","").replace("_","") == norm:
                            part = py_m.group(1) + f + py_m.group(3)
                            break
        out.append(part)
    return " && ".join(out)

# ══════════════════════════════════════════════════════════════
# 3. PROCESS MANAGER
# ══════════════════════════════════════════════════════════════
client_sessions = {}
sessions_lock = threading.Lock()

def get_session(sid):
    with sessions_lock:
        return client_sessions.get(sid)

def init_session(sid):
    with sessions_lock:
        client_sessions[sid] = {
            'process': None,
            'type': None,
            'name': None,
            'master_fd': None,
            'active_install_tool_id': None,
            'cols': 80,
            'rows': 24
        }

def delete_session(sid):
    with sessions_lock:
        sess = client_sessions.pop(sid, None)
        if sess:
            proc = sess.get('process')
            if proc:
                kill_process_tree(proc)

def cleanup_broken_install(sid):
    sess = get_session(sid)
    if sess:
        tool_id = sess.get('active_install_tool_id')
        if tool_id:
            tool = tools_by_id.get(tool_id)
            if tool:
                folder = get_tool_dir(tool)
                if folder:
                    path = os.path.join(BASE_DIR, folder)
                    if os.path.isdir(path):
                        print(f"[CLEANUP] Warning: Install command returned non-zero exit code for session {sid}: {path}. Keeping directory for manual troubleshooting.")
            with sessions_lock:
                if sid in client_sessions:
                    client_sessions[sid]['active_install_tool_id'] = None
            socketio.emit('installed_status_update', get_all_installed_statuses(), room=sid)

def kill_process_tree(proc):
    if proc and proc.poll() is None:
        try:
            print(f"[KILL] Killing PID {proc.pid} and children...")
            if os.name == 'nt':
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    capture_output=True, check=False, timeout=5
                )
            else:
                import signal
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    proc.kill()
        except Exception as e:
            print(f"[KILL ERROR] {e}")
            try:
                proc.kill()
            except Exception:
                pass

def read_proc_stdout(proc, proc_type, proc_name, sid):
    FILTER_LINES = ["cannot set terminal process group", "no job control in this shell",
                    "bash: cannot", "bash: no job"]
    filter_startup = (proc_type == 'interactive')
    line_buf = ""
    startup_lines = 0
    try:
        while True:
            chunk = proc.stdout.read(1)
            if not chunk:
                break
            try:
                ch = chunk.decode('utf-8', errors='replace')
            except Exception:
                ch = chunk.decode('cp1252', errors='replace')

            if filter_startup:
                line_buf += ch
                if ch == '\n':
                    startup_lines += 1
                    low = line_buf.lower().strip()
                    should_filter = any(f in low for f in FILTER_LINES)
                    if not should_filter:
                        socketio.emit('process_output', {'data': line_buf}, room=sid)
                    line_buf = ""
                    if startup_lines >= 6:
                        filter_startup = False
                elif len(line_buf) > 200:
                    socketio.emit('process_output', {'data': line_buf}, room=sid)
                    line_buf = ""
                    filter_startup = False
            else:
                socketio.emit('process_output', {'data': ch}, room=sid)

    except Exception as e:
        print(f"[STDOUT READ ERROR] {proc_name} for session {sid}: {e}")
    finally:
        print(f"[STDOUT ENDED] {proc_name} for session {sid}")
        with sessions_lock:
            if sid in client_sessions and client_sessions[sid].get('process') is proc:
                client_sessions[sid].update({
                    'process': None,
                    'type': None,
                    'name': None,
                    'master_fd': None
                })

        code = proc.poll() if proc.poll() is not None else 0
        socketio.emit('process_exit', {'type': proc_type, 'name': proc_name, 'code': code}, room=sid)
        socketio.emit('running_state_update', {'running': False, 'type': None, 'name': None}, room=sid)

        if proc_type == 'install' and code != 0:
            cleanup_broken_install(sid)

        if proc_type in ('tool', 'install'):
            threading.Thread(target=lambda: (time.sleep(0.6), start_interactive_shell(sid)), daemon=True).start()

def read_proc_stderr(proc, sid):
    FILTER = ["cannot set terminal process group", "no job control"]
    try:
        for raw in iter(proc.stderr.readline, b''):
            try:
                line = raw.decode('utf-8', errors='replace')
            except Exception:
                line = raw.decode('cp1252', errors='replace')
            low = line.strip().lower()
            if any(f in low for f in FILTER):
                continue
            socketio.emit('process_output', {'data': line}, room=sid)
    except Exception as e:
        print(f"[STDERR READ ERROR] for session {sid}: {e}")

def read_proc_pty(proc, master_fd, proc_type, proc_name, sid):
    try:
        while True:
            try:
                chunk = os.read(master_fd, 4096)
                if not chunk:
                    break
            except OSError:
                break
            
            try:
                ch = chunk.decode('utf-8', errors='replace')
            except Exception:
                ch = chunk.decode('cp1252', errors='replace')
            
            socketio.emit('process_output', {'data': ch}, room=sid)
    except Exception as e:
        print(f"[PTY READ ERROR] {proc_name} for session {sid}: {e}")
    finally:
        print(f"[PTY ENDED] {proc_name} for session {sid}")
        try:
            os.close(master_fd)
        except OSError:
            pass
            
        with sessions_lock:
            if sid in client_sessions and client_sessions[sid].get('process') is proc:
                client_sessions[sid].update({
                    'process': None,
                    'type': None,
                    'name': None,
                    'master_fd': None
                })

        code = proc.poll() if proc.poll() is not None else 0
        socketio.emit('process_exit', {'type': proc_type, 'name': proc_name, 'code': code}, room=sid)
        socketio.emit('running_state_update', {'running': False, 'type': None, 'name': None}, room=sid)

        if proc_type == 'install' and code != 0:
            cleanup_broken_install(sid)

        if proc_type in ('tool', 'install'):
            threading.Thread(target=lambda: (time.sleep(0.6), start_interactive_shell(sid)), daemon=True).start()

def _spawn_proc(args, cwd, proc_type, proc_name, sid):
    sess = get_session(sid)
    cols = sess['cols'] if sess else 80
    rows = sess['rows'] if sess else 24
    
    env = get_custom_env()
    proc = None
    master_fd = None
    
    try:
        if os.name != 'nt':
            import pty
            master_fd, slave_fd = pty.openpty()
            
            try:
                import fcntl
                import termios
                import struct
                size = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(master_fd, termios.TIOCSWINSZ, size)
            except Exception as e:
                print(f"[PTY INIT RESIZE WARN] {e}")

            proc = subprocess.Popen(
                args,
                cwd=cwd,
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                bufsize=0,
                env=env,
                preexec_fn=os.setsid
            )
            os.close(slave_fd)
        else:
            proc = subprocess.Popen(
                args,
                cwd=cwd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                bufsize=0,
                env=env
            )
    except FileNotFoundError as e:
        socketio.emit('process_output', {'data': f'\r\n\x1b[1;31m[ERROR] Cannot start process: {e}\x1b[0m\r\n'}, room=sid)
        if master_fd is not None:
            try:
                os.close(master_fd)
            except OSError:
                pass
        return None

    with sessions_lock:
        if sid in client_sessions:
            client_sessions[sid].update({
                'process': proc,
                'type': proc_type,
                'name': proc_name,
                'master_fd': master_fd
            })

    if os.name != 'nt':
        t_out = threading.Thread(target=read_proc_pty, args=(proc, master_fd, proc_type, proc_name, sid), daemon=True)
        t_out.start()
    else:
        t_out = threading.Thread(target=read_proc_stdout, args=(proc, proc_type, proc_name, sid), daemon=True)
        t_err = threading.Thread(target=read_proc_stderr, args=(proc, sid), daemon=True)
        t_out.start()
        t_err.start()

    socketio.emit('running_state_update', {
        'running': proc_type in ('tool', 'install'),
        'type':    proc_type,
        'name':    proc_name,
    }, room=sid)
    return proc

def start_interactive_shell(sid):
    sess = get_session(sid)
    if not sess:
        return None
    proc = sess.get('process')
    if proc and proc.poll() is None:
        return proc
        
    bash = get_bash_path()
    print(f"[SHELL] Spawning interactive bash for {sid}: {bash}")
    temp_rc = os.path.join(BASE_DIR, ".bashrc_temp")
    # Always write/refresh .bashrc_temp and remove clear to preserve process outputs
    with open(temp_rc, "w", encoding="utf-8") as f:
        f.write('export PATH="$PATH:/root/go/bin:/root/.local/bin"\n')
        f.write('export PS1="\\[\\e[1;34m\\]\u250c\u2500\u2500(\\[\\e[1;35m\\]root\\[\\e[1;34m\\]\u2561\\[\\e[1;31m\\]PHANTOM-X\\[\\e[1;34m\\])-[\\[\\e[1;32m\\]\\w\\[\\e[1;34m\\]]\\n\u2514\u2500# \\[\\e[0m\\]"\n')
        f.write('alias ls="ls --color=auto"\n')
        f.write('alias dir="dir --color=auto"\n')
        f.write('alias grep="grep --color=auto"\n')
        f.write('cd /root/hackingtool\n')
    return _spawn_proc([bash, "--rcfile", temp_rc, "-i"], BASE_DIR, 'interactive', 'Interactive Shell', sid)

def start_tool_process(cmd_str, proc_type, tool_name, sid):
    sess = get_session(sid)
    if not sess:
        return None
    proc = sess.get('process')
    if proc:
        print(f"[REPLACE] Killing '{sess.get('name')}' to start '{tool_name}' for session {sid}")
        kill_process_tree(proc)
        with sessions_lock:
            if sid in client_sessions:
                client_sessions[sid].update({
                    'process': None,
                    'type': None,
                    'name': None,
                    'master_fd': None
                })
    time.sleep(0.4)
    cmd_str = add_chmod_for_sh(cmd_str)
    print(f"[TOOL] Running: {cmd_str[:120]} for session {sid}")
    return _spawn_proc([get_bash_path(), "-c", cmd_str], BASE_DIR, proc_type, tool_name, sid)

# ══════════════════════════════════════════════════════════════
# 4. STATUS LOOP
# ══════════════════════════════════════════════════════════════
def status_updater_loop():
    while True:
        try:
            socketio.emit('installed_status_update', get_all_installed_statuses())
        except Exception:
            pass
        time.sleep(4)

# ══════════════════════════════════════════════════════════════
# 5. FLASK ROUTES
# ══════════════════════════════════════════════════════════════
@app.route('/')
def index():
    ua = request.headers.get('User-Agent', '')
    if 'Electron' in ua:
        return app.send_static_file('desktop.html')
    elif 'VenomOS-Mobile' in ua:
        return app.send_static_file('mobile.html')
    else:
        return app.send_static_file('index.html')

@app.route('/api/tools')
def api_tools():
    resp = jsonify(tools_catalog)
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return resp

@app.route('/api/status')
def api_status():
    running = any(
        s.get('type') in ('tool', 'install') and s.get('process') is not None and s.get('process').poll() is None
        for s in client_sessions.values()
    )
    return jsonify({
        'running': running,
        'type': 'tool' if running else None,
        'name': 'Multiple Processes' if running else None
    })

# ══════════════════════════════════════════════════════════════
# 6. SOCKET.IO EVENTS
# ══════════════════════════════════════════════════════════════
@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f"[SOCKET] Client connected: {sid}")
    init_session(sid)
    emit('session_info', {
        'use_pty': (os.name != 'nt')
    })
    start_interactive_shell(sid)
    emit('installed_status_update', get_all_installed_statuses(), room=sid)
    sess = get_session(sid)
    if sess:
        proc = sess.get('process')
        emit('running_state_update', {
            'running': sess.get('type') in ('tool', 'install') and proc is not None and proc.poll() is None,
            'type':    sess.get('type'),
            'name':    sess.get('name'),
        }, room=sid)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f"[SOCKET] Client disconnected: {sid}")
    delete_session(sid)

@socketio.on('get_installed_status')
def handle_get_status():
    emit('installed_status_update', get_all_installed_statuses(), room=request.sid)

def make_execution_template(cmd, tool_name):
    name_lower = tool_name.lower().strip()
    
    # ── Non-interactive / info only (with newline) ──
    if "openvas" in name_lower:
        return "echo 'OpenVAS is best run via docker-compose'\n"
    elif "security onion" in name_lower:
        return "echo 'Visit Security Onion documentation at https://docs.securityonion.net/'\n"
    elif "elk stack" in name_lower:
        return "echo 'Elasticsearch, Logstash, Kibana log pipeline.'\n"
    elif "graylog" in name_lower:
        return "echo 'Graylog requires MongoDB and OpenSearch. See: https://go2graylog.org/graylog-install'\n"
    elif "misp" in name_lower:
        return "echo 'MISP is best run via docker-compose: git clone https://github.com/MISP/misp-docker.git'\n"
    elif "opencti" in name_lower:
        return "echo 'OpenCTI is recommended to run via docker-compose: https://github.com/OpenCTI-Platform/docker.git'\n"
    elif "prelude operator" in name_lower:
        return "echo 'Prelude Operator is a desktop client application: https://www.prelude.org/'\n"
    elif "burp suite" in name_lower:
        return "echo 'Burp Suite community edition installer downloaded. Run ./burpsuite_community.sh to install.'\n"
    elif "atomic red team" in name_lower:
        return "echo 'Atomic Red Team repository cloned under atomic-red-team/'\n"

    # ── Menu / Interactive commands (with newline) ──
    elif "recon-ng" in name_lower:
        return "python recon-ng/recon-ng\n"
    elif "spiderfoot" in name_lower:
        return "python spiderfoot/sf.py -l 127.0.0.1:5001\n"
    elif "nuclei templates" in name_lower:
        return "nuclei -ut\n"
    elif "kube-bench" in name_lower:
        return "./kube-bench/kube-bench run\n"
    elif "kube-hunter" in name_lower:
        return "python kube-hunter/kube-hunter.py\n"
    elif "caldera" in name_lower:
        return "python caldera/server.py --insecure\n"
    elif "lynis" in name_lower:
        return "./lynis/lynis audit system\n"
    elif "wazuh" in name_lower:
        return "curl -sO https://packages.wazuh.com/4.x/wazuh-install.sh && bash wazuh-install.sh --help\n"
    elif "autopsy" in name_lower:
        return "autopsy\n"

    # ── Commands requiring target arguments (prompt using read -p) ──
    elif "theharvester" in name_lower:
        return 'read -p "Enter target domain: " target && theHarvester -d "$target" -b crtsh,duckduckgo,hackertarget,otx,rapiddns,subdomaincenter,yahoo\n'
    elif "subfinder" in name_lower:
        return 'read -p "Enter target domain: " target && subfinder -d "$target"\n'
    elif "amass" in name_lower:
        return 'read -p "Enter target domain: " target && amass enum -d "$target"\n'
    elif "assetfinder" in name_lower:
        return 'read -p "Enter target domain: " target && assetfinder --subs-only "$target"\n'
    elif "nmap" in name_lower:
        return 'read -p "Enter target IP/Domain: " target && nmap -A -v "$target"\n'
    elif "masscan" in name_lower:
        return 'read -p "Enter target IP range: " target && masscan --ports 0-65535 "$target"\n'
    elif "rustscan" in name_lower:
        return 'read -p "Enter target IP/Domain: " target && rustscan -a "$target"\n'
    elif "naabu" in name_lower:
        return 'read -p "Enter target IP/Domain: " target && naabu -host "$target"\n'
    elif "nuclei" in name_lower:
        return 'read -p "Enter target URL/Domain: " target && nuclei -u "$target"\n'
    elif "katana" in name_lower:
        return 'read -p "Enter target URL: " target && katana -u "$target"\n'
    elif "httpx" in name_lower:
        return 'read -p "Enter target URL/Domain: " target && httpx -u "$target"\n'
    elif "ffuf" in name_lower:
        return 'read -p "Enter target URL (e.g. http://192.168.1.1/FUZZ): " target && read -p "Enter wordlist path: " wlist && ffuf -u "$target" -w "${wlist:-/usr/share/wordlists/dirb/common.txt}"\n'
    elif "dirsearch" in name_lower:
        return 'read -p "Enter target URL: " target && python dirsearch/dirsearch.py -u "$target"\n'
    elif "xsstrike" in name_lower:
        return 'read -p "Enter target URL: " target && python XSStrike/xsstrike.py -u "$target"\n'
    elif "sqlmap" in name_lower:
        return 'read -p "Enter target URL: " target && python sqlmap/sqlmap.py -u "$target"\n'
    elif "trivy" in name_lower:
        return 'read -p "Enter image name (e.g. ubuntu): " target && trivy image "$target"\n'
    elif "nikto" in name_lower:
        return 'read -p "Enter target URL/Domain: " target && perl nikto/program/nikto.pl -h "$target"\n'
    elif "hashcat" in name_lower:
        return 'read -p "Enter hash file path: " target && read -p "Enter wordlist path: " wlist && hashcat -m 0 "$target" "$wlist"\n'
    elif "john" in name_lower:
        return 'read -p "Enter hash file path: " target && john "$target"\n'
    elif "cewl" in name_lower:
        return 'read -p "Enter target URL: " target && ruby CeWL/cewl.rb "$target"\n'
    elif "scoutsuite" in name_lower:
        return 'read -p "Enter cloud provider (aws/gcp/azure): " target && scout "$target"\n'
    elif "prowler" in name_lower:
        return 'read -p "Enter cloud provider (aws/gcp/azure): " target && prowler "$target"\n'
    elif "cloudsplaining" in name_lower:
        return 'read -p "Enter IAM policy JSON file path: " target && cloudsplaining --input "$target"\n'
    elif "zeek" in name_lower:
        return 'read -p "Enter pcap file path or interface: " target && zeek "$target"\n'
    elif "suricata" in name_lower:
        return 'read -p "Enter interface (e.g. eth0): " target && suricata -c /etc/suricata/suricata.yaml -i "$target"\n'
    elif "snort" in name_lower:
        return 'read -p "Enter interface or pcap path: " target && snort -c /etc/snort/snort.lua "$target"\n'
    elif "volatility" in name_lower:
        return 'read -p "Enter memory dump file path: " target && python volatility3/vol.py -f "$target"\n'
    elif "chainsaw" in name_lower:
        return 'read -p "Enter event log file/dir path: " target && chainsaw search "$target"\n'
    elif "hayabusa" in name_lower:
        return 'read -p "Enter event log file/dir path: " target && hayabusa csv-timeline -f "$target"\n'
    elif "yara" in name_lower:
        return 'read -p "Enter rule file path: " target && read -p "Enter target dir/file: " dest && yara "$target" "$dest"\n'
    elif "openscap" in name_lower:
        return 'read -p "Enter XCCDF file path: " target && oscap xccdf eval "$target"\n'
    elif "falco" in name_lower:
        return 'read -p "Enter arguments: " target && falco $target\n'
    elif "auditd" in name_lower:
        return 'read -p "Enter rule arguments: " target && auditctl $target\n'
    elif "wireshark" in name_lower:
        return 'read -p "Enter capture interface (e.g. eth0): " target && tshark -i "$target"\n'

    # Clean help parameters for generic command fallback
    cmd = re.sub(r'\b(python3|python2)\b', 'python', cmd)
    cmd = re.sub(r'\s+(-h|--help|-help|-version|--version|show options)\b.*$', '', cmd)
    
    # Generic prompt fallback
    return f'read -p "Enter target/arguments: " target && {cmd} $target\n'

@socketio.on('run_tool')
def handle_run_tool(data):
    sid = request.sid
    tool_id = data.get('tool_id')
    tool    = tools_by_id.get(tool_id)
    if not tool:
        emit('process_output', {'data': f'\r\n\x1b[1;31m[ERROR] Tool not found: {tool_id}\x1b[0m\r\n'}, room=sid)
        return

    cmds = tool.get('commands', [])
    if not cmds:
        emit('process_output', {'data': '\r\n\x1b[1;31m[ERROR] No execution command for this tool.\x1b[0m\r\n'}, room=sid)
        return

    raw_cmd     = cmds[0]
    cleaned     = clean_command(raw_cmd)
    resolved    = resolve_script_file(cleaned, BASE_DIR)

    template = make_execution_template(resolved, tool['name'])

    sess = get_session(sid)
    if sess:
        proc = sess.get('process')
        m_fd = sess.get('master_fd')
        if proc and proc.poll() is None:
            emit('process_output', {'data': f'\r\n\x1b[1;32m[►] Launching {tool["name"]} Template into Terminal...\x1b[0m\r\n'}, room=sid)
            try:
                if m_fd is not None:
                    # Write SIGINT (Ctrl+C) to clear/cancel any running tool/command
                    os.write(m_fd, b'\x03')
                    time.sleep(0.4)
                    # Write Ctrl+U to clear the line completely (removes any junk characters/remnants)
                    os.write(m_fd, b'\x15')
                    time.sleep(0.05)
                    # Write the execution template command
                    os.write(m_fd, template.encode('utf-8'))
                else:
                    proc.stdin.write(b'\x03')
                    proc.stdin.flush()
                    time.sleep(0.4)
                    proc.stdin.write(b'\x15')
                    proc.stdin.flush()
                    time.sleep(0.05)
                    proc.stdin.write(template.encode('utf-8'))
                    proc.stdin.flush()
            except Exception as e:
                print(f"[PASTE ERROR] {e}")
                start_tool_process(resolved, 'tool', tool['name'], sid)
            return

    emit('process_output', {'data': f'\r\n\x1b[1;32m[►] Executing: {tool["name"]}\x1b[0m\r\n'}, room=sid)
    emit('process_output', {'data': f'\x1b[0;90m    CMD: {resolved}\x1b[0m\r\n\r\n'}, room=sid)
    start_tool_process(resolved, 'tool', tool['name'], sid)

@socketio.on('install_tool')
def handle_install_tool(data):
    sid = request.sid
    tool_id = data.get('tool_id')
    tool    = tools_by_id.get(tool_id)
    if not tool:
        emit('process_output', {'data': f'\r\n\x1b[1;31m[ERROR] Tool not found: {tool_id}\x1b[0m\r\n'}, room=sid)
        return

    with sessions_lock:
        if sid in client_sessions:
            client_sessions[sid]['active_install_tool_id'] = tool_id

    # If folder already exists, delete it first to ensure clean install (prevents git clone conflicts)
    folder_name = get_tool_dir(tool)
    if folder_name:
        folder_path = os.path.join(BASE_DIR, folder_name)
        if os.path.isdir(folder_path):
            print(f"[INSTALL PREP] Cleaning existing folder before fresh install for session {sid}: {folder_path}")
            import shutil
            shutil.rmtree(folder_path, ignore_errors=True)

    # 1. Custom install commands (Z4nzu's metadata)
    install_cmds = tool.get('install_commands', [])
    if install_cmds:
        wrapped_cmds = []
        for c in install_cmds:
            c_str = c.strip()
            if c_str.startswith("(") and c_str.endswith(")"):
                wrapped_cmds.append(c_str)
            else:
                wrapped_cmds.append(f"({c_str})")
        cmd_str = " && ".join(wrapped_cmds)
        cleaned = clean_command(cmd_str)
        emit('process_output', {'data': f'\r\n\x1b[1;33m[►] Installing: {tool["name"]}...\x1b[0m\r\n'}, room=sid)
        emit('process_output', {'data': f'\x1b[0;90m    CMD: {cleaned}\x1b[0m\r\n\r\n'}, room=sid)
        start_tool_process(cleaned, 'install', tool['name'], sid)
        return

    # 2. Fallback to basic git cloning
    repo_url    = tool.get('repo', '').strip()
    folder_name = get_tool_dir(tool)

    if not repo_url:
        cmds = [w.strip() for w in tool.get('commands', []) if w.strip()]
        if cmds:
            first = cmds[0]
            cleaned_binary = re.sub(r'^(sudo\s+|cd\s+\S+\s+&&\s+sudo\s+|cd\s+\S+\s+;\s+sudo\s+|cd\s+\S+\s+&&|cd\s+\S+\s+;)', '', first).strip().split()[0]
            if " " not in first and "/" not in first and "\\" not in first and first != "hackingtool.py":
                emit('process_output', {'data': f'\r\n\x1b[1;33m[►] pip installing: {first}...\x1b[0m\r\n'}, room=sid)
                start_tool_process(f"python -m pip install --break-system-packages {first}", 'install', tool['name'], sid)
                return
            elif cleaned_binary not in ("python", "python3", "python2", "bash", "sh", "php", "git", "pip", "pip3", "hackingtool.py"):
                emit('process_output', {'data': f'\r\n\x1b[1;33m[►] Installing package: {cleaned_binary} via apt...\x1b[0m\r\n'}, room=sid)
                start_tool_process(f"DEBIAN_FRONTEND=noninteractive apt-get install -y {cleaned_binary}", 'install', tool['name'], sid)
                return
        emit('process_output', {'data': '\r\n\x1b[1;33m[INFO] No repo URL or install commands — this tool may be built-in.\x1b[0m\r\n'}, room=sid)
        return

    fallback = FALLBACK_REPOS.get(repo_url)
    pip_part = ""
    if folder_name:
        pip_part = f" && if [ -f {folder_name}/requirements.txt ]; then python -m pip install --break-system-packages -r {folder_name}/requirements.txt --quiet; fi"

    if fallback:
        if folder_name:
            clone_cmd = f"(git clone --depth=1 {repo_url} {folder_name} || (echo '[WARN] Main repo failed, using mirror...' && git clone --depth=1 {fallback} {folder_name})){pip_part}"
        else:
            clone_cmd = f"(git clone --depth=1 {repo_url} || (echo '[WARN] Main repo failed, using mirror...' && git clone --depth=1 {fallback}))"
    else:
        if folder_name:
            clone_cmd = f"git clone --depth=1 {repo_url} {folder_name}{pip_part}"
        else:
            clone_cmd = f"git clone --depth=1 {repo_url}"

    emit('process_output', {'data': f'\r\n\x1b[1;33m[►] Installing: {tool["name"]}...\x1b[0m\r\n'}, room=sid)
    start_tool_process(clone_cmd, 'install', tool['name'], sid)

@socketio.on('uninstall_tool')
def handle_uninstall_tool(data):
    sid = request.sid
    tool_id = data.get('tool_id')
    tool    = tools_by_id.get(tool_id)
    if not tool:
        emit('process_output', {'data': f'\r\n\x1b[1;31m[ERROR] Tool not found: {tool_id}\x1b[0m\r\n'}, room=sid)
        return

    emit('process_output', {'data': f'\r\n\x1b[1;31m[►] Uninstalling: {tool["name"]}...\x1b[0m\r\n'}, room=sid)

    # 1. Delete cloned git folder if it exists
    folder_name = get_tool_dir(tool)
    if folder_name:
        folder_path = os.path.join(BASE_DIR, folder_name)
        if os.path.isdir(folder_path):
            import shutil
            shutil.rmtree(folder_path, ignore_errors=True)
            emit('process_output', {'data': f'\x1b[0;90m    Cleaned directory: {folder_name}\x1b[0m\r\n'}, room=sid)

    # 2. Run pip uninstall system-wide to remove global wrapper binaries
    pkg_names = [tool['name'], tool_id]
    if folder_name:
        pkg_names.append(folder_name)
    # Deduplicate
    pkg_names = list(set(p for p in pkg_names if p))
    
    for pkg in pkg_names:
        try:
            res = subprocess.run(
                ["pip3", "uninstall", "-y", pkg, "--break-system-packages"],
                capture_output=True, timeout=10
            )
            if res.returncode == 0:
                emit('process_output', {'data': f'\x1b[0;90m    Uninstalled Python package: {pkg}\x1b[0m\r\n'}, room=sid)
        except Exception:
            pass

    # 3. Clean up go/pip local binaries from PATH
    cmds = tool.get('commands', [])
    if cmds:
        first_cmd = cmds[0].strip()
        clean_cmd_str = re.sub(r'^(sudo\s+|cd\s+\S+\s+&&\s+sudo\s+|cd\s+\S+\s+;\s+sudo\s+|cd\s+\S+\s+&&|cd\s+\S+\s+;)', '', first_cmd).strip()
        parts = clean_cmd_str.split()
        if parts:
            executable = parts[0].strip()
            if executable not in ("python", "python3", "python2", "bash", "sh", "php", "git", "pip", "pip3", "hackingtool.py"):
                for bin_dir in ["/root/go/bin", "/root/.local/bin"]:
                    bin_path = os.path.join(bin_dir, executable)
                    if os.path.isfile(bin_path):
                        try:
                            os.remove(bin_path)
                            emit('process_output', {'data': f'\x1b[0;90m    Removed local binary: {bin_path}\x1b[0m\r\n'}, room=sid)
                        except Exception as e:
                            print(f"[UNINSTALL ERROR] Failed to remove {bin_path}: {e}")

    emit('process_output', {'data': f'\x1b[1;32m[✓] Successfully uninstalled and deleted files for: {tool["name"]}\x1b[0m\r\n'}, room=sid)
    
    socketio.emit('installed_status_update', get_all_installed_statuses())

@socketio.on('send_input')
def handle_send_input(data):
    sid = request.sid
    inp = data.get('data', '')
    sess = get_session(sid)
    if not sess:
        return
    proc = sess.get('process')
    m_fd = sess.get('master_fd')
    if proc and proc.poll() is None:
        try:
            if m_fd is not None:
                os.write(m_fd, inp.encode('utf-8'))
            else:
                proc.stdin.write(inp.encode('utf-8'))
                proc.stdin.flush()
        except Exception as e:
            print(f"[INPUT ERROR] for session {sid}: {e}")

@socketio.on('resize_terminal')
def handle_resize_terminal(data):
    sid = request.sid
    cols = data.get('cols', 80)
    rows = data.get('rows', 24)
    with sessions_lock:
        if sid in client_sessions:
            client_sessions[sid]['cols'] = cols
            client_sessions[sid]['rows'] = rows
    sess = get_session(sid)
    if sess:
        m_fd = sess.get('master_fd')
        if m_fd is not None:
            try:
                import fcntl
                import termios
                import struct
                size = struct.pack('HHHH', rows, cols, 0, 0)
                fcntl.ioctl(m_fd, termios.TIOCSWINSZ, size)
                print(f"[RESIZE] Set terminal size to {cols}x{rows} for session {sid}")
            except Exception as e:
                print(f"[RESIZE ERROR] for session {sid}: {e}")

@socketio.on('kill_process')
def handle_kill():
    sid = request.sid
    sess = get_session(sid)
    if sess:
        proc = sess.get('process')
        m_fd = sess.get('master_fd')
        if proc and proc.poll() is None:
            emit('process_output', {'data': '\r\n\x1b[1;31m[SYSTEM] Interrupting current process (SIGINT)...\x1b[0m\r\n'}, room=sid)
            try:
                if m_fd is not None:
                    os.write(m_fd, b'\x03')
                else:
                    proc.stdin.write(b'\x03')
                    proc.stdin.flush()
            except Exception as e:
                print(f"[KILL ERROR] {e}")
                kill_process_tree(proc)

@socketio.on('reset_directory')
def handle_reset_directory():
    sid = request.sid
    sess = get_session(sid)
    if sess:
        proc = sess.get('process')
        m_fd = sess.get('master_fd')
        if proc and proc.poll() is None:
            path = "/root/hackingtool" if os.name != 'nt' else BASE_DIR.replace('\\', '/')
            cmd = f'cd "{path}" && clear\n'
            try:
                if m_fd is not None:
                    os.write(m_fd, cmd.encode('utf-8'))
                else:
                    proc.stdin.write(cmd.encode('utf-8'))
                    proc.stdin.flush()
            except Exception as e:
                print(f"[RESET DIR ERROR] for session {sid}: {e}")

# ══════════════════════════════════════════════════════════════
# 7. ENTRY POINT
# ══════════════════════════════════════════════════════════════
if __name__ == '__main__':
    PORT = 5000
    print(f"\n{'='*60}")
    print(f"  PHANTOM-X Security Intelligence Platform")
    print(f"  Dashboard  -->  http://localhost:{PORT}")
    print(f"{'='*60}\n")

    # Pre-chmod all .sh scripts so bash tools don't get Permission denied
    def _pre_chmod_all():
        bash = get_bash_path()
        path = BASE_DIR.replace('\\', '/') if os.name == 'nt' else BASE_DIR
        try:
            subprocess.run(
                [bash, "-c", f"find '{path}' -maxdepth 5 -name '*.sh' | xargs chmod +x 2>/dev/null; echo ok"],
                capture_output=True, timeout=10
            )
            print("[CHMOD] Pre-chmod all .sh scripts done.")
        except Exception as e:
            print(f"[CHMOD WARN] {e}")
    threading.Thread(target=_pre_chmod_all, daemon=True).start()

    threading.Thread(target=status_updater_loop, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=PORT, debug=False, allow_unsafe_werkzeug=True)
