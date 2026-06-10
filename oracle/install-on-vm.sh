#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/miami-bot}"
REPO_URL="${1:-}"
BRANCH="${BRANCH:-main}"

if [[ -z "${REPO_URL}" ]]; then
  echo "Usage: bash oracle/install-on-vm.sh <github_repo_url>"
  echo "Example: bash oracle/install-on-vm.sh https://github.com/yourname/miami-bot.git"
  exit 1
fi

echo "[1/7] Installing base packages..."
sudo apt-get update
sudo apt-get install -y curl git build-essential

echo "[2/7] Installing Node.js 20..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "[3/7] Installing PM2..."
sudo npm install -g pm2

echo "[4/7] Cloning or updating application repo..."
if [[ -d "${APP_DIR}/.git" ]]; then
  git -C "${APP_DIR}" fetch origin
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only origin "${BRANCH}"
else
  sudo mkdir -p "$(dirname "${APP_DIR}")"
  sudo chown -R "$USER":"$USER" "$(dirname "${APP_DIR}")"
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

echo "[5/7] Installing dependencies..."
npm ci

echo "[6/7] Building project..."
npm run build

echo "[7/7] Starting PM2 app..."
pm2 start ecosystem.config.cjs --update-env || pm2 restart miami-bot --update-env
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME"

echo
echo "Oracle install complete."
echo "Next:"
echo "1. Copy your .env file into ${APP_DIR}/.env"
echo "2. Copy your runtime JSON files listed in oracle/runtime-files.txt"
echo "3. Run: bash oracle/update-on-vm.sh"
