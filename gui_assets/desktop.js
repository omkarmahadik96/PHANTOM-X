// ═══════════════════════════════════════════════════════════════
//  AllHackingTools - Desktop 3D View Controller
// ═══════════════════════════════════════════════════════════════

// ── Global State ──
let socket = null;
let terminal = null;
let fitAddon = null;
let allCategories = [];
let currentCategory = "All Tools";
let selectedTool = null;
let installedMap = {};
let currentView = "split"; // "split" | "term" | "tools"
let runningState = { running: false, type: null, name: null };
let inputBuffer = "";
let usePty = false;

// ── Sizing View Mode ──
function setView(v) {
    currentView = v;
    const ws = document.getElementById("workspace");
    if (ws) ws.className = `workspace-viewport view-${v}`;
    
    const btnSplit = document.getElementById("btn-split");
    const btnTerm = document.getElementById("btn-term-only");
    const btnTools = document.getElementById("btn-tools-only");
    
    if (btnSplit) btnSplit.classList.toggle("active", v === "split");
    if (btnTerm) btnTerm.classList.toggle("active", v === "term");
    if (btnTools) btnTools.classList.toggle("active", v === "tools");
    
    setTimeout(doFit, 150);
}

// ── Bootstrap on DOM ready ──
document.addEventListener("DOMContentLoaded", () => {
    initTerminal();
    initSocket();
    initEventListeners();
    fetchToolsData();
    setView(currentView);
    init3DParallax();
});

// ═══════════════════════════════════════════════════════════════
//  1. 3D PARALLAX & MOUSE TRACKING
// ═══════════════════════════════════════════════════════════════
function init3DParallax() {
    document.addEventListener("mousemove", (e) => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx; // Value between -1 and 1
        const dy = (e.clientY - cy) / cy; // Value between -1 and 1

        // Move background 3D grid slightly for depth (keeps cyber deck feeling)
        const grid = document.getElementById("grid-3d");
        if (grid) {
            grid.style.transform = `perspective(600px) rotateX(65deg) translate(${dx * -15}px, ${dy * -15}px)`;
        }
    });
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
    terminal.writeln("\x1b[1;31m\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u251c\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[1;37mPHANTOM-X\x1b[1;31m \u2014 3D Console Terminal Client \x1b[0;90mv1.0\x1b[1;31m       \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[0;90m Tools HUD \u2192 Details \u2192 Run/Reinstall in PTY\x1b[1;31m         \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u251c\x1b[0m");
    terminal.writeln("");
    terminal.writeln("\x1b[0;90m  Type directly in terminal | CTRL+C to copy | CTRL+X to stop subprocess\x1b[0m");
    terminal.writeln("");

    setTimeout(doFit, 400);

    // ResizeObserver on the xterm-container (most reliable)
    const xtermContainer = document.getElementById("xterm-container");
    if (xtermContainer && window.ResizeObserver) {
        const ro = new ResizeObserver(() => doFit());
        ro.observe(xtermContainer);
    }
    window.addEventListener("resize", () => setTimeout(doFit, 100));

    const termPanel = document.getElementById("term-panel");
    if (termPanel) {
        termPanel.addEventListener("transitionend", () => doFit());
    }

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
        if (data === '\x03') {
            inputBuffer = "";
            terminal.write("^C\r\n");
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

    // Auto-copy on mouse selection
    document.getElementById("terminal").addEventListener("mouseup", () => {
        if (terminal.hasSelection()) {
            navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
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
        connDot.className   = "net-dot connected";
        connLabel.textContent = "ONLINE HUD LINK";
        socket.emit("get_installed_status");
        
        if (terminal) {
            socket.emit("resize_terminal", { cols: terminal.cols, rows: terminal.rows });
        }
    });

    socket.on("disconnect", () => {
        connDot.className   = "net-dot disconnected";
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
            buildCategoryChips();
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
    a.className = `nav-link-3d ${currentCategory === name ? "active" : ""}`;
    a.innerHTML = `
        <div class="nav-link-left"><i class="${icon}"></i><span>${name}</span></div>
        <span class="badge-count">${count}</span>
    `;
    a.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".nav-link-3d").forEach(el => el.classList.remove("active"));
        a.classList.add("active");
        currentCategory = name;
        document.getElementById("tools-cat-title").textContent = name;
        
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        
        document.querySelectorAll(".hud-chip-3d").forEach(c => {
            c.classList.toggle("active", c.dataset.cat === name);
        });
        renderTools();
    });
    return a;
}

function buildCategoryChips() {
    const row = document.getElementById("cat-chips-row");
    row.innerHTML = "";
    const total = allCategories.reduce((s, c) => s + c.tools.length, 0);

    const allChip = makeChip("All Tools", "fa-solid fa-layer-group", total);
    row.appendChild(allChip);

    allCategories.forEach(cat => {
        row.appendChild(makeChip(cat.category, getCategoryIcon(cat.category), cat.tools.length));
    });
}

function makeChip(name, icon, count) {
    const c = document.createElement("a");
    c.href = "#";
    c.className = `hud-chip-3d ${currentCategory === name ? "active" : ""}`;
    c.dataset.cat = name;
    c.innerHTML = `<i class="${icon}"></i>${name}<span class="badge-count" style="margin-left:6px; background:rgba(0,0,0,0.35); color:inherit;">${count}</span>`;
    c.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".hud-chip-3d").forEach(el => el.classList.remove("active"));
        c.classList.add("active");
        currentCategory = name;
        document.getElementById("tools-cat-title").textContent = name;
        
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        
        document.querySelectorAll(".nav-link-3d").forEach(el => {
            const label = el.querySelector(".nav-link-left span");
            if (label) el.classList.toggle("active", label.textContent === name);
        });
        renderTools();
    });
    return c;
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

    document.getElementById("tools-count").textContent = `${tools.length} MODULES`;

    if (!tools.length) {
        grid.innerHTML = `<div class="no-results" style="font-family: var(--font-share); font-size:0.85rem; color:var(--text-dim); padding:20px;">NO MODULES FOUND FOR "${search || currentCategory}"</div>`;
        return;
    }

    tools.forEach((tool, idx) => {
        const card = document.createElement("div");
        card.className = "tool-card-3d";
        card.style.animationDelay = `${Math.min(idx * 12, 180)}ms`;

        const isInst = installedMap[tool.id];
        const badgeHtml = buildBadgeHtml(isInst);

        card.innerHTML = `
            <div class="card-top-3d">
                <div class="card-name-3d font-share">${escapeHtml(tool.name)}</div>
                <div id="badge-${tool.id}">${badgeHtml}</div>
            </div>
            <p class="card-desc-3d">${escapeHtml(tool.description || "No description available.")}</p>
            <div class="card-footer-3d">
                <button class="card-act-btn-3d"><i class="fa-solid fa-circle-info"></i> DETAILS</button>
            </div>
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
        return `<span class="badge-3d checking">...</span>`;
    }
    if (isInstalled) {
        return `<span class="badge-3d installed"><i class="fa-solid fa-check"></i> Installed</span>`;
    }
    return `<span class="badge-3d not-installed"><i class="fa-solid fa-download"></i> Get</span>`;
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

    const iconEl = document.getElementById("modal-icon-wrap");
    iconEl.innerHTML = `<i class="${getCategoryIcon(tool.categoryName || '')}"></i>`;

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
        badge.className   = "badge-3d checking";
        badge.innerHTML   = "Checking...";
        btnRun.disabled   = true;
        btnInst.disabled  = true;
        if (btnUninst) btnUninst.style.display = "none";
        return;
    }

    if (isInstalled) {
        badge.className   = "badge-3d installed";
        badge.innerHTML   = `<i class="fa-solid fa-check"></i> Installed`;
        btnRun.disabled   = false;
        btnInst.disabled  = true;
        if (btnUninst) btnUninst.style.display = "inline-flex";
    } else {
        badge.className   = "badge-3d not-installed";
        badge.innerHTML   = `<i class="fa-solid fa-download"></i> Not Installed`;
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
        dot.className  = "sys-dot running";
        text.textContent = `RUNNING: ${(runningState.name || "").toUpperCase()}`;
        killBtn.disabled = false;
        if (tabTitle) tabTitle.textContent = `root@PHANTOM-X: [${runningState.name}]`;
    } else {
        dot.className  = "sys-dot idle";
        text.textContent = "SYSTEM STANDBY";
        killBtn.disabled = true;
        if (tabTitle) tabTitle.textContent = "root@PHANTOM-X: ~/hackingtool";
    }
}

// ═══════════════════════════════════════════════════════════════
//  7. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
function initEventListeners() {
    // Sidebar toggle
    document.getElementById("btn-sidebar-toggle").addEventListener("click", () => {
        const sidebar = document.getElementById("sidebar");
        const toggleIcon = document.querySelector("#btn-sidebar-toggle i");
        sidebar.classList.toggle("collapsed");
        if (sidebar.classList.contains("collapsed")) {
            sidebar.style.display = "none";
            document.getElementById("app-root-3d").style.gridTemplateColumns = "0px 1fr";
            toggleIcon.className = "fa-solid fa-angle-right";
        } else {
            sidebar.style.display = "flex";
            document.getElementById("app-root-3d").style.gridTemplateColumns = "290px 1fr";
            toggleIcon.className = "fa-solid fa-angle-left";
        }
        setTimeout(doFit, 250);
    });

    document.getElementById("btn-split").addEventListener("click", () => setView("split"));
    document.getElementById("btn-term-only").addEventListener("click", () => setView("term"));
    document.getElementById("btn-tools-only").addEventListener("click", () => setView("tools"));

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
        if (currentView === "tools") setView("split");
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
        if (currentView === "tools") setView("split");
    });

    // Kill process
    document.getElementById("btn-kill-process").addEventListener("click", () => {
        if (socket) socket.emit("kill_process");
    });

    // Run CLI Menu
    document.getElementById("btn-run-menu").addEventListener("click", () => {
        terminal.writeln(`\r\n\x1b[1;35m[SYSTEM] Launching AllHackingTools CLI Menu...\x1b[0m`);
        socket.emit("send_input", { data: "python hackingtool.py\n" });
        if (currentView === "tools") setView("split");
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

    // Auto-focus terminal on click anywhere in term-panel
    document.getElementById("term-panel").addEventListener("click", () => {
        if (terminal) terminal.focus();
    });

    // Auto focus terminal on boot
    setTimeout(() => {
        if (terminal) terminal.focus();
    }, 1000);

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
