#!/usr/bin/env bash
# Run on a fresh Ubuntu Oracle Ampere VM (as ubuntu/opc with sudo).
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
fi

$SUDO apt-get update
$SUDO apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
  $SUDO usermod -aG docker "${SUDO_USER:-$USER}" || true
fi

$SUDO ufw allow OpenSSH
$SUDO ufw allow 80/tcp
$SUDO ufw allow 443/tcp
$SUDO ufw --force enable || true

echo "Docker ready. Clone the repo, cd deploy/oracle, copy .env.example → .env, then:"
echo "  docker compose up -d --build"
