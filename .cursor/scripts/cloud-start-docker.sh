#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/bin:/bin:${PATH:-}"

if docker info >/dev/null 2>&1; then
  exit 0
fi

sudo mkdir -p /var/run/docker /var/lib/docker

if command -v update-alternatives >/dev/null 2>&1; then
  sudo update-alternatives --set iptables /usr/sbin/iptables-legacy >/dev/null 2>&1 || true
  sudo update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy >/dev/null 2>&1 || true
fi

if ! pgrep -x dockerd >/dev/null 2>&1; then
  sudo dockerd \
    --host=unix:///var/run/docker.sock \
    --storage-driver=fuse-overlayfs \
    > /tmp/dockerd.log 2>&1 &
fi

for _ in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    sudo usermod -aG docker "${USER:-ubuntu}" >/dev/null 2>&1 || true
    if [[ -S /var/run/docker.sock ]] && [[ ! -w /var/run/docker.sock ]]; then
      sudo chmod 666 /var/run/docker.sock 2>/dev/null || true
    fi
    exit 0
  fi
  sleep 1
done

echo "Docker daemon failed to become ready" >&2
tail -50 /tmp/dockerd.log >&2 || true
exit 1
