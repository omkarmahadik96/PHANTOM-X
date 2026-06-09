// ═══════════════════════════════════════════════════════════════
//  AllHackingTools - Mobile HUD View Controller
// ═══════════════════════════════════════════════════════════════

// ── Global State ──
let socket = null;
let terminal = null;
let fitAddon = null;
let allCategories = [];
let currentCategory = "All Tools";
let selectedTool = null;
let installedMap = {};
let runningState = { running: false, type: null, name: null };
let inputBuffer = "";
let usePty = false;

// ── Bootstrap on DOM ready ──
document.addEventListener("DOMContentLoaded", () => {
    initTerminal();
    initSocket();
    initEventListeners();
    fetchToolsData();
    initMobileTabs();
});

// ═══════════════════════════════════════════════════════════════
//  1. MOBILE TAB SWITCHER
// ═══════════════════════════════════════════════════════════════
function initMobileTabs() {
    const navButtons = document.querySelectorAll(".mob-nav-btn");
    navButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Sync nav buttons
    document.querySelectorAll(".mob-nav-btn").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-tab") === tabId);
    });

    // Sync tab views
    document.querySelectorAll(".mob-tab-view").forEach(view => {
        view.classList.toggle("active", view.id === tabId);
    });

    // Recalculate terminal layout if terminal tab becomes active
    if (tabId === "tab-terminal") {
        setTimeout(doFit, 200);
    }
}

// ═══════════════════════════════════════════════════════════════
//  2. XTERM TERMINAL
// ═══════════════════════════════════════════════════════════════
function initTerminal() {
    terminal = new Terminal({
        cursorBlink: true,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        scrollback: 5000,
        theme: getTermTheme(document.getElementById("theme-selector")?.value || "theme-kali")
    });

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(document.getElementById("terminal"));

    // Print welcome banner
    terminal.writeln("\x1b[1;31m\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u251c\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[1;37mPHANTOM-X\x1b[1;31m \u2014 Mobile Console PTY Client \x1b[0;90mv1.0\x1b[1;31m      \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[0;90m Swipe Tabs \u2192 Select categories \u2192 Run tool\x1b[1;31m      \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u251c\x1b[0m");
    terminal.writeln("");
    terminal.writeln("\x1b[0;90m  Tap and type | Swipe to navigate | STOP to abort\x1b[0m");
    terminal.writeln("");

    setTimeout(doFit, 400);

    // ResizeObserver on the xterm-container (most reliable)
    const xtermContainer = document.getElementById("xterm-container");
    if (xtermContainer && window.ResizeObserver) {
        const ro = new ResizeObserver(() => doFit());
        ro.observe(xtermContainer);
    }
    window.addEventListener("resize", () => setTimeout(doFit, 150));

    // Pass typing directly to backend
    terminal.onData((data) => {
        // Handle Ctrl+C (\x03) -> Perform copy if selection exists
        if (data === '\x03') {
            if (terminal.hasSelection()) {
                navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
                return;
            }
        }

        // Handle Ctrl+X (\x18) -> Kill running process/exit current tool
        if (data === '\x18') {
            terminal.write("^X\r\n\x1b[1;31m[SYSTEM] SIGINT (Ctrl+X) received. Terminating process...\x1b[0m\r\n");
            if (socket && socket.connected) {
                socket.emit("kill_process");
            }
            return;
        }

        if (usePty) {
            if (socket && socket.connected) {
                socket.emit("send_input", { data });
            }
            return;
        }

        // Buffer Mode for Windows fallback
        if (data === '\r' || data === '\n') {
            if (socket && socket.connected) {
                socket.emit("send_input", { data: inputBuffer + "\n" });
            }
            terminal.write("\r\n");
            inputBuffer = "";
            return;
        }

        if (data === '\x7f' || data === '\x08') {
            if (inputBuffer.length > 0) {
                inputBuffer = inputBuffer.slice(0, -1);
                terminal.write("\b \b");
            }
            return;
        }

        if (data.startsWith('\x1b')) {
            if (socket && socket.connected) {
                socket.emit("send_input", { data });
            }
            return;
        }

        if (data.charCodeAt(0) >= 32 || data === '\t') {
            inputBuffer += data;
            terminal.write(data);
        }
    });

    // Handle terminal resize events
    terminal.onResize((size) => {
        if (socket && socket.connected) {
            socket.emit("resize_terminal", { cols: size.cols, rows: size.rows });
        }
    });
}

function doFit() {
    try {
        if (fitAddon) fitAddon.fit();
    } catch(e) {}
}

function getTermTheme(themeClass) {
    const themes = {
        "theme-kali":   { background: "#050508", foreground: "#d8d0f0", cursor: "#8c52ff", cursorAccent: "#000", selectionBackground: "rgba(140,82,255,0.3)" },
        "theme-matrix": { background: "#010401", foreground: "#00ff66", cursor: "#00ff66", cursorAccent: "#000", selectionBackground: "rgba(0,255,102,0.25)" },
        "theme-blood":  { background: "#080105", foreground: "#ff8888", cursor: "#ff3366", cursorAccent: "#000", selectionBackground: "rgba(255,51,102,0.25)" },
        "theme-ice":    { background: "#020710", foreground: "#80ccff", cursor: "#00eeff", cursorAccent: "#000", selectionBackground: "rgba(0,238,255,0.25)" },
        "theme-slate":  { background: "#050607", foreground: "#e8ecff", cursor: "#ffffff", cursorAccent: "#000", selectionBackground: "rgba(255,255,255,0.2)"  },
    };
    return themes[themeClass] || themes["theme-kali"];
}

// ═══════════════════════════════════════════════════════════════
//  3. SOCKET.IO
// ═══════════════════════════════════════════════════════════════
function initSocket() {
    socket = io();

    const connDot   = document.getElementById("conn-dot");
    const connLabel = document.getElementById("conn-label");

    socket.on("session_info", (info) => {
        usePty = info.use_pty;
        console.log("[SESSION] PTY active:", usePty);
    });

    socket.on("connect", () => {
        connDot.className   = "net-status-dot connected";
        connLabel.textContent = "ONLINE HUD LINK";
        socket.emit("get_installed_status");
        
        if (terminal) {
            socket.emit("resize_terminal", { cols: terminal.cols, rows: terminal.rows });
        }
    });

    socket.on("disconnect", () => {
        connDot.className   = "net-status-dot disconnected";
        connLabel.textContent = "OFFLINE LINK";
    });

    socket.on("process_output", (data) => {
        if (terminal) terminal.write(data.data);
    });

    socket.on("process_exit", (data) => {
        if (terminal && data.type !== "interactive") {
            terminal.writeln(`\r\n\x1b[0;31m[PROCESS EXIT] code: ${data.code}\x1b[0m`);
        }
        socket.emit("get_installed_status");
    });

    socket.on("running_state_update", (state) => {
        runningState = state;
        applyRunningUIState();
    });

    socket.on("installed_status_update", (map) => {
        installedMap = map;
        syncBadges(map);
    });
}

// ═══════════════════════════════════════════════════════════════
//  4. LOAD & RENDER TOOLS
// ═══════════════════════════════════════════════════════════════
function fetchToolsData() {
    fetch("/api/tools?t=" + new Date().getTime())
        .then(r => r.json())
        .then(data => {
            allCategories = data;
            buildSidebarNav();
            renderTools();
        })
        .catch(err => {
            console.error("API error:", err);
            if (terminal) terminal.writeln("\x1b[1;31m[ERROR] Failed to load tools database!\x1b[0m");
        });
}

function buildSidebarNav() {
    const nav = document.getElementById("category-list");
    nav.innerHTML = "";
    const total = allCategories.reduce((s, c) => s + c.tools.length, 0);
    document.getElementById("stat-total").textContent = total;

    // "All Tools" item
    nav.appendChild(makeSidebarItem("All Tools", "fa-solid fa-layer-group", total));

    allCategories.forEach(cat => {
        nav.appendChild(makeSidebarItem(cat.category, getCategoryIcon(cat.category), cat.tools.length));
    });
}

function makeSidebarItem(name, icon, count) {
    const a = document.createElement("a");
    a.href = "#";
    a.className = `mob-cat-item ${currentCategory === name ? "active" : ""}`;
    a.innerHTML = `
        <div class="mob-cat-left"><i class="${icon}"></i><span>${name}</span></div>
        <span class="badge-count-mob">${count}</span>
    `;
    a.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".mob-cat-item").forEach(el => el.classList.remove("active"));
        a.classList.add("active");
        currentCategory = name;
        document.getElementById("tools-cat-title").textContent = name;
        
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        
        renderTools();
        
        // Auto navigate back to Explorer tab to see filtered list
        switchTab("tab-explorer");
    });
    return a;
}

function renderTools() {
    const grid   = document.getElementById("tools-grid");
    const search = document.getElementById("search-input").value.trim().toLowerCase();
    const clearBtn = document.getElementById("search-clear");
    grid.innerHTML = "";
    clearBtn.style.display = search ? "block" : "none";

    let tools = [];
    if (currentCategory === "All Tools") {
        allCategories.forEach(cat =>
            cat.tools.forEach(t => tools.push({ ...t, categoryName: cat.category }))
        );
    } else {
        const catObj = allCategories.find(c => c.category === currentCategory);
        if (catObj) tools = catObj.tools.map(t => ({ ...t, categoryName: catObj.category }));
    }

    if (search) {
        tools = tools.filter(t =>
            t.name.toLowerCase().includes(search) ||
            (t.description || "").toLowerCase().includes(search) ||
            t.categoryName.toLowerCase().includes(search)
        );
    }

    document.getElementById("tools-count").textContent = `${tools.length} TOOLS`;

    if (!tools.length) {
        grid.innerHTML = `<div class="no-results font-mono" style="font-size:0.75rem; color:var(--text-dim); padding:20px; text-align:center;">NO TOOLS FOUND FOR "${search || currentCategory}"</div>`;
        return;
    }

    tools.forEach((tool, idx) => {
        const card = document.createElement("div");
        card.className = "mob-tool-card";
        card.style.animationDelay = `${Math.min(idx * 10, 150)}ms`;

        const isInst = installedMap[tool.id];
        const badgeHtml = buildBadgeHtml(isInst);

        card.innerHTML = `
            <div class="card-left">
                <div class="card-title-mob font-mono">${escapeHtml(tool.name)}</div>
                <p class="card-desc-mob font-mono">${escapeHtml(tool.description || "No description.")}</p>
            </div>
            <div id="badge-${tool.id}">${badgeHtml}</div>
        `;
        card.addEventListener("click", () => showModal(tool));
        grid.appendChild(card);
    });

    if (socket && socket.connected) {
        socket.emit("get_installed_status");
    }
}

function buildBadgeHtml(isInstalled) {
    if (isInstalled === undefined) {
        return `<span class="badge-mob checking">...</span>`;
    }
    if (isInstalled) {
        return `<span class="badge-mob installed">Installed</span>`;
    }
    return `<span class="badge-mob not-installed">Get</span>`;
}

function syncBadges(map) {
    let installed = 0;
    Object.entries(map).forEach(([id, status]) => {
        if (status) installed++;
        const el = document.getElementById(`badge-${id}`);
        if (el) el.innerHTML = buildBadgeHtml(status);
    });
    document.getElementById("stat-cloned").textContent = installed;

    if (selectedTool && map[selectedTool.id] !== undefined) {
        updateModalButtons(map[selectedTool.id]);
    }
}

// ═══════════════════════════════════════════════════════════════
//  5. MODAL
// ═══════════════════════════════════════════════════════════════
function showModal(tool) {
    selectedTool = tool;

    document.getElementById("modal-cat-label").textContent   = (tool.categoryName || "MODULE").toUpperCase();
    document.getElementById("modal-tool-name").textContent   = tool.name;
    document.getElementById("modal-description").textContent = tool.description || "No description available.";
    document.getElementById("modal-tool-id").textContent     = tool.id || "—";

    const repoLink = document.getElementById("modal-repo-link");
    const btnRepo  = document.getElementById("btn-open-repo");
    if (tool.repo) {
        repoLink.href = tool.repo;
        repoLink.textContent = tool.repo;
        btnRepo.disabled = false;
    } else {
        repoLink.textContent = "None (built-in)";
        repoLink.href = "#";
        btnRepo.disabled = true;
    }

    const cmdEl = document.getElementById("modal-cmd-code");
    cmdEl.textContent = (tool.commands && tool.commands.length)
        ? tool.commands.join("\n")
        : "No command defined.";

    updateModalButtons(installedMap[tool.id]);

    document.getElementById("detail-modal").classList.add("active");
}

function updateModalButtons(isInstalled) {
    const badge    = document.getElementById("modal-status-badge");
    const btnRun   = document.getElementById("btn-run-tool");
    const btnInst  = document.getElementById("btn-install-tool");
    const btnUninst = document.getElementById("btn-uninstall-tool");

    if (isInstalled === undefined) {
        badge.className   = "badge checking";
        badge.innerHTML   = "Checking...";
        btnRun.disabled   = true;
        btnInst.disabled  = true;
        if (btnUninst) btnUninst.style.display = "none";
        return;
    }

    if (isInstalled) {
        badge.className   = "badge installed";
        badge.innerHTML   = `Installed`;
        btnRun.disabled   = false;
        btnInst.disabled  = true;
        if (btnUninst) btnUninst.style.display = "block";
    } else {
        badge.className   = "badge not-installed";
        badge.innerHTML   = `Not Installed`;
        btnRun.disabled   = true;
        btnInst.disabled  = false;
        if (btnUninst) btnUninst.style.display = "none";
    }
}

function closeModal() {
    document.getElementById("detail-modal").classList.remove("active");
    selectedTool = null;
}

// ═══════════════════════════════════════════════════════════════
//  6. RUNNING STATE UI
// ═══════════════════════════════════════════════════════════════
function applyRunningUIState() {
    const dot      = document.getElementById("ps-dot");
    const text     = document.getElementById("ps-text");
    const killBtn  = document.getElementById("btn-kill-process");
    const tabTitle = document.getElementById("terminal-tab-title");

    if (runningState.running) {
        dot.className  = "process-dot running";
        text.textContent = (runningState.name || "").toUpperCase();
        killBtn.disabled = false;
        if (tabTitle) tabTitle.textContent = `root@kali: [${runningState.name}]`;
    } else {
        dot.className  = "process-dot idle";
        text.textContent = "IDLE";
        killBtn.disabled = true;
        if (tabTitle) tabTitle.textContent = "root@kali: ~/AllHackingTools";
    }
}

// ═══════════════════════════════════════════════════════════════
//  7. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
function initEventListeners() {
    // Theme selector
    document.getElementById("theme-selector").addEventListener("change", (e) => {
        document.body.className = e.target.value;
        if (terminal) {
            terminal.options.theme = getTermTheme(e.target.value);
        }
    });

    // Search
    document.getElementById("search-input").addEventListener("input", renderTools);
    document.getElementById("search-clear").addEventListener("click", () => {
        document.getElementById("search-input").value = "";
        renderTools();
    });

    // Modal close
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("detail-modal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("detail-modal")) closeModal();
    });

    // Modal open repo
    document.getElementById("btn-open-repo").addEventListener("click", () => {
        if (selectedTool && selectedTool.repo) window.open(selectedTool.repo, "_blank");
    });

    // Modal install tool
    document.getElementById("btn-install-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;33m[SYSTEM] Installing: ${selectedTool.name}...\x1b[0m`);
        socket.emit("install_tool", { tool_id: selectedTool.id });
        closeModal();
        switchTab("tab-terminal");
    });

    // Modal uninstall tool
    document.getElementById("btn-uninstall-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;31m[SYSTEM] Deleting tool files: ${selectedTool.name}...\x1b[0m`);
        socket.emit("uninstall_tool", { tool_id: selectedTool.id });
        closeModal();
    });

    // Modal run tool
    document.getElementById("btn-run-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;32m[SYSTEM] Launching: ${selectedTool.name}...\x1b[0m`);
        socket.emit("run_tool", { tool_id: selectedTool.id });
        closeModal();
        switchTab("tab-terminal");
    });

    // Kill process
    document.getElementById("btn-kill-process").addEventListener("click", () => {
        if (socket) socket.emit("kill_process");
    });

    // Run CLI Menu
    document.getElementById("btn-run-menu").addEventListener("click", () => {
        terminal.writeln(`\r\n\x1b[1;35m[SYSTEM] Launching AllHackingTools CLI Menu...\x1b[0m`);
        socket.emit("send_input", { data: "python hackingtool.py\n" });
        switchTab("tab-terminal");
    });

    // Reset dir
    document.getElementById("btn-reset-dir").addEventListener("click", () => {
        terminal.writeln(`\r\n\x1b[0;36m[SYSTEM] Resetting to home directory...\x1b[0m`);
        socket.emit("reset_directory");
    });

    // Clear terminal
    document.getElementById("btn-clear-term").addEventListener("click", () => {
        terminal.clear();
    });

    // Keyboard shortcut: Escape = close modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });
}

// ═══════════════════════════════════════════════════════════════
//  8. UTILITIES
// ═══════════════════════════════════════════════════════════════
function getCategoryIcon(name) {
    const map = {
        "Information Gathering":   "fa-solid fa-fingerprint",
        "Exploitation Tools":      "fa-solid fa-bug",
        "Sniffing & Spoofing":     "fa-solid fa-mask",
        "Web Attack Tools":        "fa-solid fa-globe",
        "Cam Hacking Tools":       "fa-solid fa-camera",
        "Remote Trojan RAT":       "fa-solid fa-spider",
        "SQL Injection Tools":     "fa-solid fa-database",
        "SocialMedia Bruteforce":  "fa-solid fa-users",
        "SMS & Email Spamming":    "fa-solid fa-comment-slash",
        "Vulnerability Analysis":  "fa-solid fa-magnifying-glass-chart",
        "DarkSearch Tools":        "fa-solid fa-magnifying-glass-location",
        "Phishing Attack Tools":   "fa-solid fa-fish",
        "Hash Cracking Tools":     "fa-solid fa-key",
        "Wordlist Generator Tools":"fa-solid fa-list-ol",
        "XSS Attack Tools":        "fa-solid fa-code",
        "Discord Leaks":           "fa-brands fa-discord",
        "Telegram Info":           "fa-brands fa-telegram",
        "Other Tools":             "fa-solid fa-toolbox",
        "System Customization":    "fa-solid fa-sliders",
        "All Tools":               "fa-solid fa-layer-group",
    };
    return map[name] || "fa-solid fa-circle-nodes";
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
