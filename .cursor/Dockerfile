FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    fuse3 \
    fuse-overlayfs \
    iptables \
    sudo \
  && curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && install -d /usr/share/keyrings \
  && curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
  && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu noble stable" \
    > /etc/apt/sources.list.d/docker.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    xvfb \
    fonts-noto-color-emoji \
    fonts-unifont \
    libfontconfig1 \
    libfreetype6 \
    xfonts-cyrillic \
    xfonts-scalable \
    fonts-liberation \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-tlwg-loma-otf \
    fonts-freefont-ttf \
    libasound2t64 \
    libatk-bridge2.0-0t64 \
    libatk1.0-0t64 \
    libatspi2.0-0t64 \
    libcairo2 \
    libcups2t64 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0t64 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
  && update-alternatives --set iptables /usr/sbin/iptables-legacy \
  && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy \
  && groupadd -f docker \
  && if ! id ubuntu >/dev/null 2>&1; then \
    useradd -m -s /bin/bash -G docker ubuntu; \
  else \
    usermod -aG docker ubuntu; \
  fi \
  && mkdir -p /var/run/docker /var/lib/docker \
  && install -d -m 0750 /etc/sudoers.d \
  && printf '%s\n' \
    '# Cursor Cloud: allow ubuntu to bootstrap Docker without an interactive TTY.' \
    'Defaults:ubuntu !requiretty' \
    'ubuntu ALL=(root) NOPASSWD: /usr/bin/mkdir, /usr/sbin/update-alternatives, /usr/bin/dockerd, /usr/sbin/usermod, /usr/bin/chmod, /bin/chmod' \
    > /etc/sudoers.d/cursor-docker \
  && chmod 440 /etc/sudoers.d/cursor-docker \
  && visudo -c \
  && su - ubuntu -c 'sudo -n true && sudo -n mkdir -p /tmp/cursor-sudo-check' \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

USER ubuntu
