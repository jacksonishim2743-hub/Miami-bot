#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/miami-bot}"
BRANCH="${BRANCH:-main}"

cd "${APP_DIR}"

echo "[1/4] Pulling latest code from ${BRANCH}..."
git fetch origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[2/4] Installing dependencies..."
npm ci

echo "[3/4] Building project..."
npm run build

echo "[4/4] Restarting PM2 app..."
pm2 restart miami-bot --update-env
pm2 save

echo "Miami bot updated successfully."
