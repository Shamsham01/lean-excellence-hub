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
    'ubuntu ALL=(root) NOPASSWD: /usr/bin/mkdir, /usr/sbin/update-alternatives, /usr/bin/dockerd, /usr/sbin/usermod, /usr/bin/chmod' \
    > /etc/sudoers.d/cursor-docker \
  && chmod 440 /etc/sudoers.d/cursor-docker \
  && visudo -c \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

USER ubuntu
