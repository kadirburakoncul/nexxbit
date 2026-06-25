#!/bin/bash
set -e

echo "========================================"
echo "  Nexxbit VPS Kurulum Script'i"
echo "========================================"

# Renk kodları
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

step() { echo -e "\n${GREEN}>>> $1${NC}"; }
info() { echo -e "${YELLOW}    $1${NC}"; }

# ─────────────────────────────────────────
step "1. Sistem güncelleniyor..."
apt update && apt upgrade -y
apt install -y curl wget git unzip nginx certbot python3-certbot-nginx ufw

# ─────────────────────────────────────────
step "2. .NET 10 SDK kuruluyor..."
wget -q https://packages.microsoft.com/config/ubuntu/22.04/packages-microsoft-prod.deb -O /tmp/ms-prod.deb
dpkg -i /tmp/ms-prod.deb
apt update
apt install -y dotnet-sdk-10.0
dotnet --version
info ".NET kurulumu tamamlandı"

# ─────────────────────────────────────────
step "3. Proje GitHub'dan çekiliyor..."
mkdir -p /var/www
cd /var/www

if [ -d "nexxbit" ]; then
    cd nexxbit && git pull
else
    git clone https://github.com/kadirburakoncul/nexxbit.git
    cd nexxbit
fi

# ─────────────────────────────────────────
step "4. Uygulama derleniyor ve yayınlanıyor..."
dotnet publish src/CriptoMoney.Api -c Release -o /var/www/nexxbit-app
info "Build tamamlandı"

# ─────────────────────────────────────────
step "5. Systemd servisi oluşturuluyor..."
cat > /etc/systemd/system/nexxbit.service << 'EOF'
[Unit]
Description=Nexxbit Trading API
After=network.target mysql.service

[Service]
WorkingDirectory=/var/www/nexxbit-app
ExecStart=/var/www/nexxbit-app/CriptoMoney.Api
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=nexxbit
User=root
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=ASPNETCORE_URLS=http://localhost:5050
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable nexxbit
systemctl start nexxbit
info "Servis başlatıldı"

# ─────────────────────────────────────────
step "6. Nginx yapılandırılıyor..."
cat > /etc/nginx/sites-available/nexxbit << 'EOF'
server {
    listen 80;
    server_name api.nexxbit.com.tr;

    location / {
        proxy_pass         http://localhost:5050;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/nexxbit /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
info "Nginx hazır"

# ─────────────────────────────────────────
step "7. Güvenlik duvarı ayarlanıyor..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
info "UFW aktif: SSH + HTTP/HTTPS açık"

# ─────────────────────────────────────────
step "8. SSL sertifikası alınıyor..."
info "api.nexxbit.com.tr DNS kaydı yayıldıysa sertifika alınacak..."
certbot --nginx -d api.nexxbit.com.tr \
    --non-interactive \
    --agree-tos \
    --email info.nexxbit@gmail.com \
    --redirect || info "SSL şimdilik atlandı — DNS yayılınca: certbot --nginx -d api.nexxbit.com.tr"

# ─────────────────────────────────────────
step "9. Servis durumu kontrol ediliyor..."
sleep 3
systemctl status nexxbit --no-pager -l | head -20

echo ""
echo "========================================"
echo -e "${GREEN}  Kurulum tamamlandı!${NC}"
echo "  Backend: http://70.40.139.10:5050"
echo "  API:     https://api.nexxbit.com.tr"
echo "  Loglar:  journalctl -u nexxbit -f"
echo "========================================"
