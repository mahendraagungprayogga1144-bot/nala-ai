#!/usr/bin/env bash
# Pasang HTTPS (Caddy) di depan Traccar di VPS.
# Syarat: DNS gps.DOMAIN → IP VPS, port 80+443 terbuka, Traccar di :8082.
#
# Login SSH root, lalu:
#   DOMAIN=gps.gercepos.id bash traccar-https-setup.sh
set -euo pipefail

DOMAIN="${DOMAIN:-gps.gercepos.id}"
TRACCAR_UPSTREAM="${TRACCAR_UPSTREAM:-127.0.0.1:8082}"
EMAIL="${EMAIL:-admin@${DOMAIN#gps.}}"

echo "==> Domain : ${DOMAIN}"
echo "==> Upstream Traccar : ${TRACCAR_UPSTREAM}"
echo "==> ACME email : ${EMAIL}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker belum ada. Jalankan dulu scripts/traccar-vps-setup.sh"
  exit 1
fi

echo "==> Install Caddy (apt)"
apt-get update -y
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg

if [[ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]]; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
fi
if [[ ! -f /etc/apt/sources.list.d/caddy-stable.list ]]; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
fi
apt-get update -y
apt-get install -y caddy

echo "==> Tulis Caddyfile"
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
	encode gzip
	reverse_proxy ${TRACCAR_UPSTREAM} {
		header_up Host {host}
		header_up X-Real-IP {remote_host}
		header_up X-Forwarded-For {remote_host}
		header_up X-Forwarded-Proto {scheme}
	}
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
	}
	tls ${EMAIL}
}
EOF

echo "==> Restart Caddy"
systemctl enable caddy
systemctl restart caddy
sleep 2
systemctl --no-pager --full status caddy | head -20 || true

echo ""
echo "==> Selesai"
echo "    Buka: https://${DOMAIN}"
echo "    (port 8082 tetap bisa, tapi HP sebaiknya pakai HTTPS)"
echo ""
echo "Pastikan firewall / panel hosting buka TCP 80 dan 443."
echo "Kalau cert gagal: cek DNS A ${DOMAIN} sudah mengarah ke IP VPS ini."
