#!/bin/bash
# forge-layer.bydx.fun — full nginx + TLS deploy (safe + idempotent)
# Run: sudo bash deploy-forge.sh

set -e

DOMAIN="forge-layer.bydx.fun"
APP_DIR="/root/forge-layer"
OUT_DIR="$APP_DIR/out"

echo "=== 0) Check static export ==="
[ -f "$OUT_DIR/index.html" ] && echo "OK: out/index.html" || { echo "ERROR: no static export"; exit 1; }

echo "=== 1) Stop nginx (for certbot http-01) ==="
systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || nginx -s stop 2>/dev/null || true

echo "=== 2) Request TLS cert (certbot standalone) ==="
certbot certonly --standalone \
  --preferred-challenges http \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m admin@bydx.fun \
  --no-eff-email || {
    echo "certbot standalone failed, trying tlsalpn"
    certbot certonly --standalone --preferred-challenges tlsalpn \
      -d "$DOMAIN" --non-interactive --agree-tos -m admin@bydx.fun --no-eff-email || true
  }

echo "=== 3) Write nginx upstream + vhost ==="
cat > /etc/nginx/sites-available/$DOMAIN <<'NGINXEOF'
server {
    listen 80;
    listen [::]:80;
    server_name forge-layer.bydx.fun;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name forge-layer.bydx.fun;

    ssl_certificate /etc/letsencrypt/live/forge-layer.bydx.fun/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/forge-layer.bydx.fun/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    root /root/forge-layer/out;
    index index.html;

    # Proxy API to the GenLayer studionet Python backend (localhost — zero latency)
    location /api/ {
        proxy_pass http://127.0.0.1:7392/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /config {
        proxy_pass http://127.0.0.1:7392/config;
        proxy_set_header Host $host;
    }

    location /health {
        proxy_pass http://127.0.0.1:7392/health;
        proxy_set_header Host $host;
    }

    location / {
        try_files $uri $uri/ $uri/index.html /index.html;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
echo "nginx config written"

echo "=== 4) Start nginx + open firewall ==="
systemctl start nginx 2>/dev/null || nginx
nginx -t
systemctl reload nginx 2>/dev/null || nginx -s reload || true
ufw allow 80/tcp 443/tcp 2>/dev/null || true
ufw allow 'Nginx Full' 2>/dev/null || true

echo "=== 5) Test ==="
sleep 2
echo -n 'https://forge-layer.bydx.fun           : '
curl -sk -o /dev/null -w '%{http_code}\n' https://forge-layer.bydx.fun/
echo -n 'https://forge-layer.bydx.fun/health    : '
curl -sk -o /dev/null -w '%{http_code}\n' https://forge-layer.bydx.fun/health
echo -n 'api (proxied) https://forge-layer.bydx.fun/api/stats/ : '
curl -sk -o /dev/null -w '%{http_code}\n' https://forge-layer.bydx.fun/api/stats/

echo
echo "=== DONE: https://forge-layer.bydx.fun ==="
