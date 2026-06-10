<div align="center">

<img src="gui_assets/phantom_x_logo.png" alt="PHANTOM-X Logo" width="380">

# 🌌 PHANTOM-X
### **Premium Cyber Auditing & Penetration Testing Command Center**

PHANTOM-X is a state-of-the-art security platform designed for researchers, penetration testers, and security analysts. It bundles **66 industry-standard auditing tools** across **11 categories** into a unified workspace, served via a beautiful glassmorphic Web Console and an interactive dynamic Command Line Interface (CLI).

---

[![License](https://img.shields.io/badge/License-MIT-00FF88?style=for-the-badge&logo=github)](LICENSE)&nbsp;
[![Python](https://img.shields.io/badge/Python-3.10+-7B61FF?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)&nbsp;
[![Docker](https://img.shields.io/badge/Docker-Supported-00A9FF?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)&nbsp;
[![Kali Linux](https://img.shields.io/badge/Kali_Linux-Rolling-FF9E0F?style=for-the-badge&logo=kali-linux&logoColor=white)](https://www.kali.org/)

</div>

---

## ⚡ Core Features

*   **✨ Premium Visual Themes**: Swap between 3 custom-tailored sci-fi aesthetics in real time:
    *   `Phantom-X` (Default): Sleek dark glassmorphic design with deep purple accents.
    *   `Cyber-Glow`: Radioactive green/cyan interface with custom monospace typography and borders neon-glow animations.
    *   `Venom-Red`: Intense crimson-red/orange warning styles with Orbitron fonts and stealth pulse effects.
*   **🔍 Smart Output Highlighting**: Real-time security scan outputs automatically filter and highlight critical targets (IPs, URLs), open ports, credentials, and vulnerability/CVE signatures in neon colors.
*   **📂 Direct GUI Loading & Auto-Installer**: 
    *   Clicking an installed tool immediately loads its parameter inputs in the GUI workspace.
    *   Clicking an uninstalled tool triggers a simplified **Download & Install** confirmation modal showing live installation logs. Once finished, it auto-loads into the form.
*   **💻 Dynamic CLI Command Center**: Interactive text terminal with search query support (`/`), tag filters (`t`), and instant recommendation system (`r`).
*   **66 Audited & Verified Tools**: 100% of the tools in the catalog are tested, patched, and confirmed working (0 dead tools).
*   **Safe Docker Containerization**: Runs in a sandboxed Kali Linux Docker environment to keep your host machine clean and safe.
*   **Isolated Multi-Session Engine**: Separate terminal sessions, PTY wrappers, and command executors per browser tab or client.

---

## 📂 Catalog (11 Categories & 66 Tools)

| Reconnaissance & Info Gathering | Network Scanning | Web Application Testing | Vulnerability Assessment |
|---|---|---|---|
| • theHarvester<br>• Amass<br>• Subfinder<br>• Assetfinder<br>• Recon-ng<br>• SpiderFoot | • Nmap<br>• Masscan<br>• RustScan<br>• Naabu | • Nuclei<br>• Katana<br>• httpx<br>• ffuf<br>• dirsearch<br>• XSStrike<br>• sqlmap | • Nuclei Templates<br>• Trivy<br>• OpenVAS Community Docs<br>• Nikto |

| Password Auditing | Cloud Security | Container & K8s Security | SOC Analyst Essentials |
|---|---|---|---|
| • Hashcat<br>• John The Ripper Jumbo<br>• CeWL | • ScoutSuite<br>• Prowler<br>• CloudSplaining | • kube-bench<br>• kube-hunter<br>• Trivy (Container) | • Wazuh<br>• Security Onion<br>• ELK Stack<br>• Graylog<br>• Zeek<br>• Suricata<br>• Snort3<br>• Volatility 3<br>• Autopsy<br>• Chainsaw<br>• Hayabusa<br>• MISP<br>• OpenCTI<br>• YARA |

| Red Team & Emulation | Linux Admin & Security | Top 15 Must Learn Tools |
|---|---|---|
| • MITRE Caldera<br>• Atomic Red Team<br>• Prelude Operator | • Lynis<br>• OpenSCAP<br>• Falco<br>• Auditd Userspace | • Nmap, Wireshark, Burp Suite, Nuclei, Amass, Subfinder, ffuf, sqlmap, Wazuh, Suricata, Zeek, Volatility3, Autopsy, Lynis, Falco |

---

## 🚀 How to Run on Your Device

> [!IMPORTANT]
> Running via Docker is highly recommended as it isolates all penetration testing tools, binaries, and dependencies inside a container without cluttering your host operating system.

### **Method 1: Using Docker (Recommended for Windows/Linux/macOS)**

Ensure you have **Docker** and **Docker Compose** installed on your system.

#### **1. Clone the Repository**
```bash
git clone https://github.com/omkarmahadik96/PHANTOM-X.git
cd PHANTOM-X
```

#### **2. Start the Environment**
Launch the pre-configured container using Docker Compose:
```bash
docker compose up -d
```

#### **3. Access the Web Dashboard**
Open your favorite web browser and navigate to:
👉 **`http://localhost:5000`**

#### **4. Run the Terminal CLI Menu**
If you wish to use the text-based CLI menu inside the running container:
```bash
docker exec -it hackingtool python3 hackingtool.py
```

---

### **Method 2: Local Setup (Native Linux/Kali Linux)**

If you prefer to run the platform natively directly on your host machine:

#### **1. Install System Dependencies**
```bash
sudo apt-get update
sudo apt-get install -y git python3-pip curl wget nmap hydra sqlmap unzip zip tar net-tools golang ruby default-jdk
```

#### **2. Install Python Packages**
```bash
pip3 install --break-system-packages -r requirements.txt
```

#### **3. Start the Web Console Server**
Run the Flask-SocketIO server:
```bash
python3 gui_server.py
```
👉 Open **`http://localhost:5000`** in your browser.

#### **4. Start the Terminal CLI Menu**
Run the interactive CLI command center:
```bash
python3 hackingtool.py
```

---

## 🛠️ Customization & Tool Configuration

*   **Dynamic Catalog**: All tool directories, installations, and parameters are declared inside `tools_data.json`.
*   **Adding Your Own Tool**: You can easily add a tool to the catalog by adding a new JSON block inside `tools_data.json`. The platform dynamically renders it in both the Web Console and the Terminal CLI menu instantly!

---

> ⚠️ **Disclaimer:** This tool repository is created for authorized security auditing, penetration testing, and educational research purposes only. Please perform tests only on systems you own or have explicit written permission to test.
