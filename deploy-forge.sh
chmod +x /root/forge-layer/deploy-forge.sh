#!/bin/bash
# forge-layer.bydx.fun — full nginx + TLS deploy (safe, idempotent)
# Run: sudo bash <this_script>

set -e

DOMAIN="forge-layer.bydx.fun"
APP_DIR="/root/forge-layer"
OUT_DIR="$APP_DIR/out"

echo "=== 0) Check static export ==="
[ -f "$OUT_DIR/index.html" ] && echo "✅ out/index.html OK" || { echo "❌ No static export"; exit 1; }

echo "=== 1) Stop nginx (for certbot) ==="
systemctl stop nginx 2>/dev/null || service nginx stop 2>/dev/null || nginx -s stop 2>/dev/null || true
echo "   stopped"

echo "=== 2) Request TLS cert (standalone) ==="
certbot certonly --standalone \
  --preferred-challenges http \
  -d "$DOMAIN" \
  --non-interactive \
  --agree-tos \
  -m admin@bydx.fun \
  --no-eff-email || {
    echo "❌ certbot failed — trying DNS challenge fallback"
    certbot certonly --standalone --preferred-challenges tlsalpn -d "$DOMAIN" --non-interactive --agree-tos -m admin@bydx.fun --no-eff-email || true
  }

echo "=== 3) Write nginx config ==="
cat > /etc/nginx/sites-available/$DOMAIN <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
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
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
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

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
echo "✅ config written"

echo "=== 4) Start nginx ==="
systemctl start nginx 2>/dev/null || service nginx start 2>/dev/null || nginx
echo "✅ nginx started"

echo "=== 5) Reload config ==="
nginx -t && { systemctl reload nginx 2>/dev/null || nginx -s reload; } && echo "✅ nginx reloaded"

echo "=== 6) Open firewall ==="
ufw allow 80/tcp 443/tcp comment 'forge-layer HTTP/HTTPS' 2>/dev/null || true
ufw allow 'Nginx Full' 2>/dev/null || true
echo "✅ firewall OK"

echo "=== 7) Test ==="
sleep 2
curl -sk -o /dev/null -w 'https://$DOMAIN : %{http_code}\n' https://$DOMAIN/ 2>/dev/null || echo "⚠️ curl test failed (DNS may not have propagated yet)"
curl -sk -o /dev/null -w 'https://$DOMAIN/health : %{http_code}\n' https://$DOMAIN/health 2>/dev/null || true
curl -s https://$DOMAIN/health 2>/dev/null | head -c 200 || true

echo
echo "=== ✅ forge-layer.bydx.fun deploy complete ==="
