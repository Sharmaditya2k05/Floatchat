#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu 22.04/24.04 Oracle Cloud VM:
# installs Docker + Compose and opens HTTP/HTTPS in the OS firewall.
#   curl -fsSL https://raw.githubusercontent.com/SaiGrover/FloatChat/main/deploy/server_setup.sh | bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"

# Swap, so the stack (and any local image build) survives on a small VM.
if ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

# Oracle's Ubuntu images ship iptables rules that block everything except SSH.
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent >/dev/null 2>&1 || true
sudo netfilter-persistent save >/dev/null 2>&1 || true

echo
echo "Docker installed. Log out and back in (so the docker group applies), then:"
echo "  git clone https://github.com/SaiGrover/FloatChat.git && cd FloatChat"
