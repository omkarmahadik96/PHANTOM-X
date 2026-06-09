# syntax=docker/dockerfile:1
FROM kalilinux/kali-rolling:latest

LABEL org.opencontainers.image.title="hackingtool-gui" \
      org.opencontainers.image.description="All-in-One Hacking Tool Web GUI for Security Researchers" \
      org.opencontainers.image.source="https://github.com/Z4nzu/hackingtool" \
      org.opencontainers.image.licenses="MIT"

# Install system dependencies + standard Kali tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        git python3-pip python3-venv python-is-python3 curl wget php nmap hydra sqlmap sudo unzip zip tar net-tools iputils-ping libpcap-dev \
        build-essential golang ruby ruby-dev default-jdk && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /root/hackingtool

# Copy requirements first for cache optimization
COPY requirements.txt ./

# Install python dependencies
RUN pip3 install --break-system-packages -r requirements.txt

# Copy the rest of the source (respects .dockerignore)
COPY . .

# Ensure the tools directory exists for runtime clones
RUN mkdir -p /root/.hackingtool/tools

# Expose Web GUI port
EXPOSE 5000

# Start Flask + Socket.IO server by default
CMD ["python3", "gui_server.py"]
