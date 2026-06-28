@echo off
echo === Nexxbit Backend Deploy ===
echo VPS: 70.40.139.10
echo.

echo [1/3] Servis durduruluyor...
ssh root@70.40.139.10 "systemctl stop nexxbit"

echo [2/3] Dosyalar yukleniyor...
scp -r "D:\UserData\Masaüstü\CriptoMoney\publish_out\." root@70.40.139.10:/var/www/nexxbit-app/

echo [3/3] Servis baslatiliyor...
ssh root@70.40.139.10 "systemctl start nexxbit && sleep 3 && systemctl status nexxbit --no-pager -l"

echo.
echo === Deploy tamamlandi ===
pause
