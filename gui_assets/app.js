// ═══════════════════════════════════════════════════════════════
//  AllHackingTools - Web GUI Application Controller v4.0
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

let activeLeftTab = "terminal"; // "terminal" | "gui"
let guiRunning = false;
let guiSelectedTool = null;
let guiRawOutput = "";
let guiInstallTool = null;
let guiInstallActive = false;
let guiInstallOutput = "";

const GUI_SCHEMAS = {
    "recon_1": {
        name: "theHarvester",
        inputs: [
            { id: "domain", label: "Target Domain", type: "text", placeholder: "example.com", required: true, suggestion: "example.com", help: "The target website domain to scan (e.g. google.com). Do not include http:// or www." },
            { id: "sources", label: "Data Sources", type: "text", default: "crtsh,duckduckgo,hackertarget,otx,rapiddns,subdomaincenter,yahoo", suggestion: "crtsh,duckduckgo,yahoo", help: "Search engines and databases to search for subdomains. Keep defaults for best results." },
            { id: "limit", label: "Search Limit", type: "number", default: 500, suggestion: "500", help: "Number of search results to fetch. Higher numbers find more subdomains but take longer." }
        ],
        commandBuilder: (vals) => `theHarvester -d "${vals.domain}" -b ${vals.sources || 'crtsh,duckduckgo,hackertarget,otx,rapiddns,subdomaincenter,yahoo'} -l ${vals.limit || 500}`
    },
    "recon_2": {
        name: "Amass",
        inputs: [
            { id: "domain", label: "Target Domain", type: "text", placeholder: "example.com", required: true, suggestion: "example.com", help: "The website domain to map and scan (e.g. tesla.com) to discover subdomains." }
        ],
        commandBuilder: (vals) => `amass enum -d "${vals.domain}"`
    },
    "recon_3": {
        name: "Subfinder",
        inputs: [
            { id: "domain", label: "Target Domain", type: "text", placeholder: "example.com", required: true, suggestion: "example.com", help: "The website domain (e.g. github.com) to discover subdomains using online sources." }
        ],
        commandBuilder: (vals) => `subfinder -d "${vals.domain}"`
    },
    "recon_4": {
        name: "Assetfinder",
        inputs: [
            { id: "domain", label: "Target Domain", type: "text", placeholder: "example.com", required: true, suggestion: "example.com", help: "The target domain name (e.g. apple.com) to find related subdomains and assets." }
        ],
        commandBuilder: (vals) => `assetfinder --subs-only "${vals.domain}"`
    },
    "recon_5": {
        name: "Recon-ng",
        inputs: [
            { id: "args", label: "Arguments / Commands", type: "text", placeholder: "-r interactive", suggestion: "-r interactive", help: "Command line parameters for Recon-ng. Enter '-r interactive' to start with the interactive prompt." }
        ],
        commandBuilder: (vals) => `python recon-ng/recon-ng ${vals.args || ''}`
    },
    "recon_6": {
        name: "Spiderfoot",
        inputs: [
            { id: "ip", label: "Listen Address", type: "text", default: "127.0.0.1:5001", suggestion: "127.0.0.1:5001", help: "The IP and port where Spiderfoot's browser dashboard will run. Default is 127.0.0.1:5001." }
        ],
        commandBuilder: (vals) => `python spiderfoot/sf.py -l ${vals.ip}`
    },
    "scan_1": {
        name: "Nmap",
        inputs: [
            { id: "target", label: "Target Host / IP", type: "text", placeholder: "scanme.nmap.org", required: true, suggestion: "scanme.nmap.org", help: "The server IP or website domain to scan for open doors/ports (e.g. 192.168.1.1 or example.com)." },
            { id: "ports", label: "Ports to Scan (Optional)", type: "text", placeholder: "e.g. 80,443 or 1-1000", suggestion: "80,443,8080", help: "Specific port numbers to check. Leave blank to scan top 1000 standard ports." },
            { id: "preset", label: "Scan Option / Preset", type: "select", options: [
                { value: "-A -v", label: "Aggressive & Verbose (-A -v)" },
                { value: "-sS -sV -F", label: "Quick Service Scan (-sS -sV -F)" },
                { value: "-p- -sV", label: "All Ports Service Scan (-p- -sV)" },
                { value: "-sU", label: "UDP Port Scan (-sU)" }
            ], default: "-A -v", help: "Scan profiles. Aggressive (-A) scans deeply but takes longer and is louder." }
        ],
        commandBuilder: (vals) => {
            let p = vals.ports ? `-p ${vals.ports}` : '';
            return `nmap ${vals.preset || '-A -v'} ${p} "${vals.target}"`;
        }
    },
    "scan_2": {
        name: "Masscan",
        inputs: [
            { id: "target", label: "Target IP / Range", type: "text", placeholder: "192.168.1.0/24", required: true, suggestion: "192.168.1.0/24", help: "The target IP range to scan (e.g., 192.168.1.0/24 to check all 256 IPs in the local network)." },
            { id: "ports", label: "Ports", type: "text", default: "0-65535", suggestion: "80,443", help: "The ports you want to check (e.g. 80,443 or 0-65535 for all possible ports)." },
            { id: "rate", label: "Transmit Rate (pps)", type: "number", default: 1000, suggestion: "1000", help: "Packets sent per second. 1000 is safe. Higher speeds scan faster but can trigger firewalls or crash old routers." }
        ],
        commandBuilder: (vals) => `masscan --ports ${vals.ports || '0-65535'} --rate ${vals.rate || 1000} "${vals.target}"`
    },
    "scan_3": {
        name: "Rustscan",
        inputs: [
            { id: "target", label: "Target Host / IP", type: "text", placeholder: "127.0.0.1", required: true, suggestion: "127.0.0.1", help: "The IP address or domain to scan at ultra-high speeds (e.g. 192.168.1.5)." },
            { id: "args", label: "Custom Arguments (Optional)", type: "text", placeholder: "--ulimit 5000", suggestion: "-a 127.0.0.1 --ulimit 5000", help: "Extra settings for Rustscan (e.g. '--ulimit 5000' to scan faster)." }
        ],
        commandBuilder: (vals) => `rustscan -a "${vals.target}" ${vals.args || ''}`
    },
    "scan_4": {
        name: "Naabu",
        inputs: [
            { id: "target", label: "Target Host / IP", type: "text", placeholder: "example.com", required: true, suggestion: "example.com", help: "The IP address or website domain to scan for open ports." }
        ],
        commandBuilder: (vals) => `naabu -host "${vals.target}"`
    },
    "web_1": {
        name: "Nuclei",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The target website URL to scan (e.g., http://example.com or https://192.168.1.1)." },
            { id: "templates", label: "Specific Templates (Optional)", type: "text", placeholder: "e.g. cves/ or technologies/", suggestion: "cves/", help: "Select specific tests to run. Leave blank to run all default tests, or type 'cves/' to check for CVEs." }
        ],
        commandBuilder: (vals) => {
            let t = vals.templates ? `-t ${vals.templates}` : '';
            return `nuclei -u "${vals.target}" ${t}`;
        }
    },
    "web_2": {
        name: "Katana",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The website URL (e.g., http://example.com) to crawl and extract all links and pages." }
        ],
        commandBuilder: (vals) => `katana -u "${vals.target}"`
    },
    "web_3": {
        name: "httpx",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The website URL or IP address list to probe for active web services." },
            { id: "args", label: "Arguments", type: "text", default: "-title -status-code", suggestion: "-title -status-code -content-length", help: "Information to extract (e.g., '-title' to show web titles, '-status-code' for status code)." }
        ],
        commandBuilder: (vals) => `httpx -u "${vals.target}" ${vals.args || ''}`
    },
    "web_4": {
        name: "ffuf",
        inputs: [
            { id: "target", label: "Target URL (include FUZZ)", type: "text", default: "http://example.com/FUZZ", required: true, suggestion: "http://example.com/FUZZ", help: "The URL where you want to test hidden files. Put 'FUZZ' where you want the word list words to try." },
            { id: "wordlist", label: "Wordlist Path", type: "text", default: "/usr/share/wordlists/dirb/common.txt", required: true, suggestion: "/usr/share/wordlists/dirb/common.txt", help: "A text file of directory names to guess. Default is a common standard word list." }
        ],
        commandBuilder: (vals) => `ffuf -u "${vals.target}" -w "${vals.wordlist}"`
    },
    "web_5": {
        name: "dirsearch",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The target website URL (e.g. http://example.com) to scan for hidden folders and scripts." }
        ],
        commandBuilder: (vals) => `python dirsearch/dirsearch.py -u "${vals.target}"`
    },
    "web_6": {
        name: "XSStrike",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com/search.php?q=test", required: true, suggestion: "http://example.com/search.php?q=test", help: "The URL containing a query parameter (e.g. ?q=test) to test for Cross-Site Scripting vulnerabilities." }
        ],
        commandBuilder: (vals) => `python XSStrike/xsstrike.py -u "${vals.target}"`
    },
    "web_7": {
        name: "sqlmap",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com/item.php?id=1", required: true, suggestion: "http://example.com/item.php?id=1", help: "The URL with a parameter (e.g., ?id=1) to scan for SQL Injection database flaws." },
            { id: "args", label: "Arguments", type: "text", default: "--batch --banner", suggestion: "--batch --banner", help: "Options for Sqlmap. '--batch --banner' automates prompts and retrieves database server banner." }
        ],
        commandBuilder: (vals) => `python sqlmap/sqlmap.py -u "${vals.target}" ${vals.args || ''}`
    },
    "vuln_2": {
        name: "Trivy",
        inputs: [
            { id: "image", label: "Container Image Name", type: "text", placeholder: "ubuntu:latest", required: true, suggestion: "ubuntu:latest", help: "The Docker image name and version tag (e.g. alpine:3.15 or ubuntu:latest) to check for security flaws." }
        ],
        commandBuilder: (vals) => `trivy image "${vals.image}"`
    },
    "vuln_3": {
        name: "Nikto",
        inputs: [
            { id: "target", label: "Target Host / URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The target server URL (e.g. http://192.168.1.100) to scan for outdated software and dangerous configs." }
        ],
        commandBuilder: (vals) => `perl nikto/program/nikto.pl -h "${vals.target}"`
    },
    "pass_1": {
        name: "Hashcat",
        inputs: [
            { id: "hashfile", label: "Hash File Path", type: "text", placeholder: "hashes.txt", required: true, suggestion: "hashes.txt", help: "Path to a text file containing the encrypted password hashes you want to crack." },
            { id: "wordlist", label: "Wordlist Path", type: "text", placeholder: "/usr/share/wordlists/rockyou.txt", required: true, suggestion: "/usr/share/wordlists/rockyou.txt", help: "Path to the dictionary text file of common passwords to try (e.g. /usr/share/wordlists/rockyou.txt)." },
            { id: "mode", label: "Hash Mode (-m)", type: "number", default: 0, suggestion: "0", help: "The number specifying hash format (e.g., 0 for MD5, 100 for SHA-1, 1000 for NTLM, 1800 for sha512crypt)." }
        ],
        commandBuilder: (vals) => `hashcat -m ${vals.mode || 0} "${vals.hashfile}" "${vals.wordlist}"`
    },
    "pass_2": {
        name: "John the Ripper",
        inputs: [
            { id: "mode", label: "Mode", type: "select", options: [
                { value: "direct_pdf", label: "Extract & Crack PDF directly" },
                { value: "hash_file", label: "Crack pre-extracted Hash File" }
            ], default: "direct_pdf", help: "Choose whether to directly crack a PDF file (extracting its hash automatically) or to crack a pre-existing hash text file." },
            { id: "pdf_path", label: "PDF File Path", type: "text", placeholder: "/root/hackingtool/pan.pdf", default: "/root/hackingtool/pan.pdf", help: "The full path to the password-protected PDF file inside the container." },
            { id: "hashfile", label: "Hash File Path", type: "text", placeholder: "/root/hackingtool/pan_hash.txt", default: "/root/hackingtool/pan_hash.txt", help: "The path where the extracted hash file is stored or will be saved." },
            { id: "wordlist", label: "Wordlist Path (Optional)", type: "text", placeholder: "/usr/share/wordlists/rockyou.txt", help: "Optionally specify a custom wordlist file path." },
            { id: "extra", label: "Extra Arguments (Optional)", type: "text", placeholder: "--mask=?d?d?d?d?d?d?d?d", default: "--mask=?d?d?d?d?d?d?d?d", help: "Custom arguments (e.g. '--mask=?d?d?d?d?d?d?d?d' for 8-digit numeric passwords like dates)." }
        ],
        commandBuilder: (vals) => {
            let wl = vals.wordlist ? `--wordlist="${vals.wordlist}"` : "";
            let extra = vals.extra || "";
            if (vals.mode === "direct_pdf") {
                let pdf = vals.pdf_path || "/root/hackingtool/pan.pdf";
                let hash = vals.hashfile || "/root/hackingtool/pan_hash.txt";
                return `pdf2john "${pdf}" > "${hash}" && john ${wl} ${extra} "${hash}"`;
            } else {
                let hash = vals.hashfile || "/root/hackingtool/pan_hash.txt";
                return `john ${wl} ${extra} "${hash}"`;
            }
        }
    },
    "pass_3": {
        name: "CeWL",
        inputs: [
            { id: "target", label: "Target URL", type: "text", placeholder: "http://example.com", required: true, suggestion: "http://example.com", help: "The target website URL to crawl for unique words to generate a customized dictionary." }
        ],
        commandBuilder: (vals) => `ruby CeWL/cewl.rb "${vals.target}"`
    },
    "pass_4": {
        name: "Hydra",
        inputs: [
            { id: "target", label: "Target Host / IP", type: "text", placeholder: "192.168.1.100", required: true, default: "192.168.1.100", suggestion: "192.168.1.100", help: "The IP address or domain name of the network target (e.g. 192.168.1.100)." },
            { id: "service", label: "Service / Protocol", type: "select", options: [
                { value: "ssh", label: "SSH" },
                { value: "ftp", label: "FTP" },
                { value: "telnet", label: "Telnet" },
                { value: "mysql", label: "MySQL" },
                { value: "rdp", label: "RDP" },
                { value: "smb", label: "SMB" },
                { value: "http-get", label: "HTTP-GET" },
                { value: "http-post-form", label: "HTTP-POST-Form" }
            ], default: "ssh", help: "Select the network service/protocol to crack logins on." },
            { id: "username", label: "Username / List", type: "text", placeholder: "admin or userlist.txt", required: true, default: "admin", suggestion: "admin", help: "Enter a single username (e.g. admin) or path to a username list (e.g. /usr/share/wordlists/metasploit/namelist.txt)." },
            { id: "is_userlist", label: "Is Username a List file?", type: "select", options: [
                { value: "No", label: "No (Single Username)" },
                { value: "Yes", label: "Yes (Username List file)" }
            ], default: "No", help: "Select Yes if the Username input is a path to a list of usernames, otherwise select No." },
            { id: "password", label: "Password / Wordlist", type: "text", placeholder: "/usr/share/wordlists/rockyou.txt", required: true, default: "/usr/share/wordlists/rockyou.txt", suggestion: "/usr/share/wordlists/rockyou.txt", help: "Enter a single password or path to a wordlist file (e.g. /usr/share/wordlists/rockyou.txt)." },
            { id: "is_passlist", label: "Is Password a List file?", type: "select", options: [
                { value: "Yes", label: "Yes (Password Wordlist file)" },
                { value: "No", label: "No (Single Password)" }
            ], default: "Yes", help: "Select Yes if the Password input is a path to a wordlist of passwords, otherwise select No." },
            { id: "extra", label: "Extra Parameters (Optional)", type: "text", placeholder: "-t 4 -V", help: "Additional flags for hydra (e.g., -t 4 to set concurrent connections, -V for verbose info)." }
        ],
        commandBuilder: (vals) => {
            let uFlag = vals.is_userlist === "Yes" ? "-L" : "-l";
            let pFlag = vals.is_passlist === "No" ? "-p" : "-P";
            let service = vals.service || "ssh";
            return `hydra ${uFlag} "${vals.username || 'admin'}" ${pFlag} "${vals.password || '/usr/share/wordlists/rockyou.txt'}" ${vals.extra || ''} "${vals.target}" ${service}`;
        }
    },
    "cloud_1": {
        name: "ScoutSuite",
        inputs: [
            { id: "provider", label: "Cloud Provider", type: "select", options: [
                { value: "aws", label: "AWS" },
                { value: "gcp", label: "GCP" },
                { value: "azure", label: "Azure" }
            ], default: "aws", help: "Select the cloud service provider (AWS, Google Cloud, or Microsoft Azure) to audit." }
        ],
        commandBuilder: (vals) => `scout ${vals.provider}`
    },
    "cloud_2": {
        name: "Prowler",
        inputs: [
            { id: "provider", label: "Cloud Provider", type: "select", options: [
                { value: "aws", label: "AWS" },
                { value: "gcp", label: "GCP" },
                { value: "azure", label: "Azure" }
            ], default: "aws", help: "Select the cloud service provider platform to check for security benchmark compliance." }
        ],
        commandBuilder: (vals) => `prowler ${vals.provider}`
    },
    "cloud_3": {
        name: "Cloudsplaining",
        inputs: [
            { id: "policy", label: "IAM Policy JSON File Path", type: "text", placeholder: "policy.json", required: true, suggestion: "policy.json", help: "Path to the local JSON file containing AWS IAM policies to check for over-privileged permissions." }
        ],
        commandBuilder: (vals) => `cloudsplaining --input "${vals.policy}"`
    },
    "kube_2": {
        name: "Kube-hunter",
        inputs: [
            { id: "args", label: "Scan Option", type: "text", placeholder: "--remote 127.0.0.1", suggestion: "--remote 127.0.0.1", help: "Select the Kubernetes cluster scan target (e.g. '--remote 127.0.0.1' or '--cidr 192.168.1.0/24')." }
        ],
        commandBuilder: (vals) => `python kube-hunter/kube-hunter.py ${vals.args || ''}`
    },
    "soc_network_1": {
        name: "Zeek",
        inputs: [
            { id: "target", label: "Network Interface or PCAP Path", type: "text", placeholder: "eth0", required: true, suggestion: "eth0", help: "The network card name (e.g. eth0) or path to a recorded traffic file (.pcap) to inspect." }
        ],
        commandBuilder: (vals) => `zeek "${vals.target}"`
    },
    "soc_network_2": {
        name: "Suricata",
        inputs: [
            { id: "interface", label: "Interface", type: "text", default: "eth0", required: true, suggestion: "eth0", help: "The network card interface (e.g. eth0) to listen on for threat intrusion patterns." }
        ],
        commandBuilder: (vals) => `suricata -c /etc/suricata/suricata.yaml -i "${vals.interface}"`
    },
    "soc_network_3": {
        name: "Snort3",
        inputs: [
            { id: "target", label: "Interface / PCAP Path", type: "text", placeholder: "eth0", required: true, suggestion: "eth0", help: "The network interface card (e.g. eth0) or path to a recorded PCAP file to run Snort rules against." }
        ],
        commandBuilder: (vals) => `snort -c /etc/snort/snort.lua "${vals.target}"`
    },
    "soc_dfir_1": {
        name: "Volatility 3",
        inputs: [
            { id: "dumpfile", label: "Memory Dump File Path", type: "text", placeholder: "mem.dump", required: true, suggestion: "mem.dump", help: "The raw memory dump file path (e.g. ram.raw) to analyze for malware or processes." }
        ],
        commandBuilder: (vals) => `python volatility3/vol.py -f "${vals.dumpfile}"`
    },
    "soc_dfir_3": {
        name: "Chainsaw",
        inputs: [
            { id: "logpath", label: "Event Log Path", type: "text", placeholder: "logs/", required: true, suggestion: "logs/", help: "The path to the folder or file containing Windows Event Logs (.evtx) to search." }
        ],
        commandBuilder: (vals) => `chainsaw search "${vals.logpath}"`
    },
    "soc_dfir_4": {
        name: "Hayabusa",
        inputs: [
            { id: "logpath", label: "Event Log Path", type: "text", placeholder: "logs/", required: true, suggestion: "logs/", help: "The directory path of Windows Event Logs to parse and generate a timeline report." }
        ],
        commandBuilder: (vals) => `hayabusa csv-timeline -f "${vals.logpath}"`
    },
    "soc_threat_3": {
        name: "YARA",
        inputs: [
            { id: "rules", label: "Rules YAR File Path", type: "text", placeholder: "rules.yar", required: true, suggestion: "rules.yar", help: "Path to the YARA signature rule file containing patterns to search for." },
            { id: "dest", label: "Target Directory/File to Scan", type: "text", placeholder: "/root/hackingtool", required: true, suggestion: "/root/hackingtool", help: "The folder or file to scan with YARA rules to identify matching malware." }
        ],
        commandBuilder: (vals) => `yara "${vals.rules}" "${vals.dest}"`
    },
    "linux_2": {
        name: "OpenSCAP",
        inputs: [
            { id: "xccdf", label: "XCCDF File Path", type: "text", placeholder: "scap.xml", required: true, suggestion: "scap.xml", help: "Path to the SCAP security checklist XML file to evaluate compliance." }
        ],
        commandBuilder: (vals) => `oscap xccdf eval "${vals.xccdf}"`
    },
    "linux_3": {
        name: "Falco",
        inputs: [
            { id: "args", label: "Falco Arguments", type: "text", placeholder: "-r rules.yaml", suggestion: "-r rules.yaml", help: "Command line parameters for Falco runtime security scanner." }
        ],
        commandBuilder: (vals) => `falco ${vals.args}`
    },
    "linux_4": {
        name: "Auditd Userspace",
        inputs: [
            { id: "args", label: "Auditctl Rules", type: "text", placeholder: "-l", suggestion: "-l", help: "Command parameters to list or configure Auditd rules (e.g. '-l' to list rules)." }
        ],
        commandBuilder: (vals) => `auditctl ${vals.args}`
    },
    "red_4": {
        name: "Metasploit Framework",
        inputs: [
            { id: "args", label: "Custom Arguments (Optional)", type: "text", placeholder: "-q -x \"use auxiliary/scanner/portscan/tcp; set RHOSTS 192.168.1.1; run; exit\"", suggestion: "-q", help: "Optional commands to run. E.g. '-q' for quiet startup, or '-x' followed by commands to run and exit automatically." }
        ],
        commandBuilder: (vals) => `msfconsole ${vals.args || ''}`
    },
    "red_5": {
        name: "NetExec",
        inputs: [
            { id: "protocol", label: "Protocol", type: "select", options: [
                { value: "smb", label: "SMB" },
                { value: "winrm", label: "WinRM" },
                { value: "wmi", label: "WMI" },
                { value: "ldap", label: "LDAP" },
                { value: "ssh", label: "SSH" },
                { value: "mssql", label: "MSSQL" },
                { value: "ftp", label: "FTP" }
            ], default: "smb", help: "The network protocol to use for scanning and auditing." },
            { id: "target", label: "Target IP / Range", type: "text", placeholder: "192.168.1.0/24", required: true, default: "192.168.1.100", suggestion: "192.168.1.1", help: "The target IP address, domain name, or range to scan (e.g. 192.168.1.0/24)." },
            { id: "user", label: "Username (Optional)", type: "text", placeholder: "administrator", suggestion: "administrator", help: "Username for authentication checks." },
            { id: "password", label: "Password / Hash (Optional)", type: "text", placeholder: "admin123", suggestion: "admin123", help: "Plaintext password or NTLM hash (e.g., admin123 or LM:NT hash)." },
            { id: "extra", label: "Extra Arguments (Optional)", type: "text", placeholder: "--shares", suggestion: "--shares", help: "Other NetExec arguments, like '--shares' to check share permissions, or '-M spider_plus'." }
        ],
        commandBuilder: (vals) => {
            let u = vals.user ? `-u "${vals.user}"` : '';
            let p = vals.password ? `-p "${vals.password}"` : '';
            return `nxc ${vals.protocol || 'smb'} "${vals.target}" ${u} ${p} ${vals.extra || ''}`;
        }
    },
    "red_6": {
        name: "Impacket Suite",
        inputs: [
            { id: "tool", label: "Impacket Tool", type: "select", options: [
                { value: "impacket-secretsdump", label: "secretsdump (Dump LSA/SAM/AD hashes)" },
                { value: "impacket-psexec", label: "psexec (Interactive shell via SMB)" },
                { value: "impacket-wmiexec", label: "wmiexec (Semi-interactive shell via WMI)" },
                { value: "impacket-rpcdump", label: "rpcdump (Dump RPC endpoints)" },
                { value: "impacket-samrdump", label: "samrdump (Dump SAM users)" },
                { value: "impacket-mssqlclient", label: "mssqlclient (MSSQL database client)" }
            ], default: "impacket-secretsdump", help: "The specific Impacket utility to launch." },
            { id: "target", label: "Target / Connection String", type: "text", placeholder: "domain/user:password@target_ip", required: true, default: "administrator:admin123@192.168.1.100", suggestion: "administrator:password@192.168.1.100", help: "Connection details. Format: [domain/][user][:password]@target_ip (e.g., administrator:pass@192.168.1.100 or WORKGROUP/user@192.168.1.100)." },
            { id: "extra", label: "Extra Parameters (Optional)", type: "text", placeholder: "-just-dc", suggestion: "-just-dc", help: "Additional parameters for the selected tool (e.g., '-just-dc' for secretsdump, or '-hashes LM:NT')." }
        ],
        commandBuilder: (vals) => `${vals.tool || 'impacket-secretsdump'} "${vals.target}" ${vals.extra || ''}`
    },
    "red_7": {
        name: "Evil-WinRM",
        inputs: [
            { id: "target", label: "Target IP / Host", type: "text", placeholder: "192.168.1.100", required: true, default: "192.168.1.100", suggestion: "192.168.1.100", help: "The IP address or domain name of the remote Windows target." },
            { id: "user", label: "Username", type: "text", placeholder: "administrator", required: true, default: "administrator", suggestion: "administrator", help: "Username to authenticate with (e.g., administrator)." },
            { id: "password", label: "Password or NT Hash", type: "text", placeholder: "admin123 or hash", required: true, default: "admin123", suggestion: "admin123", help: "Password or NT hash for the user (can use hashes option with hash)." },
            { id: "use_ssl", label: "Use SSL / Encryption", type: "select", options: [
                { value: "No", label: "No (Port 5985)" },
                { value: "Yes", label: "Yes (Port 5986)" }
            ], default: "No", help: "Whether to connect over encrypted SSL (WinRM over HTTPS)." },
            { id: "extra", label: "Extra Arguments (Optional)", type: "text", placeholder: "-H [hash] or -s [scripts_path]", help: "Additional flags for evil-winrm connection parameters." }
        ],
        commandBuilder: (vals) => {
            let ssl = vals.use_ssl === "Yes" ? "-S" : "";
            return `evil-winrm -i "${vals.target}" -u "${vals.user}" -p "${vals.password}" ${ssl} ${vals.extra || ''}`;
        }
    },
    "mobile_1": {
        name: "ADB (Android Debug Bridge)",
        inputs: [
            { id: "target", label: "Connection Target (Wi-Fi IP:Port)", type: "text", placeholder: "10.101.244.123:5555", default: "10.101.244.123:5555", help: "The IP address and port of your Android phone (e.g., 10.101.244.123:5555). Leave blank if connected via USB." },
            { id: "command", label: "ADB Command", type: "select", options: [
                { value: "devices", label: "devices (List connected devices)" },
                { value: "connect", label: "connect (Connect to target IP via Wi-Fi)" },
                { value: "disconnect", label: "disconnect (Disconnect target IP)" },
                { value: "shell getprop", label: "shell getprop (Fetch system properties)" },
                { value: "shell pm list packages", label: "shell pm list packages (List installed apps)" }
            ], default: "devices", help: "Select the ADB operation to run against the device." },
            { id: "extra", label: "Extra Parameters / Shell Command (Optional)", type: "text", placeholder: "shell pm path com.android.chrome", help: "Additional parameters or direct shell commands to run on the device." }
        ],
        commandBuilder: (vals) => {
            let cmd = vals.command || "devices";
            if (cmd === "connect") {
                return `adb connect ${vals.target || '10.101.244.123:5555'}`;
            } else if (cmd === "disconnect") {
                return `adb disconnect ${vals.target || ''}`;
            } else {
                let targetFlag = vals.target ? `-s ${vals.target}` : '';
                return `adb ${targetFlag} ${cmd} ${vals.extra || ''}`;
            }
        }
    }
};

const fallbackSchema = {
    inputs: [
        { id: "arguments", label: "Target / Arguments", type: "text", placeholder: "Enter target, IP, URL, or custom arguments", required: true, help: "Enter the target website, IP address, or custom parameters required by the command." }
    ],
    commandBuilder: (vals, defaultCmd) => {
        let cmd = defaultCmd ? defaultCmd.replace(/\s+(-h|--help|-help|-version|--version|show options)\b.*$/, '') : '';
        return `${cmd} ${vals.arguments || ''}`;
    }
};

// ── Sizing View Mode ──
function setView(v) {
    currentView = v;
    const ws = document.getElementById("workspace");
    if (ws) ws.className = `workspace view-${v}`;
    
    const btnSplit = document.getElementById("btn-split");
    const btnTerm = document.getElementById("btn-term-only");
    const btnTools = document.getElementById("btn-tools-only");
    
    if (btnSplit) btnSplit.classList.toggle("active", v === "split");
    if (btnTerm) btnTerm.classList.toggle("active", v === "term");
    if (btnTools) btnTools.classList.toggle("active", v === "tools");
    
    setTimeout(() => { try { fitAddon.fit(); } catch(e) {} }, 150);
}

// ── Bootstrap on DOM ready ──
document.addEventListener("DOMContentLoaded", () => {
    // Collapse sidebar by default on mobile screens
    if (window.innerWidth <= 900) {
        const sidebar = document.getElementById("sidebar");
        if (sidebar) sidebar.classList.add("collapsed");
    }
    initTerminal();
    initSocket();
    initEventListeners();
    fetchToolsData();
    setView(currentView); // Sync view classes and buttons on startup
    switchLeftTab("terminal"); // Default to Terminal tab
});

// ═══════════════════════════════════════════════════════════════
//  1. XTERM TERMINAL
// ═══════════════════════════════════════════════════════════════
function initTerminal() {
    terminal = new Terminal({
        cursorBlink: true,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontSize: 14,
        lineHeight: 1.4,
        scrollback: 5000,
        theme: getTermTheme(document.getElementById("theme-selector")?.value || "theme-kali")
    });

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(document.getElementById("terminal"));

    // Clipboard key event handling (Ctrl+C to copy selection without terminating, Ctrl+V to paste)
    terminal.attachCustomKeyEventHandler((arg) => {
        if (arg.type === 'keydown') {
            // Ctrl+C: copy if there is selected text
            if (arg.ctrlKey && arg.code === 'KeyC') {
                if (terminal.hasSelection()) {
                    navigator.clipboard.writeText(terminal.getSelection()).catch(() => {});
                    return false; // Prevent sending SIGINT/control character to terminal
                }
            }
            // Ctrl+V: paste text from clipboard
            if (arg.ctrlKey && arg.code === 'KeyV') {
                navigator.clipboard.readText().then(text => {
                    if (socket && socket.connected) {
                        socket.emit("send_input", { data: text });
                    }
                }).catch(() => {});
                return false; // Prevent duplicate characters or browser default paste
            }
        }
        return true;
    });

    // Print welcome banner
    terminal.writeln("\x1b[1;31m\u250c" + "\u2500".repeat(60) + "\u2510\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[1;37mPHANTOM-X\x1b[1;31m - Security Intelligence Platform \x1b[0;90mv1.0\x1b[1;31m           \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2502  \x1b[0;90mTools list \u2192 Details \u2192 Install or Execute\x1b[1;31m                 \u2502\x1b[0m");
    terminal.writeln("\x1b[1;31m\u2514" + "\u2500".repeat(60) + "\u2518\x1b[0m");
    terminal.writeln("");
    terminal.writeln("\x1b[0;90m  Type directly in terminal | CTRL+C to copy | CTRL+V to paste | CTRL+X to stop\x1b[0m");
    terminal.writeln("");

    setTimeout(doFit, 300);

    // ResizeObserver on the xterm-container (most reliable)
    const xtermContainer = document.getElementById("xterm-container");
    if (xtermContainer && window.ResizeObserver) {
        const ro = new ResizeObserver(() => doFit());
        ro.observe(xtermContainer);
    }
    window.addEventListener("resize", () => setTimeout(doFit, 100));

    // Pass typing directly to backend
    terminal.onData((data) => {
        // Handle Ctrl+X (\x18) -> Kill running process/exit current tool
        if (data === '\x18') {
            terminal.write("^X\r\n\x1b[1;31m[SYSTEM] SIGINT (Ctrl+X) received. Terminating process...\x1b[0m\r\n");
            if (socket && socket.connected) {
                socket.emit("kill_process");
            }
            return;
        }

        if (usePty) {
            // Raw Mode for PTY (Forward other keystrokes directly to the terminal process)
            if (socket && socket.connected) {
                socket.emit("send_input", { data });
            }
            return;
        }

        // Buffer Mode for Windows fallback (Not used in Kali container, but kept for reliability)
        if (data === '\x03') {
            inputBuffer = "";
            terminal.write("^C\r\n");
            if (socket && socket.connected) {
                socket.emit("send_input", { data });
            }
            return;
        }

        // Buffer Mode for Windows fallback (Not used in Kali container, but kept for reliability)
        if (data === '\r' || data === '\n') { // Enter key
            if (socket && socket.connected) {
                socket.emit("send_input", { data: inputBuffer + "\n" });
            }
            terminal.write("\r\n");
            inputBuffer = "";
            return;
        }

        if (data === '\x7f' || data === '\x08') { // Backspace
            if (inputBuffer.length > 0) {
                inputBuffer = inputBuffer.slice(0, -1);
                terminal.write("\b \b");
            }
            return;
        }

        // Avoid echoing arrow keys/escape sequences (which start with \x1b)
        if (data.startsWith('\x1b')) {
            if (socket && socket.connected) {
                socket.emit("send_input", { data });
            }
            return;
        }

        // Printable characters echo locally and add to buffer
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
        "theme-kali":      { background: "#080610", foreground: "#d8d0f0", cursor: "#8c52ff", cursorAccent: "#000", selectionBackground: "rgba(140,82,255,0.3)" },
        "theme-cyberglow": { background: "#010502", foreground: "#00ff66", cursor: "#00ff66", cursorAccent: "#000", selectionBackground: "rgba(0,255,102,0.25)" },
        "theme-venomred":  { background: "#060102", foreground: "#ff4466", cursor: "#ff003c", cursorAccent: "#000", selectionBackground: "rgba(255,0,60,0.25)" },
    };
    return themes[themeClass] || themes["theme-kali"];
}

// ═══════════════════════════════════════════════════════════════
//  2. SOCKET.IO
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
        connDot.className   = "conn-dot connected";
        connLabel.textContent = "ONLINE";
        socket.emit("get_installed_status");
        
        // Sync initial terminal size
        if (terminal) {
            socket.emit("resize_terminal", { cols: terminal.cols, rows: terminal.rows });
        }
    });

    socket.on("disconnect", () => {
        connDot.className   = "conn-dot disconnected";
        connLabel.textContent = "OFFLINE";
    });

    // Terminal output
    socket.on("process_output", (data) => {
        if (terminal) terminal.write(data.data);
        if (guiInstallActive) {
            // Strip ANSI escape sequences
            const clean = data.data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
            guiInstallOutput += clean;
            const pre = document.getElementById("gui-install-console-pre");
            if (pre) {
                pre.innerHTML = highlightConsoleOutput(guiInstallOutput);
                const parent = pre.parentElement;
                if (parent) parent.scrollTop = parent.scrollHeight;
            }
        }
    });

    // Process exit
    socket.on("process_exit", (data) => {
        if (terminal && data.type !== "interactive") {
            terminal.writeln(`\r\n\x1b[0;31m[PROCESS EXIT] code: ${data.code}\x1b[0m`);
        }
        if (data.type === "install" && guiInstallActive) {
            guiInstallActive = false;
            if (data.code === 0) {
                // Succeeded! Auto-load the tool in GUI Mode
                setTimeout(() => {
                    closeGuiInstallModal();
                    if (guiInstallTool) {
                        guiSelectedTool = guiInstallTool;
                        renderGuiForm(guiInstallTool);
                    }
                }, 1200);
            } else {
                const pre = document.getElementById("gui-install-console-pre");
                if (pre) {
                    pre.innerHTML += `\n<span class="hl-line-fail">[SYSTEM ERROR] Installation failed with exit code: ${data.code}</span>\n`;
                    const parent = pre.parentElement;
                    if (parent) parent.scrollTop = parent.scrollHeight;
                }
            }
        }
        socket.emit("get_installed_status");
    });

    // Running state sync from backend
    socket.on("running_state_update", (state) => {
        runningState = state;
        applyRunningUIState();
    });

    // Tool installed statuses
    socket.on("installed_status_update", (map) => {
        installedMap = map;
        syncBadges(map);
    });

    // GUI tool output
    socket.on("gui_tool_output", (data) => {
        const consolePre = document.getElementById("gui-output-pre");
        if (consolePre) {
            guiRawOutput += data.data;
            consolePre.innerHTML = highlightConsoleOutput(guiRawOutput);
            const consoleBody = document.getElementById("gui-console-body");
            if (consoleBody) {
                consoleBody.scrollTop = consoleBody.scrollHeight;
            }
        }
    });

    // GUI tool exit
    socket.on("gui_tool_exit", (data) => {
        guiRunning = false;
        applyGuiRunningState();
        const consolePre = document.getElementById("gui-output-pre");
        if (consolePre) {
            guiRawOutput += `\n[PROCESS EXIT] code: ${data.code}\n`;
            consolePre.innerHTML = highlightConsoleOutput(guiRawOutput);
            const consoleBody = document.getElementById("gui-console-body");
            if (consoleBody) {
                consoleBody.scrollTop = consoleBody.scrollHeight;
            }
        }
        socket.emit("get_installed_status");
    });
}

// ═══════════════════════════════════════════════════════════════
//  3. LOAD & RENDER TOOLS
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
    a.className = `nav-item ${currentCategory === name ? "active" : ""}`;
    a.innerHTML = `
        <div class="nav-item-left"><i class="${icon}"></i><span>${formatCategoryName(name)}</span></div>
        <span class="nav-badge">${count}</span>
    `;
    a.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
        a.classList.add("active");
        currentCategory = name;
        document.getElementById("tools-cat-title").textContent = formatCategoryName(name);
        // Reset search input
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        // Sync chip selection too
        document.querySelectorAll(".cat-chip").forEach(c => {
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
    c.className = `cat-chip ${currentCategory === name ? "active" : ""}`;
    c.dataset.cat = name;
    c.innerHTML = `<i class="${icon}"></i>${formatCategoryName(name)}<span class="chip-count">${count}</span>`;
    c.addEventListener("click", (e) => {
        e.preventDefault();
        document.querySelectorAll(".cat-chip").forEach(el => el.classList.remove("active"));
        c.classList.add("active");
        currentCategory = name;
        document.getElementById("tools-cat-title").textContent = formatCategoryName(name);
        // Reset search input
        const searchInput = document.getElementById("search-input");
        if (searchInput) searchInput.value = "";
        // Sync sidebar
        document.querySelectorAll(".nav-item").forEach(el => {
            const label = el.querySelector(".nav-item-left span");
            if (label) el.classList.toggle("active", label.textContent === formatCategoryName(name));
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

    document.getElementById("tools-count").textContent = `${tools.length} tools`;

    if (!tools.length) {
        grid.innerHTML = `<div class="no-results">No tools found for "<strong>${search || currentCategory}</strong>"</div>`;
        return;
    }

    tools.forEach((tool, idx) => {
        const card = document.createElement("div");
        card.className = "tool-card";
        card.style.animationDelay = `${Math.min(idx * 15, 200)}ms`;

        const isInst = installedMap[tool.id];
        const badgeHtml = buildBadgeHtml(isInst);

        card.innerHTML = `
            <div class="card-top">
                <div class="card-name">${escapeHtml(tool.name)}</div>
                <div id="badge-${tool.id}">${badgeHtml}</div>
            </div>
            <p class="card-desc">${escapeHtml(tool.description || "No description available.")}</p>
            <div class="card-footer-row">
                <button class="card-detail-btn"><i class="fa-solid fa-circle-info"></i> Details</button>
            </div>
        `;
        card.addEventListener("click", () => {
            if (activeLeftTab === "gui") {
                const isInst = installedMap[tool.id];
                if (isInst) {
                    guiSelectedTool = tool;
                    renderGuiForm(tool);
                } else {
                    showDownloadInstallModal(tool);
                }
            } else {
                showModal(tool);
            }
        });
        grid.appendChild(card);
    });

    if (socket && socket.connected) {
        socket.emit("get_installed_status");
    }
}

function buildBadgeHtml(isInstalled) {
    if (isInstalled === undefined) {
        return `<span class="badge checking">...</span>`;
    }
    if (isInstalled) {
        return `<span class="badge installed"><i class="fa-solid fa-check"></i> Installed</span>`;
    }
    return `<span class="badge not-installed"><i class="fa-solid fa-download"></i> Get</span>`;
}

function syncBadges(map) {
    let installed = 0;
    Object.entries(map).forEach(([id, status]) => {
        if (status) installed++;
        const el = document.getElementById(`badge-${id}`);
        if (el) el.innerHTML = buildBadgeHtml(status);
    });
    document.getElementById("stat-cloned").textContent = installed;

    // Update modal if open
    if (selectedTool && map[selectedTool.id] !== undefined) {
        const isInst = map[selectedTool.id];
        updateModalButtons(isInst);
    }

    // Update active GUI tool if loaded
    if (guiSelectedTool && map[guiSelectedTool.id] !== undefined) {
        syncGuiToolInstallState(map[guiSelectedTool.id]);
    }
}

// ═══════════════════════════════════════════════════════════════
//  4. MODAL
// ═══════════════════════════════════════════════════════════════
function showModal(tool) {
    selectedTool = tool;

    // Auto-load tool into GUI form
    renderGuiForm(tool);

    document.getElementById("modal-cat-label").textContent   = formatCategoryName(tool.categoryName || "TOOL");
    document.getElementById("modal-tool-name").textContent   = tool.name;
    document.getElementById("modal-description").textContent = tool.description || "No description available.";
    document.getElementById("modal-tool-id").textContent     = tool.id || "—";

    // Icon based on category
    const iconEl = document.getElementById("modal-icon-wrap");
    iconEl.innerHTML = `<i class="${getCategoryIcon(tool.categoryName || '')}"></i>`;

    // Repo link
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

    // Commands
    const cmdEl = document.getElementById("modal-cmd-code");
    cmdEl.textContent = (tool.commands && tool.commands.length)
        ? tool.commands.join("\n")
        : "No command defined.";

    // Install / run state
    const isInst = installedMap[tool.id];
    updateModalButtons(isInst);

    document.getElementById("detail-modal").classList.add("active");

    if (socket && socket.connected) {
        socket.emit("get_installed_status");
    }
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
        badge.innerHTML   = `<i class="fa-solid fa-check"></i> Installed`;
        btnRun.disabled   = false;
        btnInst.disabled  = true;
        if (btnUninst) btnUninst.style.display = "inline-flex";
    } else {
        badge.className   = "badge not-installed";
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
//  5. RUNNING STATE UI
// ═══════════════════════════════════════════════════════════════
function applyRunningUIState() {
    const dot      = document.getElementById("ps-dot");
    const text     = document.getElementById("ps-text");
    const killBtn  = document.getElementById("btn-kill-process");
    const tabTitle = document.getElementById("terminal-tab-title");

    if (runningState.running) {
        dot.className  = "ps-dot running";
        text.textContent = `RUNNING: ${(runningState.name || "").toUpperCase()}`;
        killBtn.disabled = false;
        if (tabTitle) tabTitle.textContent = `root@PHANTOM-X: [${runningState.name}]`;
    } else {
        dot.className  = "ps-dot idle";
        text.textContent = "SYSTEM IDLE";
        killBtn.disabled = true;
        if (tabTitle) tabTitle.textContent = "root@PHANTOM-X: ~/hackingtool";
    }
}

// ═══════════════════════════════════════════════════════════════
//  6. EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
function initEventListeners() {

    // ── Sidebar toggle ──
    document.getElementById("btn-sidebar-toggle").addEventListener("click", () => {
        document.querySelector(".sidebar").classList.toggle("collapsed");
        setTimeout(() => { try { fitAddon.fit(); } catch(e) {} }, 250);
    });

    document.getElementById("btn-split").addEventListener("click", () => setView("split"));
    document.getElementById("btn-term-only").addEventListener("click", () => {
        if (currentView !== "term") {
            setView("term");
            switchLeftTab("terminal");
        } else {
            const nextTab = (activeLeftTab === "terminal") ? "gui" : "terminal";
            switchLeftTab(nextTab);
        }
    });
    document.getElementById("btn-tools-only").addEventListener("click", () => setView("tools"));

    // ── Theme selector ──
    document.getElementById("theme-selector").addEventListener("change", (e) => {
        document.body.className = e.target.value;
        if (terminal) {
            terminal.options.theme = getTermTheme(e.target.value);
        }
    });

    // ── Search ──
    document.getElementById("search-input").addEventListener("input", renderTools);
    document.getElementById("search-clear").addEventListener("click", () => {
        document.getElementById("search-input").value = "";
        renderTools();
    });

    // ── Modal: close ──
    document.getElementById("btn-close-modal").addEventListener("click", closeModal);
    document.getElementById("detail-modal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("detail-modal")) closeModal();
    });

    // ── Modal: open repo ──
    document.getElementById("btn-open-repo").addEventListener("click", () => {
        if (selectedTool && selectedTool.repo) window.open(selectedTool.repo, "_blank");
    });

    // ── Modal: install tool ──
    document.getElementById("btn-install-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;33m[SYSTEM] Installing: ${selectedTool.name}...\x1b[0m`);
        socket.emit("install_tool", { tool_id: selectedTool.id });
        closeModal();
        // Switch to terminal view if not visible
        if (currentView === "tools") setView("split");
    });

    // ── Modal: uninstall tool ──
    document.getElementById("btn-uninstall-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;31m[SYSTEM] Deleting tool files: ${selectedTool.name}...\x1b[0m`);
        socket.emit("uninstall_tool", { tool_id: selectedTool.id });
        closeModal();
    });

    // ── Modal: run tool ──
    document.getElementById("btn-run-tool").addEventListener("click", () => {
        if (!selectedTool) return;
        terminal.writeln(`\r\n\x1b[1;32m[SYSTEM] Launching: ${selectedTool.name}...\x1b[0m`);
        socket.emit("run_tool", { tool_id: selectedTool.id });
        closeModal();
        if (currentView === "tools") setView("split");
    });

    // ── Kill process ──
    document.getElementById("btn-kill-process").addEventListener("click", () => {
        if (socket) socket.emit("kill_process");
    });

    // ── Run CLI Menu ──
    document.getElementById("btn-run-menu").addEventListener("click", () => {
        terminal.writeln(`\r\n\x1b[1;35m[SYSTEM] Launching AllHackingTools CLI Menu...\x1b[0m`);
        socket.emit("send_input", { data: "python hackingtool.py\n" });
        if (currentView === "tools") setView("split");
    });

    // ── Reset dir ──
    document.getElementById("btn-reset-dir").addEventListener("click", () => {
        terminal.writeln(`\r\n\x1b[0;36m[SYSTEM] Resetting to home directory...\x1b[0m`);
        socket.emit("reset_directory");
    });

    // ── Clear terminal ──
    document.getElementById("btn-clear-term").addEventListener("click", () => {
        terminal.clear();
    });

    // ── Auto-focus terminal on click anywhere in term-panel ──
    document.getElementById("term-panel").addEventListener("click", () => {
        if (terminal && activeLeftTab === "terminal") {
            terminal.focus();
        }
    });

    // Auto focus terminal on boot
    setTimeout(() => {
        if (terminal) terminal.focus();
    }, 1000);

    // ── Keyboard shortcut: Escape = close modal ──
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeModal();
            closeGuiInstallModal();
        }
    });

    // ── GUI Install Modal Event Listeners ──
    const btnCloseGuiInstall = document.getElementById("btn-close-gui-install-modal");
    if (btnCloseGuiInstall) {
        btnCloseGuiInstall.addEventListener("click", closeGuiInstallModal);
    }
    const btnCancelGuiInstall = document.getElementById("btn-cancel-gui-install");
    if (btnCancelGuiInstall) {
        btnCancelGuiInstall.addEventListener("click", closeGuiInstallModal);
    }
    const btnStartGuiInstall = document.getElementById("btn-start-gui-install");
    if (btnStartGuiInstall) {
        btnStartGuiInstall.addEventListener("click", () => {
            if (!guiInstallTool) return;
            document.getElementById("gui-install-initial-screen").style.display = "none";
            document.getElementById("gui-install-progress-screen").style.display = "block";
            
            guiInstallActive = true;
            guiInstallOutput = `[SYSTEM] Preparing installation for ${guiInstallTool.name}...\n`;
            guiInstallOutput += `[SYSTEM] Initiating server-side download process...\n\n`;
            
            const pre = document.getElementById("gui-install-console-pre");
            if (pre) pre.innerHTML = highlightConsoleOutput(guiInstallOutput);
            
            socket.emit("install_tool", { tool_id: guiInstallTool.id });
        });
    }
    const guiInstallModal = document.getElementById("gui-install-modal");
    if (guiInstallModal) {
        guiInstallModal.addEventListener("click", (e) => {
            if (e.target === guiInstallModal) closeGuiInstallModal();
        });
    }

    // ── GUI Tabs & Actions listeners ──
    const tabTerm = document.getElementById("tab-terminal");
    const tabGui = document.getElementById("tab-gui");
    if (tabTerm && tabGui) {
        tabTerm.addEventListener("click", () => switchLeftTab("terminal"));
        tabGui.addEventListener("click", () => switchLeftTab("gui"));
    }

    const btnGuiRun = document.getElementById("btn-gui-run");
    if (btnGuiRun) {
        btnGuiRun.addEventListener("click", runGuiToolScan);
    }

    const btnGuiStop = document.getElementById("btn-gui-stop");
    if (btnGuiStop) {
        btnGuiStop.addEventListener("click", stopGuiToolScan);
    }

    const btnGuiClear = document.getElementById("btn-gui-clear-console");
    if (btnGuiClear) {
        btnGuiClear.addEventListener("click", () => {
            guiRawOutput = "";
            const consolePre = document.getElementById("gui-output-pre");
            if (consolePre) consolePre.innerHTML = "";
        });
    }
}

// ═══════════════════════════════════════════════════════════════
//  7. UTILITIES
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

function formatCategoryName(name) {
    if (!name) return "";
    // Remove typical emojis
    let clean = name.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '');
    return clean.trim().toUpperCase();
}

// ═══════════════════════════════════════════════════════════════
//  8. GUI MODE HELPERS
// ═══════════════════════════════════════════════════════════════
function switchLeftTab(tabName) {
    activeLeftTab = tabName;
    const tabTerm = document.getElementById("tab-terminal");
    const tabGui = document.getElementById("tab-gui");
    const containerTerm = document.getElementById("xterm-container");
    const containerGui = document.getElementById("gui-container");
    
    if (tabTerm && tabGui) {
        tabTerm.classList.toggle("active", tabName === "terminal");
        tabGui.classList.toggle("active", tabName === "gui");
    }
    
    if (containerTerm && containerGui) {
        if (tabName === "terminal") {
            containerTerm.style.display = "block";
            containerGui.style.display = "none";
            setTimeout(doFit, 100);
        } else {
            containerTerm.style.display = "none";
            containerGui.style.display = "flex";
        }
    }
}

function renderGuiForm(tool) {
    guiSelectedTool = tool;
    
    const catLabel = document.getElementById("gui-tool-cat");
    const toolNameEl = document.getElementById("gui-tool-name");
    const toolDescEl = document.getElementById("gui-tool-desc");
    
    if (!tool) {
        if (catLabel) catLabel.textContent = "PHANTOM-X";
        if (toolNameEl) toolNameEl.textContent = "Select a Tool";
        if (toolDescEl) toolDescEl.textContent = "Click any tool on the right to configure parameters and run it in GUI Mode.";
        syncGuiToolInstallState(false);
        return;
    }
    
    if (catLabel) catLabel.textContent = formatCategoryName(tool.categoryName || "TOOL");
    if (toolNameEl) toolNameEl.textContent = tool.name;
    if (toolDescEl) toolDescEl.textContent = tool.description || "No description available.";
    
    const isInst = installedMap[tool.id];
    syncGuiToolInstallState(isInst);
    
    // Build inputs
    const form = document.getElementById("gui-inputs-form");
    if (!form) return;
    form.innerHTML = "";
    
    const schema = GUI_SCHEMAS[tool.id] || fallbackSchema;
    if (!schema.inputs || schema.inputs.length === 0) {
        form.innerHTML = `<div class="gui-no-inputs">No options to configure. Click Run Security Scan below.</div>`;
        return;
    }
    
    schema.inputs.forEach(input => {
        const group = document.createElement("div");
        group.className = "gui-field-group";
        
        const label = document.createElement("label");
        label.className = "gui-label";
        label.innerHTML = `<span>${input.label}</span>`;
        if (input.required) {
            label.innerHTML += ` <span style="color: var(--c-danger)">*</span>`;
        }
        group.appendChild(label);
        
        let control = null;
        if (input.type === "select") {
            control = document.createElement("select");
            control.className = "gui-select";
            input.options.forEach(opt => {
                const o = document.createElement("option");
                o.value = opt.value;
                o.textContent = opt.label;
                control.appendChild(o);
            });
            if (input.default !== undefined) {
                control.value = input.default;
            }
        } else {
            control = document.createElement("input");
            control.type = input.type || "text";
            control.className = "gui-input";
            control.placeholder = input.placeholder || "";
            if (input.default !== undefined) {
                control.value = input.default;
            }
        }
        
        control.id = `gui-input-${input.id}`;
        control.name = input.id;
        if (input.required) {
            control.required = true;
        }
        if (input.help) {
            control.title = input.help;
        }
        group.appendChild(control);

        // User helper explanation tip
        if (input.help) {
            const helpTip = document.createElement("div");
            helpTip.className = "gui-help-tip";
            helpTip.innerHTML = `<i class="fa-solid fa-circle-question"></i> <span>${input.help}</span>`;
            group.appendChild(helpTip);
        }
        
        // Add suggestion buttons if available
        if (input.suggestion) {
            const sugRow = document.createElement("div");
            sugRow.className = "gui-suggestion-row";
            
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "gui-suggestion-btn";
            btn.textContent = `Use: ${input.suggestion}`;
            btn.addEventListener("click", () => {
                control.value = input.suggestion;
            });
            sugRow.appendChild(btn);
            group.appendChild(sugRow);
        }
        
        form.appendChild(group);
    });
}

function syncGuiToolInstallState(isInst) {
    const statusBadge = document.getElementById("gui-tool-status");
    const warningCard = document.getElementById("gui-warning-card");
    const formWrap = document.getElementById("gui-form-wrap");
    const btnRun = document.getElementById("btn-gui-run");
    
    if (!guiSelectedTool) {
        if (statusBadge) {
            statusBadge.className = "badge checking";
            statusBadge.textContent = "Select Tool";
        }
        if (warningCard) warningCard.style.display = "none";
        if (formWrap) formWrap.style.display = "block";
        if (btnRun) btnRun.disabled = true;
        return;
    }
    
    if (isInst === undefined) {
        if (statusBadge) {
            statusBadge.className = "badge checking";
            statusBadge.textContent = "Checking...";
        }
        if (btnRun) btnRun.disabled = true;
        return;
    }
    
    if (isInst) {
        if (statusBadge) {
            statusBadge.className = "badge installed";
            statusBadge.innerHTML = `<i class="fa-solid fa-check"></i> Installed`;
        }
        if (warningCard) warningCard.style.display = "none";
        if (formWrap) formWrap.style.display = "block";
        if (btnRun && !guiRunning) btnRun.disabled = false;
    } else {
        if (statusBadge) {
            statusBadge.className = "badge not-installed";
            statusBadge.innerHTML = `<i class="fa-solid fa-download"></i> Get`;
        }
        if (warningCard) warningCard.style.display = "flex";
        if (formWrap) formWrap.style.display = "none";
        if (btnRun) btnRun.disabled = true;
    }
}

function applyGuiRunningState() {
    const btnRun = document.getElementById("btn-gui-run");
    const btnStop = document.getElementById("btn-gui-stop");
    
    if (guiRunning) {
        if (btnRun) btnRun.disabled = true;
        if (btnStop) btnStop.disabled = false;
    } else {
        const isInst = guiSelectedTool ? installedMap[guiSelectedTool.id] : false;
        if (btnRun) btnRun.disabled = !isInst;
        if (btnStop) btnStop.disabled = true;
    }
}

function runGuiToolScan() {
    if (!guiSelectedTool || guiRunning) return;
    
    const schema = GUI_SCHEMAS[guiSelectedTool.id] || fallbackSchema;
    const form = document.getElementById("gui-inputs-form");
    if (!form) return;
    
    const vals = {};
    let valid = true;
    
    if (schema.inputs) {
        schema.inputs.forEach(input => {
            const el = document.getElementById(`gui-input-${input.id}`);
            if (el) {
                const val = el.value.trim();
                if (input.required && !val) {
                    el.style.borderColor = "var(--c-danger)";
                    setTimeout(() => el.style.borderColor = "", 2000);
                    valid = false;
                }
                vals[input.id] = val;
            }
        });
    }
    
    if (!valid) {
        const consolePre = document.getElementById("gui-output-pre");
        if (consolePre) consolePre.innerHTML = highlightConsoleOutput("[SYSTEM ERROR] Please fill all required fields.\n");
        return;
    }
    
    let cmd = "";
    if (schema === fallbackSchema) {
        const defaultCmd = guiSelectedTool.commands ? guiSelectedTool.commands[0] : "";
        cmd = schema.commandBuilder(vals, defaultCmd);
    } else {
        cmd = schema.commandBuilder(vals);
    }
    
    guiRunning = true;
    applyGuiRunningState();
    
    guiRawOutput = `[SYSTEM] Starting execution of ${guiSelectedTool.name}...\n`;
    guiRawOutput += `[SYSTEM] Command: ${cmd}\n\n`;
    
    const consolePre = document.getElementById("gui-output-pre");
    if (consolePre) {
        consolePre.innerHTML = highlightConsoleOutput(guiRawOutput);
    }
    
    socket.emit("run_gui_tool", {
        tool_id: guiSelectedTool.id,
        tool_name: guiSelectedTool.name,
        command: cmd
    });
}

function stopGuiToolScan() {
    if (!guiRunning) return;
    socket.emit("kill_gui_tool", { tool_id: guiSelectedTool ? guiSelectedTool.id : null });
}

// ── Output Highlighting Helper for GUI Mode ──
function highlightConsoleOutput(text) {
    if (!text) return "";
    
    // 1. Escape HTML entities
    let escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // 2. Process line by line
    let lines = escaped.split("\n");
    lines = lines.map(line => {
        let inline = line;

        // IPs (e.g. 192.168.1.1)
        inline = inline.replace(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g, '<span class="hl-target">$1</span>');
        
        // URLs
        inline = inline.replace(/\b(https?:\/\/[^\s\'\"\)\]\}]+)/ig, '<span class="hl-target">$1</span>');

        // CVEs
        inline = inline.replace(/\b(cve-\d{4}-\d{4,7})\b/ig, '<span class="hl-vuln">$1</span>');

        // Vuln words
        const vulnKeywords = /\b(vulnerable|vulnerability|vulnerabilities|exploit(?:ed)?|rce|sqli|xss|lfi|rfi|backdoor|malware)\b/ig;
        inline = inline.replace(vulnKeywords, match => `<span class="hl-vuln">${match}</span>`);

        // Severity words
        const severityKeywords = /\b(critical|high|fatal|severe)\b/ig;
        inline = inline.replace(severityKeywords, match => `<span class="hl-vuln">${match}</span>`);

        // Credentials
        const credentials = /\b(pass(?:word)?|passwd|secret|private[-_]key|api[-_]key|credentials?|token|auth)\s*[:=]\s*([a-zA-Z0-9_\-\.\@\!]+)/ig;
        inline = inline.replace(credentials, (m, p1, p2) => `<span class="hl-creds">${p1}:${p2}</span>`);

        const adminCreds = /\b(admin\s*[\/:|]\s*admin|admin\s*password\s*is\s*\S+)\b/ig;
        inline = inline.replace(adminCreds, '<span class="hl-creds">$1</span>');

        // Open ports
        const openPorts = /\b(\d+\/(?:tcp|udp)\s+open\s+\S*)/ig;
        inline = inline.replace(openPorts, '<span class="hl-port">$1</span>');
        
        const portFound = /\b(port\s+\d+\s+is\s+open|open\s+port\s+\d+)\b/ig;
        inline = inline.replace(portFound, '<span class="hl-port">$1</span>');

        // Wrap the entire line if it starts with indicators
        if (inline.trim().startsWith("[+]")) {
            inline = `<span class="hl-line-success">${inline}</span>`;
        } else if (inline.trim().startsWith("[*]")) {
            inline = `<span class="hl-line-info">${inline}</span>`;
        } else if (inline.trim().startsWith("[-]") || inline.trim().startsWith("[!]")) {
            inline = `<span class="hl-line-fail">${inline}</span>`;
        }

        return inline;
    });

    return lines.join("\n");
}

// ── GUI Mode Install Modal Helpers ──
function showDownloadInstallModal(tool) {
    guiInstallTool = tool;
    guiInstallActive = false;
    guiInstallOutput = "";
    
    document.getElementById("gui-install-tool-name").textContent = tool.name;
    document.getElementById("gui-install-tool-desc").textContent = tool.description || "This tool is not installed. To use it in GUI Mode, you need to download and install it first.";
    document.getElementById("gui-install-console-pre").textContent = "";
    
    document.getElementById("gui-install-initial-screen").style.display = "block";
    document.getElementById("gui-install-progress-screen").style.display = "none";
    
    document.getElementById("gui-install-modal").classList.add("active");
}

function closeGuiInstallModal() {
    if (guiInstallActive) {
        socket.emit("kill_process");
        guiInstallActive = false;
    }
    document.getElementById("gui-install-modal").classList.remove("active");
}


