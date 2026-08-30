#!/usr/bin/env bash
# Build the frontend export, pick a free port, run backend+static under PM2, print IP:PORT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$ROOT/node_modules/.bin:$PATH"

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2…"
  npm install --prefix "$ROOT" --no-fund --no-audit pm2
fi

PM2="$(command -v pm2)"

if [[ -f "$ROOT/frontend/package.json" ]]; then
  if [[ -f "$ROOT/frontend/out/index.html" && "${FORCE_REBUILD:-}" != "1" ]]; then
    echo "Using existing frontend/out"
  else
    echo "Building frontend…"
    (cd "$ROOT/frontend" && npm install --no-fund --no-audit && npm run build)
  fi
fi

PORT="$(python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("0.0.0.0", 0))
print(s.getsockname()[1])
s.close()
PY
)"

export PORT HOST=0.0.0.0
export PUBLIC_CONTRACT_ADDRESS="${PUBLIC_CONTRACT_ADDRESS:-}"
export FORGE_STATIC="${FORGE_STATIC:-$ROOT/frontend/out}"
export FORGE_DB="${FORGE_DB:-$ROOT/data/forge_layer.sqlite}"

mkdir -p "$ROOT/data" "$ROOT/logs"

cat > "$ROOT/logs/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [{
    name: "forge-layer",
    script: "$ROOT/server/main.py",
    interpreter: "python3",
    cwd: "$ROOT/server",
    kill_timeout: 8,
    autorestart: true,
    out_file: "$ROOT/logs/out.log",
    error_file: "$ROOT/logs/err.log",
    env: {
      PORT: "$PORT",
      HOST: "0.0.0.0",
      PUBLIC_CONTRACT_ADDRESS: "${PUBLIC_CONTRACT_ADDRESS}",
      FORGE_STATIC: "$FORGE_STATIC",
      FORGE_DB: "$FORGE_DB",
    },
  }],
};
EOF

"$PM2" delete forge-layer >/dev/null 2>&1 || true
# Reap any leftover interpreter still bound to the previous QA port.
pkill -f "$ROOT/server/main.py" >/dev/null 2>&1 || true
sleep 0.2

"$PM2" start "$ROOT/logs/ecosystem.config.cjs"

ok=0
for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    ok=1
    break
  fi
  sleep 0.25
done
if [[ "$ok" -ne 1 ]]; then
  echo "Health check failed on port ${PORT}" >&2
  "$PM2" logs forge-layer --lines 80 --nostream || true
  cat "$ROOT/logs/err.log" 2>/dev/null || true
  exit 1
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
IP="${IP:-127.0.0.1}"
echo "QA_ADDRESS=${IP}:${PORT}"
echo "${IP}:${PORT}"
