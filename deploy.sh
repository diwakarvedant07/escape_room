#!/usr/bin/env bash
# Deploy: pull the latest code and restart the app under pm2.
# Run on the server from anywhere:  bash deploy.sh
# The hub's "Deploy update" button runs this same script.
set -euo pipefail

BRANCH="${DEPLOY_BRANCH:-master}"
PM2_APP="${PM2_APP:-10}"

cd "$(dirname "$0")"

echo "== $(date -u +%Y-%m-%dT%H:%M:%SZ) deploy started in $(pwd)"
echo "== git pull origin $BRANCH"
git pull origin "$BRANCH"

echo "== pm2 restart $PM2_APP"
pm2 restart "$PM2_APP"

echo "== deploy finished"
