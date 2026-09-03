#!/bin/bash
# forge-layer.bydx.fun nginx deploy script
# Run: bash deploy-forge-layer-nginx.sh

set -e

DOMAIN="forge-layer.bydx.fun"
APP_DIR="/root/forge-layer"
OUT_DIR="$APP_DIR/out"

echo "=== 1) Check out exists ==="
if [ ! -d "$OUT_DIR" ]; then
    echo "❌ /root/forge-layer/out not found. Building..."
    cd "$APP_DIR"
    npx @genlayer/typescript@latest next build 2>/dev/null || npx next build
fi
ls "$OUT_DIR/index.html" > /dev/null && echo "✅ Static export OK" || { echo "❌ No index.html"; exit 1; }

echo "=== 2) nginx config ==="
cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\\$host\\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    root $APP_DIR/out;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:7392/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
    location /config {
        proxy_pass http://127.0.0.1:7392/config;
        proxy_set_header Host \$host;
    }
    location /health {
        proxy_pass http://127.0.0.1:7392/health;
        proxy_set_header Host \$host;
    }
    location / {
        try_files \$uri \$uri/ \$uri/index.html /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN || true
echo "✅ nginx config written"

echo "=== 3) TLS cert ==="
if [ -d /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then
    echo "✅ cert exists"
else
    echo "🔄 Requesting cert..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@bydx.fun 2>/dev/null || \
    certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos -m admin@bydx.fun
fi

echo "=== 4) nginx test + reload ==="
nginx -t
systemctl reload nginx || service nginx reload || nginx -s reload
echo "✅ nginx reloaded"

echo "=== 5) Test ==="
curl -sk -o /dev/null -w 'https://'$DOMAIN': %{http_code} (index)\n' https://$DOMAIN/ 2>/dev/null
curl -sk -o /dev/null -w 'https://'$DOMAIN'/health: %{http_code}\n' https://$DOMAIN/health 2>/dev/null

echo
echo "=== ✅ Done! forge-layer.bydx.fun is live ==="
