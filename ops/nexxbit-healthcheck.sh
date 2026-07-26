#!/bin/bash
# Nexxbit sunucu sağlık kontrolü — cron ile 5 dakikada bir çalışır.
#
# Neden var: 2026-07-23'te MySQL binlog'ları diski %100 doldurdu, MySQL çöktü ve
# sistem 3 gün fark edilmeden ölü kaldı. Açık gerçek pozisyonlar satılamadı.
# Bu script diski eşik altında tutar ve çöken servisleri geri kaldırır.

set -u
LOG=/var/log/nexxbit-health.log
DISK_WARN=80   # bu yüzdenin üstünde temizlik yap
DISK_CRIT=90   # bu yüzdenin üstünde agresif temizlik

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }

disk_pct() { df --output=pcent / | tail -1 | tr -dc '0-9'; }

USED=$(disk_pct)

# ── 1) Disk temizliği ────────────────────────────────────────────────────────
if [ "$USED" -ge "$DISK_WARN" ]; then
    log "UYARI: disk %${USED} — temizlik başlıyor"

    journalctl --vacuum-size=200M >/dev/null 2>&1

    # MySQL binlog'ları: 2 günden eskileri sil (config'de de ayarlı, bu emniyet kemeri)
    if systemctl is-active --quiet mysql; then
        mysql -e "PURGE BINARY LOGS BEFORE DATE_SUB(NOW(), INTERVAL 2 DAY);" >/dev/null 2>&1 \
            && log "binlog purge yapıldı"
    fi

    if [ "$(disk_pct)" -ge "$DISK_CRIT" ]; then
        log "KRITIK: disk hâlâ %$(disk_pct) — eski loglar siliniyor"
        find /var/log -type f -name '*.gz' -delete 2>/dev/null
        find /var/log -type f -name '*.[0-9]' -delete 2>/dev/null
        truncate -s 0 /var/log/syslog /var/log/btmp 2>/dev/null
    fi

    log "temizlik sonrası disk: %$(disk_pct)"
fi

# ── 2) Servis kontrolü ───────────────────────────────────────────────────────
for svc in mysql nexxbit; do
    if ! systemctl is-active --quiet "$svc"; then
        log "HATA: $svc çalışmıyor — yeniden başlatılıyor"
        systemctl start "$svc"
        sleep 10
        if systemctl is-active --quiet "$svc"; then
            log "$svc geri geldi"
        else
            log "KRITIK: $svc başlatılamadı!"
        fi
    fi
done

# ── 3) API erişilebilirlik kontrolü ──────────────────────────────────────────
# Servis "active" görünse de DB bağlantısı ölmüş olabilir; gerçek istekle doğrula.
CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:5050/api/coin)
# 401 = ayakta ve auth çalışıyor (beklenen). 000/5xx = sorun.
if [ "$CODE" = "000" ] || [ "${CODE:0:1}" = "5" ]; then
    log "HATA: API yanıt vermiyor (HTTP $CODE) — nexxbit yeniden başlatılıyor"
    systemctl restart nexxbit
fi
