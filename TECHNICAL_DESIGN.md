# CriptoMoney — Teknik Tasarım Dokümanı

**Versiyon:** 1.0  
**Tarih:** 2026-06-22  
**Durum:** Draft  

---

## İçindekiler

1. [Proje Özeti](#1-proje-özeti)
2. [Ürün Vizyonu](#2-ürün-vizyonu)
3. [Kullanıcı Rolleri](#3-kullanıcı-rolleri)
4. [Temel Özellikler](#4-temel-özellikler)
5. [Web Uygulaması Ekranları](#5-web-uygulaması-ekranları)
6. [iOS Uygulaması Ekranları](#6-ios-uygulaması-ekranları)
7. [Sistem Mimarisi](#7-sistem-mimarisi)
8. [Backend Katman Mimarisi](#8-backend-katman-mimarisi)
9. [Veritabanı Tasarımı](#9-veritabanı-tasarımı)
10. [API Endpoint Tasarımı](#10-api-endpoint-tasarımı)
11. [Strateji Motoru Tasarımı](#11-strateji-motoru-tasarımı)
12. [İndikatör Motoru Tasarımı](#12-i̇ndikatör-motoru-tasarımı)
13. [Sinyal Üretim Sistemi](#13-sinyal-üretim-sistemi)
14. [Otomatik Trade Sistemi](#14-otomatik-trade-sistemi)
15. [Risk Yönetimi](#15-risk-yönetimi)
16. [Binance Entegrasyonu](#16-binance-entegrasyonu)
17. [Backtest Sistemi](#17-backtest-sistemi)
18. [Bildirim Sistemi](#18-bildirim-sistemi)
19. [Güvenlik Tasarımı](#19-güvenlik-tasarımı)
20. [Loglama ve Monitoring](#20-loglama-ve-monitoring)
21. [Teknik Teknoloji Önerileri](#21-teknik-teknoloji-önerileri)
22. [MVP Planı](#22-mvp-planı)
23. [Geliştirme Fazları](#23-geliştirme-fazları)
24. [Kritik Riskler](#24-kritik-riskler)
25. [Sonraki Adımlar](#25-sonraki-adımlar)

---

## 1. Proje Özeti

CriptoMoney, kullanıcıların Binance hesabını bağlayarak kripto para piyasalarını takip edebildiği, modüler teknik indikatörlere dayalı alım-satım sinyalleri üretebildiği ve isteğe bağlı olarak otomatik emirler verebildiği profesyonel bir fintech uygulamasıdır.

Sistem üç ana bileşenden oluşur:

- **Backend API** — ASP.NET Core, MSSQL, Clean Architecture
- **Web Uygulaması** — React tabanlı SPA, trader odaklı dashboard
- **iOS Mobil Uygulama** — SwiftUI native uygulama

Uygulama, gerçek para ile çalışacağı için güvenlik, risk yönetimi ve hata toleransı birinci önceliktir.

---

## 2. Ürün Vizyonu

### Hedef Kitle

| Segment | Profil |
|---|---|
| Bireysel Trader | Teknik analiz bilen, zaman kazanmak isteyen |
| Algoritmik Trader | Kendi stratejisini otomatize etmek isteyen |
| Pasif Yatırımcı | Sinyal takip eden, manuel onaylı işlem yapan |

### Temel Değer Önerileri

1. **Modüler İndikatör Sistemi** — Yeni indikatör eklemek için sadece bir sınıf yazmak yeterli, tüm sistem otomatik algılar.
2. **Puanlama Tabanlı Strateji** — Katı kural yerine ağırlıklı skor sistemi, kullanıcı eşikleri ayarlayabilir.
3. **Çok Katmanlı Risk Koruması** — İşlem öncesi, işlem sırası ve işlem sonrası risk kontrol noktaları.
4. **Şeffaf Karar Süreci** — Her sinyal için hangi indikatörün ne puan ürettiği açıkça görünür.
5. **Güvenli API Saklama** — Kullanıcı API keyleri şifreli saklanır, withdrawal yetkisi hiçbir zaman kullanılmaz.

---

## 3. Kullanıcı Rolleri

### 3.1 Admin

- Tüm kullanıcıları yönetir
- Sistem genelinde indikatör tanımlarını yönetir
- System log ve API log izler
- Kullanıcı hesaplarını aktif/pasif yapar
- Sistem ayarlarını düzenler
- Rate limit ve güvenlik konfigürasyonunu yönetir

### 3.2 Normal Kullanıcı (Trader)

- Binance API hesabını bağlar
- İzlemek istediği coinleri seçer
- Strateji oluşturur ve indikatörleri yapılandırır
- Sinyalleri takip eder
- Manuel veya otomatik trade modunu seçer
- Risk parametrelerini belirler
- Backtest çalıştırır
- Bildirim tercihlerini ayarlar

### 3.3 Kullanıcı Durumları

```
Active → Binance bağlantılı, tam yetkili
Active → Binance bağlantısız, sadece demo / sinyal izleme
Suspended → Admin tarafından askıya alınmış
Inactive → Uzun süre giriş yapılmamış
```

---

## 4. Temel Özellikler

### 4.1 Kullanıcı Yönetimi

- E-posta + şifre ile kayıt
- JWT Access Token (15 dakika) + Refresh Token (7 gün) yapısı
- Token yenileme endpoint'i
- Şifre sıfırlama (e-posta ile)
- Profil güncelleme
- Hesap silme (soft delete, 30 gün geri alınabilir)

### 4.2 Binance Entegrasyonu

- Spot API read + trade yetkisiyle API key bağlantısı
- Withdrawal yetkisi kesinlikle desteklenmeyecek
- Bağlantı testi endpoint'i
- Bakiye senkronizasyonu (periyodik + on-demand)
- Açık emir takibi
- Gerçekleşen işlem geçmişi

### 4.3 İndikatör Sistemi

- Her indikatör bir plugin gibi sisteme eklenebilir
- Aktif/pasif toggle
- İndikatör bazlı parametre yönetimi (kullanıcı özel)
- Her indikatör: Buy / Sell / Neutral + puan üretir
- Coin bazlı veya global parametre tanımı

### 4.4 Strateji Sistemi

- Puanlama tabanlı (score aggregation)
- BuyThreshold, SellThreshold, StrongSellThreshold kullanıcı tanımlı
- Coin bazlı strateji veya global strateji
- Timeframe seçimi: 5m, 15m, 1h, 4h, 1d
- EMA200 özel kural motoru (aktif/pasif)

### 4.5 Otomatik Trade

- Mod seçimi: Sadece Sinyal / Manuel Onaylı / Tam Otomatik
- Bakiye yüzdesi ile pozisyon büyüklüğü
- Stop-loss, take-profit, trailing stop
- Günlük maksimum zarar limiti
- Aynı coinde tek açık pozisyon kuralı
- Emergency stop butonu

### 4.6 Backtest

- Geçmiş mum verisi ile strateji simülasyonu
- Tüm indikatör kombinasyonları test edilebilir
- Komisyon oranı dahil gerçekçi simülasyon
- Win rate, max drawdown, Sharpe ratio çıktısı

---

## 5. Web Uygulaması Ekranları

### 5.1 Auth Ekranları

**Giriş Ekranı**
- E-posta + şifre formu
- "Beni hatırla" seçeneği
- Şifremi unuttum linki
- Kayıt ol linki
- Giriş hatalarında anlamlı mesajlar

**Kayıt Ekranı**
- Ad soyad, e-posta, şifre, şifre tekrar
- Şifre güç göstergesi
- Kullanım şartları onayı
- E-posta doğrulama akışı

**Şifre Sıfırlama**
- E-posta giriş formu
- Token ile yeni şifre belirleme ekranı

---

### 5.2 Dashboard

**Üst Bölüm — Özet Kartlar**
- Toplam portföy değeri (USDT)
- Bugünkü kar/zarar (tutar + yüzde)
- Açık pozisyon sayısı
- Son 24 saat sinyal sayısı (BUY / SELL)
- Binance bağlantı durumu (yeşil/kırmızı badge)

**Orta Bölüm — Aktif Pozisyonlar Tablosu**
- Coin adı, giriş fiyatı, mevcut fiyat, kar/zarar %, stop-loss, take-profit, süre
- Pozisyon kapat butonu
- Her satır tıklanınca position detail drawer açılır

**Alt Sol — Son Sinyaller**
- Son 10 sinyal: coin, yön (BUY/SELL), güç (skor), timeframe, zaman
- Her sinyal için indikatör breakdown'ı (hover tooltip)

**Alt Sağ — Mini Grafik**
- Seçili coinin 1h TradingView Lightweight Charts grafik bileşeni
- Sinyal noktaları grafik üzerinde işaretli

---

### 5.3 Portföy Ekranı

**Bakiye Özeti**
- USDT, BTC, BNB ve diğer varlıklar tablosu
- Her varlık: miktar, USD değeri, portföy yüzdesi
- Toplam: kullanılan bakiye + serbest bakiye
- Son güncelleme zamanı + manuel yenile butonu

**Portföy Dağılımı**
- Donut chart (varlık bazlı)
- Zaman bazlı portföy değeri çizgi grafiği (1H, 1D, 1W, 1M)

**Gerçekleşen İşlemler**
- Tablo: coin, yön, miktar, fiyat, toplam, komisyon, tarih
- Filtreleme: coin, tarih aralığı, yön
- CSV dışa aktarma

---

### 5.4 Binance Bağlantı Ekranı

**Bağlantı Durumu Kartı**
- Aktif bağlantı: yeşil, API key son 4 hanesi, son başarılı istek zamanı
- Bağlantı yok: kırmızı uyarı, bağla butonu

**API Key Ekleme Formu**
- API Key alanı (masked input)
- API Secret alanı (masked input, bir kez girilir, sonra görüntülenmez)
- Önerilen Binance izinleri listesi (Enable Reading ✓, Enable Spot & Margin Trading ✓, Withdrawal ✗)
- Bağlantıyı test et butonu
- Kaydet butonu

**Güvenlik Notu Bölümü**
- API key güvenliği hakkında bilgilendirme metni
- IP kısıtlaması önerisi (Binance API IP whitelist)
- Withdrawal izninin neden verilmemesi gerektiği açıklaması

---

### 5.5 Coin Takip Ekranı

**Coin Listesi**
- İzleme listesindeki coinler tablosu
- Her satır: coin adı/ikon, mevcut fiyat, 24h değişim %, hacim, son sinyal yönü, strateji durumu
- Aktif/pasif toggle per coin
- Coin sil
- Yeni coin ekle butonu

**Coin Ekleme Modal**
- Binance spot marketindeki coin listesi (arama özellikli)
- Seçilen coinde hangi stratejinin uygulanacağı
- Timeframe seçimi

**Coin Detay Drawer**
- Grafik (TradingView Lightweight Charts)
- Aktif indikatörler ve güncel skorları
- Açık pozisyon varsa bilgisi
- İndikatör parametrelerini bu coin için özelleştir butonu

---

### 5.6 Strateji Ayarları Ekranı

**Global Strateji Kartı**
- BuyThreshold slider (örn. +3)
- SellThreshold slider (örn. -3)
- StrongSellThreshold slider (örn. -6)
- Varsayılan timeframe seçici
- Kaydet butonu

**Coin Bazlı Strateji Tablosu**
- Hangi coinlerde özel strateji tanımlı olduğu listesi
- Her satır: coin, özel eşikler, timeframe
- Düzenle / Sil

**EMA200 Özel Kural Kartı**
- Aktif/pasif toggle
- MinCandlesAfterCross parametresi (varsayılan: 2)
- MaxCandlesAfterCross parametresi (varsayılan: 5)
- Timeframe seçimi (varsayılan: 15m)
- Açıklama metni (bu kural aktifken ne anlama gelir)

---

### 5.7 İndikatör Aç/Kapat Ekranı

**İndikatör Listesi (Kart grid)**
Her kart:
- İndikatör adı + kısa açıklama
- Aktif/pasif toggle
- Varsayılan ağırlık/puan katkısı
- Parametre ayarla linki
- Güncel durumu (kaç coin üzerinde aktif hesaplama)

**İndikatör Filtreleme**
- Trend / Oscillator / Volume / Custom kategorilere göre filtre

---

### 5.8 İndikatör Parametre Ekranı

**Seçilen İndikatör Başlığı**
- Adı, kategorisi, kısa açıklaması

**Global Parametreler Bölümü**
- Her parametre için: label, input (number/select), varsayılan değer, açıklama tooltip
- Kaydet / Varsayılanlara sıfırla

**Coin Bazlı Parametre Override Bölümü**
- Hangi coinlerde özel parametre tanımlı (liste)
- Yeni coin için özel parametre ekle
- Her coin için ayrı parametre formu

---

### 5.9 Sinyal Geçmişi Ekranı

**Sinyal Tablosu**
- Sütunlar: Zaman, Coin, Yön, Skor, Timeframe, Strateji, Eylem
- Eylem: BUY / SELL / HOLD
- Renk kodlaması: yeşil=BUY, kırmızı=SELL, gri=HOLD
- Filtreleme: coin, yön, timeframe, tarih aralığı
- Sayfalama

**Sinyal Detay Drawer**
- Açılış fiyatı, sinyal zamanı
- İndikatör breakdown tablosu: her indikatör, ürettiği değer, puan katkısı
- Grafik: sinyal anındaki mum + indikatör overlay
- İlişkili emir var mı (varsa emir ID'sine link)

---

### 5.10 İşlem Geçmişi Ekranı

**Emir Geçmişi Tablosu**
- Emir ID, coin, yön, tip (market/limit), miktar, fiyat, toplam, durum, tarih
- Durum: Filled / Cancelled / Partially Filled
- Binance emir ID ile çapraz referans
- Filtreleme + CSV export

---

### 5.11 Açık Pozisyonlar Ekranı

**Pozisyon Listesi**
- Her pozisyon kartı:
  - Coin + giriş fiyatı + giriş zamanı
  - Mevcut fiyat (gerçek zamanlı)
  - Kar/zarar: tutar + %
  - Stop-loss seviyesi + Take-profit seviyesi
  - Trailing stop aktifse trailing mesafesi
  - Manuel kapat butonu
  - Stop-loss güncelle butonu

**Kapat Dialog**
- Piyasa fiyatından kapat
- Limit fiyat ile kapat
- Onay adımı (gerçek para uyarısı)

---

### 5.12 Backtest Ekranı

**Backtest Konfigürasyon Formu**
- Coin seçimi (çoklu)
- Tarih aralığı (date picker)
- Timeframe seçimi
- İndikatör kombinasyonu seçimi (checkbox listesi)
- İndikatör parametreleri (özel override imkânı)
- Başlangıç sermayesi (USDT)
- Komisyon oranı (örn. %0.1)
- Stop-loss %, Take-profit %
- Strateji eşikleri
- EMA200 kuralı aktif mi?
- Çalıştır butonu

**Backtest Sonuç Ekranı**
- Özet kartlar: Net kar/zarar, Win rate, Toplam işlem sayısı, Max drawdown, Sharpe ratio
- Equity curve grafiği (sermaye zaman içinde)
- Grafik üzerinde BUY/SELL noktaları
- İşlem listesi tablosu (açılış, kapanış, kar/zarar)
- İndikatör katkı analizi
- Karşılaştırma: buy & hold vs strateji

---

### 5.13 Canlı Trade Ekranı

**Manuel Trade Paneli**
- Coin seçici
- BUY / SELL tab
- Market / Limit seçimi
- Miktar girişi (USDT veya coin cinsinden)
- Stop-loss, take-profit alanları
- Özet: tahmini komisyon, net miktar
- Emir gönder butonu (onay dialog'u ile)

**Aktif Emirler Widget**
- Gönderilmiş ama henüz dolmamış emirler
- İptal et butonu

**Sinyal Bazlı Öneriler**
- Aktif sinyallerin önerdiği işlemler (kullanıcı onayı gerekiyor)
- Her öneri için: neden öneriliyor (indikatör breakdown), onayla / reddet

---

### 5.14 Risk Yönetimi Ekranı

- Maksimum günlük zarar limiti (USDT veya %)
- Toplam açık pozisyon limiti (adet)
- Coin başına maksimum pozisyon büyüklüğü (USDT veya %)
- Stop-loss zorunlu mu? (toggle)
- Trailing stop varsayılan mesafesi
- Bağlantı kopukluğunda pozisyonları kapat (toggle)
- Emergency stop butonu (tüm pozisyonları anında kapat)
- Günlük zarar limitine ulaşınca oto durdur (toggle)

---

### 5.15 Admin Paneli

**Kullanıcı Yönetimi**
- Kullanıcı listesi (arama, filtre)
- Kullanıcı detay: bilgiler, Binance bağlantı durumu, son giriş
- Aktif/pasif yap, sil

**İndikatör Yönetimi**
- Sistemde tanımlı indikatörlerin listesi
- Yeni indikatör tanımı ekleme (admin UI)
- İndikatörü sistemden kaldırma

**Sistem Durumu**
- Background job durumları
- Binance API sağlık durumu
- Son hata logları
- Aktif WebSocket bağlantı sayısı

**Sistem Logları**
- Kritik hata logları (filtreli, sayfalanmış)
- API istek logları
- Trade karar logları

---

### 5.16 Log Ekranı (Admin)

- Log seviyesi filtresi: Error, Warning, Info, Debug
- Tarih aralığı filtresi
- Kaynak filtresi: StrategyEngine, OrderExecution, BinanceClient, vb.
- Kullanıcı filtresi
- Gerçek zamanlı log akışı (SignalR)
- Log satırı detay görünümü (stack trace, context)

---

### 5.17 Kullanıcı Ayarları Ekranı

- Profil bilgileri güncelleme
- Şifre değiştirme
- E-posta bildirim tercihleri
- Push notification tercihleri
- Uygulama dili (TR/EN)
- Zaman dilimi seçimi
- Hesabı sil

---

## 6. iOS Uygulaması Ekranları

iOS uygulama SwiftUI ile geliştirilecek. Aynı backend API'yi kullanır. Tasarım dili: dark mode öncelikli, terminal/trading odaklı kompakt layout.

### 6.1 Giriş / Kayıt

**Splash Screen**
- Logo animasyonu, versiyon numarası

**Giriş Ekranı**
- E-posta + şifre
- Face ID / Touch ID ile hızlı giriş (Keychain entegrasyonu)
- Kayıt ol butonu

**Kayıt Ekranı**
- Ad, e-posta, şifre
- Adım adım form (stepper)

---

### 6.2 Ana Tab Bar Yapısı

```
[ Dashboard ] [ Sinyaller ] [ Pozisyonlar ] [ Keşfet ] [ Ayarlar ]
```

---

### 6.3 Dashboard Tab

**Üst Section — Portföy Özeti Kartı**
- Toplam portföy değeri büyük font
- Bugünkü değişim (renk kodlu)
- Binance bağlantı badge'i

**Orta Section — Aktif Pozisyonlar Yatay Scroll**
- Her kart: coin ikon, giriş/mevcut fiyat, kar/zarar %, süre

**Alt Section — Son 5 Sinyal**
- Compact liste: coin, yön, güç, zaman

---

### 6.4 Sinyaller Tab

**Sinyal Listesi**
- GroupBy: Bugün / Dün / Bu Hafta
- Her hücre: coin, yön (renk), skor, timeframe, zaman
- Pull-to-refresh

**Sinyal Detay Ekranı (push)**
- İndikatör breakdown listesi
- Mini grafik
- Pozisyon aç butonu (manuel mod aktifse)
- "Bu sinyale göre otomatik işlem yap" toggle

**Filtre Modal**
- Coin, yön, timeframe, tarih filtreleri

---

### 6.5 Pozisyonlar Tab

**Aktif Pozisyonlar Listesi**
- Her hücre: coin, kar/zarar %, mevcut fiyat (canlı)
- Swipe-left: Pozisyonu Kapat

**Pozisyon Detay Ekranı**
- Giriş bilgileri, SL/TP seviyeleri
- Grafik (mini)
- SL/TP güncelle
- Kapat (market / limit seçimli)

---

### 6.6 Keşfet Tab

**Coin Arama**
- Binance spot listesinde arama
- Coin detay: fiyat, 24h değişim, hacim

**İzleme Listesi Yönetimi**
- Takip edilen coinler
- Ekle / çıkar

---

### 6.7 Ayarlar Tab

**Bölümler:**
- Binance Bağlantısı (durum + yönet)
- Strateji Ayarları
- İndikatör Aç/Kapat (compact toggle listesi)
- Risk Ayarları
- Bildirim Tercihleri
- Hesap Güvenliği
- Uygulama Hakkında

---

### 6.8 Bildirimler

**Bildirim Merkezi Ekranı**
- Okundu / okunmadı ayrımı
- Tür ikon: BUY sinyali, SELL sinyali, SL tetiklendi, TP tetiklendi, emir gerçekleşti, hata
- Bildirime tıklayınca ilgili ekrana deep link

**Bildirim Tercihleri**
- Her bildirim türü için ayrı toggle
- Sessiz saatler ayarı

---

### 6.9 Manuel Al/Sat Onayı

Bu ekran, manuel onaylı modda sinyal gelince push notification üzerinden veya app içinden açılır.

- Coin bilgisi, sinyal yönü, öneri fiyat
- Miktar girişi (USDT)
- Stop-loss, take-profit input
- Onay butonu (büyük, yeşil/kırmızı)
- Reddet butonu
- İndikatör breakdown accordion

---

## 7. Sistem Mimarisi

### 7.1 Genel Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                        │
│  React Web App (SPA)          iOS SwiftUI App               │
└──────────────┬──────────────────────────┬───────────────────┘
               │ HTTPS / JWT              │ HTTPS / JWT
               │                          │
┌──────────────▼──────────────────────────▼───────────────────┐
│                    API GATEWAY (ASP.NET Core)                │
│   Rate Limiting │ Auth Middleware │ Logging │ CORS           │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
  ┌───────────┐   ┌──────────────┐  ┌──────────────┐
  │ Auth API  │   │  Trade API   │  │  Admin API   │
  └───────────┘   └──────────────┘  └──────────────┘
          │               │
          └───────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  StrategyEngine │ IndicatorEngine │ SignalEngine             │
│  OrderEngine    │ RiskEngine      │ BacktestEngine           │
│  NotificationEngine               │ BackgroundJobService     │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                       │
│  BinanceRestClient │ BinanceWebSocketClient                  │
│  EmailService      │ PushNotificationService                 │
│  CacheService (Redis) │ EncryptionService                    │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   PERSISTENCE LAYER                          │
│  EF Core Repository │ MSSQL │ Redis Cache                   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Gerçek Zamanlı Veri Akışı

```
Binance WebSocket (Market Data)
        │
        ▼
 WebSocket Manager (per coin subscription)
        │
        ▼
 Candle Buffer (son N mum bellekte)
        │
        ▼
 Indicator Engine (hesaplama)
        │
        ▼
 Signal Engine (puan + karar)
        │
   ┌────┴──────────┐
   ▼               ▼
SignalR Hub    Order Engine
(web/mobile    (otomatik mod)
 push)
```

---

## 8. Backend Katman Mimarisi

### 8.1 Clean Architecture Katmanları

```
CriptoMoney.sln
├── src/
│   ├── CriptoMoney.Domain/           ← Core entities, value objects, domain events
│   ├── CriptoMoney.Application/      ← Use cases, interfaces, DTOs, validators
│   ├── CriptoMoney.Infrastructure/   ← Binance client, email, push, encryption, cache
│   ├── CriptoMoney.Persistence/      ← EF Core DbContext, repositories, migrations
│   ├── CriptoMoney.BackgroundJobs/   ← Hangfire jobs, WebSocket workers
│   └── CriptoMoney.Api/              ← Controllers, middleware, SignalR hubs
└── tests/
    ├── CriptoMoney.Domain.Tests/
    ├── CriptoMoney.Application.Tests/
    └── CriptoMoney.Integration.Tests/
```

### 8.2 Domain Katmanı

Sadece saf C# sınıfları. Framework bağımlılığı yok.

**Domain Entities:**
- `User`, `UserBinanceAccount`, `UserRiskSettings`
- `Coin`, `CandleData`, `BalanceSnapshot`
- `Indicator`, `IndicatorParameter`, `UserIndicatorSetting`
- `UserStrategy`, `StrategyIndicator`
- `TradeSignal`, `TradeOrder`, `Position`, `PositionHistory`
- `BacktestRun`, `BacktestTrade`
- `Notification`, `SystemLog`, `ApiRequestLog`

**Domain Value Objects:**
- `Money(amount, currency)`
- `PriceLevel(value, type: SL/TP)`
- `SignalDirection(BUY/SELL/HOLD)`
- `Timeframe(5m/15m/1h/4h/1d)`

**Domain Events (ileride Event Sourcing'e açık kapı):**
- `SignalGeneratedEvent`
- `OrderExecutedEvent`
- `PositionClosedEvent`
- `RiskLimitBreachedEvent`

### 8.3 Application Katmanı

**Use Cases (CQRS pattern — MediatR):**

Queries:
- `GetDashboardSummaryQuery`
- `GetActivePositionsQuery`
- `GetSignalHistoryQuery`
- `GetBacktestResultQuery`
- ...

Commands:
- `CreateUserCommand`
- `LinkBinanceAccountCommand`
- `UpdateStrategyCommand`
- `ExecuteManualOrderCommand`
- `RunBacktestCommand`
- ...

**Interfaces (Infrastructure'a bağımlılığı tersine çevirir):**
- `IBinanceRestClient`
- `IBinanceWebSocketClient`
- `IIndicatorEngine`
- `IStrategyEngine`
- `ISignalEngine`
- `IOrderExecutionEngine`
- `IRiskEngine`
- `INotificationService`
- `IEncryptionService`
- `ICacheService`

### 8.4 Infrastructure Katmanı

- `BinanceRestClient` — Binance.Net kütüphanesi üzerinde wrapper
- `BinanceWebSocketClient` — mum ve ticker stream yönetimi
- `AesEncryptionService` — AES-256 ile API key şifreleme
- `RedisCache` — StackExchange.Redis
- `FirebasePushNotificationService` — iOS push (FCM/APNs)
- `SmtpEmailService` — e-posta bildirimi
- `HangfireJobScheduler` — background job tanımları

### 8.5 Persistence Katmanı

- `AppDbContext` (EF Core)
- Repository implementations (generic + özelleştirilmiş)
- `IUnitOfWork`
- EF Core migrations
- Seed data (admin kullanıcısı, temel indikatör tanımları)

### 8.6 BackgroundJobs Katmanı

| Job | Periyot | Açıklama |
|---|---|---|
| `CandleSyncJob` | Her mum kapanışında | Geçmiş mum verisi senkronizasyonu |
| `StrategyEvaluationJob` | Her mum kapanışında | Aktif strateji değerlendirmesi |
| `OrderStatusSyncJob` | Her 30 saniyede | Açık emirlerin durumunu Binance'den günceller |
| `BalanceSnapshotJob` | Her saatte | Kullanıcı bakiyesi snapshot |
| `DailyRiskResetJob` | Gece 00:00 | Günlük zarar limitini sıfırlar |
| `CleanupJob` | Günlük | Eski log ve cache temizliği |
| `HealthCheckJob` | Her 5 dakikada | Binance API sağlık kontrolü |

### 8.7 Background Job Mimarisi

**Hangfire** tercih edilecek:
- SQL Server storage (ek veritabanı gerekmez)
- Dashboard UI
- Retry mekanizması dahili
- Recurring + fire-and-forget + delayed job desteği
- ASP.NET Core ile sıfır konfigürasyonlu entegrasyon

**Quartz.NET yerine Hangfire neden:**
- SQL Server zaten var, ek altyapı yok
- Dashboard görselliği geliştiriciye fayda sağlar
- Retry + dead letter queue dahili
- Basit API

---

## 9. Veritabanı Tasarımı

### 9.1 Users

```sql
Users
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK, DEFAULT NEWSEQUENTIALID()
Email           NVARCHAR(256)       NOT NULL, UNIQUE
PasswordHash    NVARCHAR(512)       NOT NULL
FirstName       NVARCHAR(100)       NOT NULL
LastName        NVARCHAR(100)       NOT NULL
Role            TINYINT             NOT NULL  -- 0=Admin, 1=User
IsEmailVerified BIT                 NOT NULL DEFAULT 0
EmailVerifyToken NVARCHAR(256)      NULL
RefreshToken    NVARCHAR(512)       NULL
RefreshTokenExpiry DATETIME2        NULL
LastLoginAt     DATETIME2           NULL
IsActive        BIT                 NOT NULL DEFAULT 1
IsDeleted       BIT                 NOT NULL DEFAULT 0
DeletedAt       DATETIME2           NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_Users_Email (Email)
INDEX IX_Users_IsActive_IsDeleted (IsActive, IsDeleted)
```

### 9.2 UserBinanceAccounts

```sql
UserBinanceAccounts
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
ApiKeyEncrypted NVARCHAR(1024)      NOT NULL      -- AES-256 şifreli
ApiSecretEncrypted NVARCHAR(1024)   NOT NULL      -- AES-256 şifreli
ApiKeyHint      NVARCHAR(10)        NOT NULL      -- Son 4 karakter (görüntüleme için)
IsActive        BIT                 NOT NULL DEFAULT 1
IsTestnet       BIT                 NOT NULL DEFAULT 0
LastConnectionAt DATETIME2          NULL
LastConnectionStatus NVARCHAR(100)  NULL
ConnectionErrorMessage NVARCHAR(500) NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

UNIQUE UQ_UserBinanceAccounts_UserId (UserId)   -- kullanıcı başına 1 hesap
INDEX IX_UserBinanceAccounts_UserId (UserId)
```

### 9.3 Coins

```sql
Coins
─────────────────────────────────────────────────────
Id              INT                 PK IDENTITY
Symbol          NVARCHAR(20)        NOT NULL UNIQUE  -- BTCUSDT
BaseAsset       NVARCHAR(10)        NOT NULL          -- BTC
QuoteAsset      NVARCHAR(10)        NOT NULL          -- USDT
DisplayName     NVARCHAR(50)        NOT NULL
IsActive        BIT                 NOT NULL DEFAULT 1
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_Coins_Symbol (Symbol)
INDEX IX_Coins_IsActive (IsActive)
```

### 9.4 UserWatchlist

```sql
UserWatchlist
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
CoinId          INT                 FK → Coins.Id
IsActive        BIT                 NOT NULL DEFAULT 1
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

UNIQUE UQ_UserWatchlist_UserId_CoinId (UserId, CoinId)
INDEX IX_UserWatchlist_UserId (UserId)
```

### 9.5 CandleData

```sql
CandleData
─────────────────────────────────────────────────────
Id              BIGINT              PK IDENTITY
CoinId          INT                 FK → Coins.Id
Timeframe       NVARCHAR(5)         NOT NULL  -- '5m','15m','1h','4h','1d'
OpenTime        DATETIME2           NOT NULL
CloseTime       DATETIME2           NOT NULL
Open            DECIMAL(28,8)       NOT NULL
High            DECIMAL(28,8)       NOT NULL
Low             DECIMAL(28,8)       NOT NULL
Close           DECIMAL(28,8)       NOT NULL
Volume          DECIMAL(28,8)       NOT NULL
QuoteVolume     DECIMAL(28,8)       NOT NULL
TradeCount      INT                 NOT NULL
IsClosed        BIT                 NOT NULL DEFAULT 1

UNIQUE UQ_CandleData_Coin_Timeframe_OpenTime (CoinId, Timeframe, OpenTime)
INDEX IX_CandleData_CoinId_Timeframe_OpenTime (CoinId, Timeframe, OpenTime DESC)

-- NOT: Bu tablo büyük büyüyecek. Partition by Timeframe + CoinId değerlendirilmeli.
-- Alternatif: TimescaleDB benzeri zaman serisi yaklaşımı (MSSQL'de partitioned view)
```

### 9.6 Indicators

```sql
Indicators
─────────────────────────────────────────────────────
Id              INT                 PK IDENTITY
Name            NVARCHAR(100)       NOT NULL UNIQUE   -- 'Tillson', 'EMA200'
DisplayName     NVARCHAR(200)       NOT NULL
Description     NVARCHAR(1000)      NULL
Category        NVARCHAR(50)        NOT NULL           -- 'Trend','Oscillator','Volume','Custom'
ClassName       NVARCHAR(300)       NOT NULL           -- full qualified class name
DefaultWeight   DECIMAL(5,2)        NOT NULL DEFAULT 1.0
IsSystemDefault BIT                 NOT NULL DEFAULT 0
IsActive        BIT                 NOT NULL DEFAULT 1
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_Indicators_IsActive (IsActive)
```

### 9.7 IndicatorParameterDefinitions

```sql
IndicatorParameterDefinitions
─────────────────────────────────────────────────────
Id              INT                 PK IDENTITY
IndicatorId     INT                 FK → Indicators.Id
ParameterKey    NVARCHAR(100)       NOT NULL   -- 'Period', 'Factor'
DisplayName     NVARCHAR(200)       NOT NULL
DataType        NVARCHAR(20)        NOT NULL   -- 'int','decimal','bool','select'
DefaultValue    NVARCHAR(500)       NOT NULL
MinValue        NVARCHAR(100)       NULL
MaxValue        NVARCHAR(100)       NULL
SelectOptions   NVARCHAR(MAX)       NULL       -- JSON array for select type
SortOrder       INT                 NOT NULL DEFAULT 0

UNIQUE UQ_IndParamDef_IndicatorId_Key (IndicatorId, ParameterKey)
```

### 9.8 UserIndicatorSettings

```sql
UserIndicatorSettings
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
IndicatorId     INT                 FK → Indicators.Id
CoinId          INT                 FK → Coins.Id    NULL = global
IsEnabled       BIT                 NOT NULL DEFAULT 1
Weight          DECIMAL(5,2)        NOT NULL DEFAULT 1.0
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

UNIQUE UQ_UserIndSettings_User_Ind_Coin (UserId, IndicatorId, CoinId)
INDEX IX_UserIndSettings_UserId (UserId)
```

### 9.9 UserIndicatorParameterValues

```sql
UserIndicatorParameterValues
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserIndicatorSettingId UNIQUEIDENTIFIER FK → UserIndicatorSettings.Id
ParameterDefinitionId INT           FK → IndicatorParameterDefinitions.Id
Value           NVARCHAR(500)       NOT NULL

UNIQUE UQ_UserIndParamVal_Setting_Def (UserIndicatorSettingId, ParameterDefinitionId)
```

### 9.10 UserStrategies

```sql
UserStrategies
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
CoinId          INT                 FK → Coins.Id    NULL = global
Name            NVARCHAR(200)       NOT NULL
Timeframe       NVARCHAR(5)         NOT NULL
BuyThreshold    DECIMAL(8,2)        NOT NULL DEFAULT 3.0
SellThreshold   DECIMAL(8,2)        NOT NULL DEFAULT -3.0
StrongSellThreshold DECIMAL(8,2)   NOT NULL DEFAULT -6.0
IsEma200RuleEnabled BIT            NOT NULL DEFAULT 0
Ema200MinCandles INT                NOT NULL DEFAULT 2
Ema200MaxCandles INT                NOT NULL DEFAULT 5
Ema200Timeframe NVARCHAR(5)        NOT NULL DEFAULT '15m'
IsActive        BIT                 NOT NULL DEFAULT 1
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_UserStrategies_UserId (UserId)
INDEX IX_UserStrategies_UserId_CoinId (UserId, CoinId)
```

### 9.11 TradeSignals

```sql
TradeSignals
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK DEFAULT NEWSEQUENTIALID()
UserId          UNIQUEIDENTIFIER    FK → Users.Id
CoinId          INT                 FK → Coins.Id
StrategyId      UNIQUEIDENTIFIER    FK → UserStrategies.Id
Timeframe       NVARCHAR(5)         NOT NULL
Direction       TINYINT             NOT NULL   -- 0=HOLD, 1=BUY, 2=SELL, 3=STRONG_SELL
TotalScore      DECIMAL(8,2)        NOT NULL
CandleTime      DATETIME2           NOT NULL   -- Sinyalin üretildiği mum zamanı
Price           DECIMAL(28,8)       NOT NULL   -- O andaki fiyat
IndicatorScores NVARCHAR(MAX)       NOT NULL   -- JSON: [{indicatorId, value, score}]
IsActedUpon     BIT                 NOT NULL DEFAULT 0
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_TradeSignals_UserId_CreatedAt (UserId, CreatedAt DESC)
INDEX IX_TradeSignals_UserId_CoinId (UserId, CoinId)
INDEX IX_TradeSignals_Direction (Direction)
```

### 9.12 TradeOrders

```sql
TradeOrders
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
CoinId          INT                 FK → Coins.Id
SignalId        UNIQUEIDENTIFIER    FK → TradeSignals.Id  NULL (manuel)
BinanceOrderId  BIGINT              NULL
ClientOrderId   NVARCHAR(100)       NULL
Side            TINYINT             NOT NULL   -- 0=BUY, 1=SELL
Type            TINYINT             NOT NULL   -- 0=MARKET, 1=LIMIT, 2=STOP_MARKET
Status          TINYINT             NOT NULL   -- 0=Pending, 1=Open, 2=Filled, 3=Cancelled, 4=Rejected
Quantity        DECIMAL(28,8)       NOT NULL
Price           DECIMAL(28,8)       NULL       -- null=market
FilledQuantity  DECIMAL(28,8)       NULL
FilledPrice     DECIMAL(28,8)       NULL       -- average fill price
Commission      DECIMAL(28,8)       NULL
CommissionAsset NVARCHAR(10)        NULL
IsAutomatic     BIT                 NOT NULL DEFAULT 0
ErrorMessage    NVARCHAR(1000)      NULL
BinanceCreatedAt DATETIME2          NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_TradeOrders_UserId_CreatedAt (UserId, CreatedAt DESC)
INDEX IX_TradeOrders_BinanceOrderId (BinanceOrderId)
INDEX IX_TradeOrders_Status (Status)
INDEX IX_TradeOrders_UserId_CoinId_Status (UserId, CoinId, Status)
```

### 9.13 Positions

```sql
Positions
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
CoinId          INT                 FK → Coins.Id
EntryOrderId    UNIQUEIDENTIFIER    FK → TradeOrders.Id
EntryPrice      DECIMAL(28,8)       NOT NULL
EntryQuantity   DECIMAL(28,8)       NOT NULL
EntryValueUsdt  DECIMAL(28,8)       NOT NULL
StopLossPrice   DECIMAL(28,8)       NULL
TakeProfitPrice DECIMAL(28,8)       NULL
TrailingStopPct DECIMAL(5,2)        NULL
TrailingStopHighWatermark DECIMAL(28,8) NULL
Status          TINYINT             NOT NULL  -- 0=Open, 1=Closed, 2=StoppedOut, 3=TakenProfit
CloseOrderId    UNIQUEIDENTIFIER    FK → TradeOrders.Id   NULL
ClosePrice      DECIMAL(28,8)       NULL
CloseValueUsdt  DECIMAL(28,8)       NULL
RealizedPnl     DECIMAL(28,8)       NULL
RealizedPnlPct  DECIMAL(8,4)        NULL
OpenedAt        DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
ClosedAt        DATETIME2           NULL
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_Positions_UserId_Status (UserId, Status)
INDEX IX_Positions_UserId_CoinId_Status (UserId, CoinId, Status)
```

### 9.14 UserRiskSettings

```sql
UserRiskSettings
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id  UNIQUE
TradeMode       TINYINT             NOT NULL  -- 0=SignalOnly, 1=ManualApproval, 2=FullAuto
MaxDailyLossUsdt DECIMAL(28,8)      NULL
MaxDailyLossPct DECIMAL(5,2)        NULL
MaxOpenPositions INT                NOT NULL DEFAULT 5
MaxPositionSizeUsdt DECIMAL(28,8)   NULL
MaxPositionSizePct DECIMAL(5,2)     NULL DEFAULT 10.0
DefaultStopLossPct DECIMAL(5,2)     NULL
DefaultTakeProfitPct DECIMAL(5,2)   NULL
IsStopLossRequired BIT              NOT NULL DEFAULT 1
CloseOnDisconnect BIT               NOT NULL DEFAULT 1
IsAutoTradeEnabled BIT              NOT NULL DEFAULT 0
AllowedCoinIds  NVARCHAR(MAX)       NULL  -- JSON array of CoinId (whitelist, null=all)
BlockedCoinIds  NVARCHAR(MAX)       NULL  -- JSON array of CoinId (blacklist)
DailyLossUsedUsdt DECIMAL(28,8)     NOT NULL DEFAULT 0
DailyLossResetAt DATETIME2          NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
UpdatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

UNIQUE UQ_UserRiskSettings_UserId (UserId)
```

### 9.15 BacktestRuns

```sql
BacktestRuns
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK
UserId          UNIQUEIDENTIFIER    FK → Users.Id
Name            NVARCHAR(200)       NULL
CoinIds         NVARCHAR(MAX)       NOT NULL  -- JSON array
Timeframe       NVARCHAR(5)         NOT NULL
StartDate       DATETIME2           NOT NULL
EndDate         DATETIME2           NOT NULL
InitialCapital  DECIMAL(28,8)       NOT NULL
CommissionRate  DECIMAL(5,4)        NOT NULL DEFAULT 0.001
StopLossPct     DECIMAL(5,2)        NULL
TakeProfitPct   DECIMAL(5,2)        NULL
StrategyConfig  NVARCHAR(MAX)       NOT NULL  -- JSON (thresholds, indicator params)
Status          TINYINT             NOT NULL  -- 0=Pending, 1=Running, 2=Completed, 3=Failed
FinalCapital    DECIMAL(28,8)       NULL
NetPnl          DECIMAL(28,8)       NULL
NetPnlPct       DECIMAL(8,4)        NULL
WinRate         DECIMAL(5,4)        NULL
TotalTrades     INT                 NULL
WinningTrades   INT                 NULL
MaxDrawdown     DECIMAL(8,4)        NULL
SharpeRatio     DECIMAL(8,4)        NULL
ErrorMessage    NVARCHAR(1000)      NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()
CompletedAt     DATETIME2           NULL

INDEX IX_BacktestRuns_UserId_CreatedAt (UserId, CreatedAt DESC)
```

### 9.16 BacktestTrades

```sql
BacktestTrades
─────────────────────────────────────────────────────
Id              BIGINT              PK IDENTITY
BacktestRunId   UNIQUEIDENTIFIER    FK → BacktestRuns.Id
CoinId          INT                 FK → Coins.Id
Side            TINYINT             NOT NULL
EntryTime       DATETIME2           NOT NULL
EntryPrice      DECIMAL(28,8)       NOT NULL
ExitTime        DATETIME2           NULL
ExitPrice       DECIMAL(28,8)       NULL
ExitReason      TINYINT             NULL  -- 0=Signal, 1=SL, 2=TP, 3=EndOfData
Quantity        DECIMAL(28,8)       NOT NULL
Commission      DECIMAL(28,8)       NOT NULL
PnlUsdt         DECIMAL(28,8)       NULL
PnlPct          DECIMAL(8,4)        NULL
EntryScore      DECIMAL(8,2)        NULL
IndicatorScores NVARCHAR(MAX)       NULL  -- JSON

INDEX IX_BacktestTrades_BacktestRunId (BacktestRunId)
```

### 9.17 Notifications

```sql
Notifications
─────────────────────────────────────────────────────
Id              UNIQUEIDENTIFIER    PK DEFAULT NEWSEQUENTIALID()
UserId          UNIQUEIDENTIFIER    FK → Users.Id
Type            TINYINT             NOT NULL
-- 0=BuySignal, 1=SellSignal, 2=StopLoss, 3=TakeProfit,
-- 4=OrderFilled, 5=BinanceError, 6=DailyReport, 7=RiskAlert
Title           NVARCHAR(200)       NOT NULL
Body            NVARCHAR(1000)      NOT NULL
Payload         NVARCHAR(MAX)       NULL  -- JSON (deep link data, coin id vb.)
Channel         TINYINT             NOT NULL  -- 0=Push, 1=Email, 2=InApp
IsRead          BIT                 NOT NULL DEFAULT 0
IsSent          BIT                 NOT NULL DEFAULT 0
SentAt          DATETIME2           NULL
ReadAt          DATETIME2           NULL
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_Notifications_UserId_IsRead_CreatedAt (UserId, IsRead, CreatedAt DESC)
INDEX IX_Notifications_IsSent (IsSent) WHERE IsSent = 0
```

### 9.18 BalanceSnapshots

```sql
BalanceSnapshots
─────────────────────────────────────────────────────
Id              BIGINT              PK IDENTITY
UserId          UNIQUEIDENTIFIER    FK → Users.Id
TotalValueUsdt  DECIMAL(28,8)       NOT NULL
Assets          NVARCHAR(MAX)       NOT NULL  -- JSON [{asset, free, locked, valueUsdt}]
SnapshotAt      DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_BalanceSnapshots_UserId_SnapshotAt (UserId, SnapshotAt DESC)
```

### 9.19 SystemLogs

```sql
SystemLogs
─────────────────────────────────────────────────────
Id              BIGINT              PK IDENTITY
Level           TINYINT             NOT NULL  -- 0=Debug, 1=Info, 2=Warning, 3=Error, 4=Critical
Source          NVARCHAR(200)       NOT NULL  -- 'StrategyEngine', 'OrderExecution', ...
Message         NVARCHAR(MAX)       NOT NULL
Exception       NVARCHAR(MAX)       NULL
UserId          UNIQUEIDENTIFIER    NULL      -- ilgili kullanıcı varsa
CorrelationId   NVARCHAR(100)       NULL
Context         NVARCHAR(MAX)       NULL      -- JSON additional context
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_SystemLogs_Level_CreatedAt (Level, CreatedAt DESC)
INDEX IX_SystemLogs_Source_CreatedAt (Source, CreatedAt DESC)
INDEX IX_SystemLogs_UserId (UserId) WHERE UserId IS NOT NULL
-- 30 günden eski loglar temizlenecek (CleanupJob)
```

### 9.20 ApiRequestLogs

```sql
ApiRequestLogs
─────────────────────────────────────────────────────
Id              BIGINT              PK IDENTITY
UserId          UNIQUEIDENTIFIER    NULL
HttpMethod      NVARCHAR(10)        NOT NULL
Path            NVARCHAR(500)       NOT NULL
StatusCode      INT                 NOT NULL
DurationMs      INT                 NOT NULL
IpAddress       NVARCHAR(50)        NULL
UserAgent       NVARCHAR(500)       NULL
RequestBody     NVARCHAR(MAX)       NULL  -- Hassas alanlar maskelenir
ResponseBody    NVARCHAR(MAX)       NULL  -- Hata durumunda kaydedilir
CreatedAt       DATETIME2           NOT NULL DEFAULT SYSUTCDATETIME()

INDEX IX_ApiRequestLogs_UserId_CreatedAt (UserId, CreatedAt DESC)
INDEX IX_ApiRequestLogs_StatusCode (StatusCode) WHERE StatusCode >= 400
-- 7 günden eski kayıtlar temizlenecek
```

---

## 10. API Endpoint Tasarımı

### 10.1 Auth Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| POST | /api/auth/register | `{email, password, firstName, lastName}` | `{userId, message}` | - | Kayıt |
| POST | /api/auth/login | `{email, password}` | `{accessToken, refreshToken, expiresIn}` | - | Giriş |
| POST | /api/auth/refresh | `{refreshToken}` | `{accessToken, refreshToken, expiresIn}` | - | Token yenile |
| POST | /api/auth/logout | `{refreshToken}` | `{success}` | JWT | Çıkış |
| POST | /api/auth/verify-email | `{token}` | `{success}` | - | E-posta doğrula |
| POST | /api/auth/forgot-password | `{email}` | `{message}` | - | Şifre sıfırlama isteği |
| POST | /api/auth/reset-password | `{token, newPassword}` | `{success}` | - | Şifre sıfırla |

### 10.2 User Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/users/me | - | `UserDto` | JWT | Profil bilgisi |
| PUT | /api/users/me | `{firstName, lastName}` | `UserDto` | JWT | Profil güncelle |
| PUT | /api/users/me/password | `{currentPassword, newPassword}` | `{success}` | JWT | Şifre değiştir |
| DELETE | /api/users/me | `{password}` | `{success}` | JWT | Hesap sil |
| GET | /api/users/me/notifications | - | `NotificationDto[]` | JWT | Bildirimler |
| PUT | /api/users/me/notifications/{id}/read | - | `{success}` | JWT | Okundu işaretle |

### 10.3 Binance Account Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/binance/account | - | `BinanceAccountDto` | JWT | Bağlantı durumu |
| POST | /api/binance/account | `{apiKey, apiSecret, isTestnet}` | `BinanceAccountDto` | JWT | Hesap bağla |
| DELETE | /api/binance/account | - | `{success}` | JWT | Hesap bağlantısını kes |
| GET | /api/binance/account/test | - | `{success, message}` | JWT | Bağlantı test et |
| GET | /api/binance/balances | - | `BalanceDto[]` | JWT | Bakiyeler |
| GET | /api/binance/orders/open | - | `OrderDto[]` | JWT | Açık emirler |
| GET | /api/binance/orders/history | `?coin&from&to&page` | `OrderDto[]` | JWT | Emir geçmişi |
| DELETE | /api/binance/orders/{orderId} | - | `{success}` | JWT | Emir iptal |

### 10.4 Coin Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/coins | `?search` | `CoinDto[]` | JWT | Binance coin listesi |
| GET | /api/coins/watchlist | - | `WatchlistCoinDto[]` | JWT | İzleme listesi |
| POST | /api/coins/watchlist | `{coinId, strategyId?, timeframe?}` | `WatchlistCoinDto` | JWT | Coin ekle |
| DELETE | /api/coins/watchlist/{coinId} | - | `{success}` | JWT | Coin çıkar |
| GET | /api/coins/{coinId}/price | - | `PriceDto` | JWT | Anlık fiyat |
| GET | /api/coins/{coinId}/candles | `?timeframe&from&to&limit` | `CandleDto[]` | JWT | Mum verileri |

### 10.5 Indicator Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/indicators | - | `IndicatorDto[]` | JWT | Tüm indikatörler |
| GET | /api/indicators/{id}/parameters | - | `IndicatorParamDefDto[]` | JWT | Parametre tanımları |
| GET | /api/indicators/settings | - | `UserIndicatorSettingDto[]` | JWT | Kullanıcı ayarları |
| PUT | /api/indicators/{id}/settings | `{coinId?, isEnabled, weight}` | `UserIndicatorSettingDto` | JWT | Ayar güncelle |
| PUT | /api/indicators/{id}/parameters | `{coinId?, parameters: [{key, value}]}` | `{success}` | JWT | Parametre kaydet |

### 10.6 Strategy Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/strategies | - | `StrategyDto[]` | JWT | Stratejiler |
| GET | /api/strategies/{id} | - | `StrategyDto` | JWT | Strateji detay |
| POST | /api/strategies | `StrategyCreateDto` | `StrategyDto` | JWT | Strateji oluştur |
| PUT | /api/strategies/{id} | `StrategyUpdateDto` | `StrategyDto` | JWT | Strateji güncelle |
| DELETE | /api/strategies/{id} | - | `{success}` | JWT | Strateji sil |

### 10.7 Signal Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/signals | `?coin&direction&timeframe&from&to&page` | `SignalDto[]` | JWT | Sinyal geçmişi |
| GET | /api/signals/{id} | - | `SignalDetailDto` | JWT | Sinyal detay (breakdown) |
| GET | /api/signals/latest | - | `SignalDto[]` | JWT | Son sinyaller |

### 10.8 Order Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| POST | /api/orders | `OrderCreateDto` | `OrderDto` | JWT | Manuel emir |
| GET | /api/orders | `?status&coin&page` | `OrderDto[]` | JWT | Emir listesi |
| GET | /api/orders/{id} | - | `OrderDto` | JWT | Emir detay |
| DELETE | /api/orders/{id} | - | `{success}` | JWT | Emir iptal |

### 10.9 Position Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/positions | `?status` | `PositionDto[]` | JWT | Pozisyonlar |
| GET | /api/positions/{id} | - | `PositionDto` | JWT | Pozisyon detay |
| PUT | /api/positions/{id}/sl-tp | `{stopLoss?, takeProfit?}` | `PositionDto` | JWT | SL/TP güncelle |
| POST | /api/positions/{id}/close | `{type: market/limit, price?}` | `OrderDto` | JWT | Pozisyon kapat |

### 10.10 Risk Settings Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/risk-settings | - | `RiskSettingsDto` | JWT | Risk ayarları |
| PUT | /api/risk-settings | `RiskSettingsUpdateDto` | `RiskSettingsDto` | JWT | Risk ayarları güncelle |
| POST | /api/risk-settings/emergency-stop | - | `{closedPositions, message}` | JWT | Acil durdur |

### 10.11 Backtest Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| POST | /api/backtests | `BacktestCreateDto` | `{backtestRunId}` | JWT | Backtest başlat |
| GET | /api/backtests | - | `BacktestRunDto[]` | JWT | Geçmiş backtest |
| GET | /api/backtests/{id} | - | `BacktestRunDetailDto` | JWT | Backtest sonuç |
| GET | /api/backtests/{id}/trades | - | `BacktestTradeDto[]` | JWT | Backtest işlemler |
| DELETE | /api/backtests/{id} | - | `{success}` | JWT | Backtest sil |

### 10.12 Notification Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/notifications/preferences | - | `NotificationPreferencesDto` | JWT | Bildirim tercihleri |
| PUT | /api/notifications/preferences | `NotificationPreferencesDto` | `{success}` | JWT | Tercihleri güncelle |
| POST | /api/notifications/device-token | `{token, platform}` | `{success}` | JWT | Push token kaydet |

### 10.13 Admin Endpoints

| Method | URL | Request | Response | Auth | Açıklama |
|---|---|---|---|---|---|
| GET | /api/admin/users | `?search&page` | `UserAdminDto[]` | Admin JWT | Kullanıcı listesi |
| PUT | /api/admin/users/{id}/status | `{isActive}` | `{success}` | Admin JWT | Kullanıcı aktif/pasif |
| GET | /api/admin/system-logs | `?level&source&from&to&page` | `SystemLogDto[]` | Admin JWT | Sistem logları |
| GET | /api/admin/indicators | - | `IndicatorDto[]` | Admin JWT | İndikatör yönetimi |
| POST | /api/admin/indicators | `IndicatorCreateDto` | `IndicatorDto` | Admin JWT | İndikatör ekle |
| GET | /api/admin/system-stats | - | `SystemStatsDto` | Admin JWT | Sistem durumu |

### 10.14 SignalR Hubs

| Hub | Method | Açıklama |
|---|---|---|
| `/hubs/market` | `SubscribeCoin(symbol)` | Gerçek zamanlı fiyat |
| `/hubs/market` | `UnsubscribeCoin(symbol)` | Abonelik iptal |
| `/hubs/signals` | `SubscribeSignals()` | Gerçek zamanlı sinyal akışı |
| `/hubs/positions` | `SubscribePositions()` | Pozisyon PnL güncellemeleri |
| `/hubs/notifications` | `SubscribeNotifications()` | Anlık bildirimler |

---

## 11. Strateji Motoru Tasarımı

### 11.1 Genel Yaklaşım

Strateji motoru **puanlama tabanlı** (score aggregation) çalışır.

1. Her aktif indikatör çalışır, bir puan üretir.
2. Puanlar ağırlıklarıyla toplanır.
3. Toplam puan + strateji eşikleriyle karşılaştırılır.
4. EMA200 özel kuralı aktifse ek filtre uygulanır.
5. Sonuç: BUY / SELL / STRONG_SELL / HOLD

### 11.2 Puan Hesaplama

```
Her indikatör üretir:
  rawScore ∈ [-1.0, +1.0]
    +1.0 = güçlü alım sinyali
     0.0 = nötr
    -1.0 = güçlü satış sinyali

weightedScore = rawScore × weight

totalScore = Σ(weightedScore_i)

Karar:
  if totalScore >=  BuyThreshold      → BUY
  if totalScore <=  SellThreshold     → SELL
  if totalScore <=  StrongSellThreshold → STRONG_SELL
  else                                → HOLD
```

### 11.3 EMA200 Filtresi

EMA200 kuralı aktifse, BUY kararı için ek koşullar:

```
1. Mevcut kapanış fiyatı > EMA200 değeri
2. EMA200 geçiş sayısı hesapla:
   - Son N mumda fiyatın EMA200 altından üstüne geçtiği noktayı bul
   - crossCandleIndex = bu geçişten bu yana kaç mum geçti
3. crossCandleIndex >= MinCandlesAfterCross (≥2)
4. crossCandleIndex <= MaxCandlesAfterCross (≤5)
Koşullardan biri sağlanmıyorsa → BUY iptal, HOLD'a çevir
```

### 11.4 Coin Bazlı vs Global Strateji

```
Kullanıcı coin izliyor:
  → Bu coin için özel strateji var mı?
    EVET → Coin stratejisini kullan
    HAYIR → Global stratejiyi kullan
```

### 11.5 Strateji Değerlendirme Akışı

```
1. Mum kapandı (WebSocket event)
2. Bu mum timeframe ile ilgilenen tüm kullanıcı/coin çiftleri tespit edilir
3. Her çift için:
   a. İlgili mum verileri DB'den / cache'den alınır
   b. Aktif indikatörler çalıştırılır
   c. Puanlar toplanır
   d. EMA200 filtresi uygulanır
   e. Sinyal yönü belirlenir
   f. TradeSignal kaydedilir
   g. Önceki sinyal ile farklıysa notification üretilir
   h. Otomatik mod aktifse → OrderEngine'e iletilir
```

---

## 12. İndikatör Motoru Tasarımı

### 12.1 Modüler Mimari

Her indikatör bir interface implement eder:

```csharp
public interface IIndicator
{
    string Name { get; }
    string Category { get; }

    // Hesaplama; dışarıdan parametre dictionary geliyor
    IndicatorResult Calculate(
        IReadOnlyList<Candle> candles,
        Dictionary<string, string> parameters);
}

public record IndicatorResult(
    decimal RawScore,      // -1.0 to +1.0
    SignalDirection Direction,  // BUY / SELL / NEUTRAL
    decimal Value,         // İndikatörün ham değeri (görüntüleme için)
    string? Description    // İnsan okunabilir açıklama
);
```

### 12.2 Indicator Registry

Uygulama başlarken reflection ile tüm `IIndicator` implementasyonları otomatik bulunur ve `IndicatorRegistry`'ye kaydedilir. Veritabanındaki `Indicators.ClassName` alanıyla eşleştirilir.

Bu sayede yeni bir indikatör eklemek için:
1. `IIndicator` implement eden bir sınıf yaz
2. `Indicators` tablosuna bir kayıt ekle
3. Parametre tanımlarını `IndicatorParameterDefinitions`'a ekle
4. Sistem otomatik algılar, UI'da görünür

### 12.3 Parametre Çözümleme

```
Kullanıcı parametresi arama sırası:
1. UserIndicatorParameterValues (coin bazlı) var mı?
2. UserIndicatorParameterValues (global) var mı?
3. IndicatorParameterDefinitions.DefaultValue kullan
```

### 12.4 Hesaplama Cache

İndikatörler aynı mum seti üzerinde tekrar tekrar hesaplanmamalı:

- Her `(CoinId, Timeframe, CandleTime, IndicatorId, ParametersHash)` tüpleti için Redis cache
- Cache TTL: bir sonraki mum kapanışına kadar
- Cache miss durumunda hesapla ve cache'e yaz

### 12.5 Mum Verisi Yönetimi

İndikatör hesaplaması için ihtiyaç duyulan mum sayısı indikatöre göre değişir.

- Her indikatör `RequiredCandleCount` özelliği expose eder
- Sistem maksimum ihtiyacı belirler, o kadar mum sağlar
- EMA200 için minimum 300 mum gerekir
- Candle buffer (in-memory) WebSocket ile canlı güncellenir, DB ile bootstrap edilir

---

## 13. Sinyal Üretim Sistemi

### 13.1 Sinyal Yaşam Döngüsü

```
PENDING_CANDLE_CLOSE
    ↓ (mum kapanır)
CALCULATING
    ↓ (indikatörler hesaplanır)
SCORED
    ↓ (karar verilir)
SIGNAL_GENERATED (BUY/SELL/STRONG_SELL/HOLD)
    ↓
  ┌──────────────────────────────┐
  │                              │
NOTIFICATION_SENT          ORDER_TRIGGERED
  │                              │ (otomatik mod)
DISPLAYED_TO_USER          ORDER_EXECUTED
```

### 13.2 Sinyal Deduplication

Aynı coin için aynı yönde ardışık sinyaller üretilmesini önleme:

- Son signal direction cache'de tutulur
- Yeni sinyal != son sinyal ise kaydet + bildir
- HOLD sinyali kaydedilmez (sadece değişim noktaları kayıt altına alınır)

### 13.3 Sinyal Gücü

```
Toplam puan normalize edilerek güç skoru:
  Güç = |totalScore| / maxPossibleScore × 100

maxPossibleScore = Σ(weight_i × 1.0) tüm aktif indikatörler

Görüntüleme:
  80-100: Güçlü
  50-79:  Orta
  0-49:   Zayıf
```

---

## 14. Otomatik Trade Sistemi

### 14.1 Mod Seçenekleri

| Mod | Davranış |
|---|---|
| `SignalOnly` | Sinyal üret, işlem yapma, bildir |
| `ManualApproval` | Sinyal üret, kullanıcı onayı iste, onaylanınca emir ver |
| `FullAuto` | Sinyal üret, risk kontrol geç, otomatik emir ver |

### 14.2 Otomatik Order Execution Akışı

```
1. BUY Sinyali geldi
2. Mod == FullAuto mu?
   HAYIR → ManualApproval notification gönder, bekle
   EVET → Risk Engine kontrolü
     3. Risk kontrolü geçti mi?
        HAYIR → Log yaz, sinyal işaret et (no action), bildir
        EVET → Pozisyon büyüklüğü hesapla
          4. Mevcut serbest USDT bakiyesi yeterli mi?
             HAYIR → Log, bildir
             EVET → Order oluştur
               5. BinanceClient.PlaceOrder()
                  BAŞARILI → Position kaydet, SL/TP emirlerini gönder
                  BAŞARISIZ → Log, bildir, retry politikası
```

### 14.3 Pozisyon Büyüklüğü Hesaplama

```
availableUsdt = FreeBinanceBalance
maxAllowedUsdt = min(
    availableUsdt × (MaxPositionSizePct / 100),
    MaxPositionSizeUsdt (varsa)
)

positionSizeUsdt = min(
    availableUsdt × (AllocationPct / 100),
    maxAllowedUsdt
)

quantity = positionSizeUsdt / currentPrice
quantity = round(quantity, coin.quantityPrecision)
```

### 14.4 Stop-Loss & Take-Profit Emir Yönetimi

Pozisyon açıldıktan sonra:
- `OCO (One-Cancels-Other)` emir gönderilir: SL ve TP aynı anda açık
- Binance SL/TP emirlerini yönetir
- Uygulama `OrderStatusSyncJob` ile emir durumunu günceller
- SL tetiklendiyse → pozisyon `StoppedOut` olarak kapat
- TP tetiklendiyse → pozisyon `TakenProfit` olarak kapat

### 14.5 Trailing Stop Yönetimi

Binance trailing stop order desteklese de uygulama tarafında da yönetilir:

```
Her fiyat güncellemesinde:
  if side == BUY:
    if price > highWatermark:
      highWatermark = price
    trailingStopPrice = highWatermark × (1 - trailingPct/100)
    if price <= trailingStopPrice:
      → Piyasadan kapat
```

### 14.6 Manual Approval Flow (Mobile)

```
Sinyal üretildi → ManualApproval mode
    ↓
Push notification gönderildi (içerik: coin, yön, fiyat, skor)
    ↓
Kullanıcı bildirime dokundu → App açıldı, ApprovalScreen
    ↓
Kullanıcı onayladı / 30 dakika içinde yanıt vermedi:
  - Onayladı → Order ver
  - Zaman aştı → Sinyal expire, bildir
  - Reddetti → Loga yaz
```

---

## 15. Risk Yönetimi

### 15.1 Risk Kontrol Noktaları

**Önceki (Pre-Trade) Kontroller:**

1. `IsAutoTradeEnabled` aktif mi?
2. Binance bağlantısı sağlıklı mı?
3. Günlük zarar limiti doldu mu?
4. Bu coinde zaten açık pozisyon var mı? (tek pozisyon kuralı)
5. Toplam açık pozisyon sayısı `MaxOpenPositions` altında mı?
6. Bu coin whitelist'te mi (veya blacklist'te değil mi)?
7. Pozisyon büyüklüğü `MaxPositionSizeUsdt`/`Pct` altında mı?
8. Stop-loss zorunlu ve belirtilmiş mi?
9. Serbest bakiye yeterli mi?

**Pozisyon Sırası (During-Trade) Kontroller:**

1. Fiyat anlık olarak izlenir
2. Trailing stop güncellenir
3. SL/TP emir durumu izlenir
4. Günlük PnL takip edilir

**Sonrası (Post-Trade) Kontroller:**

1. Gerçekleşen zarar günlük limite eklenir
2. `DailyLossUsedUsdt` güncellenir
3. Günlük limit doluysa `IsAutoTradeEnabled` false yapılır, bildir
4. Win/loss istatistikleri güncellenir

### 15.2 Ani Düşüş Koruması

Background job, tüm açık pozisyonları izler:
- Bir pozisyon giriş fiyatının %X altına (yapılandırılabilir kritik SL) düşerse → Acil market emir ver
- Bu, normal SL'in Binance tarafında tetiklenmesine ek bir güvencedir

### 15.3 Bağlantı Kopukluğu Koruması

`CloseOnDisconnect = true` ise:
- WebSocket bağlantısı N dakikadan fazla koparsa
- Tüm açık pozisyonlar market emir ile kapatılır
- Kullanıcıya bildirim gönderilir
- `IsAutoTradeEnabled` false yapılır

### 15.4 Emergency Stop

Kullanıcı veya sistem tetikleyebilir:
1. Tüm açık Binance emirleri iptal edilir
2. Tüm açık pozisyonlar market fiyatından kapatılır
3. `IsAutoTradeEnabled` false yapılır
4. Tüm aksiyon loglanır
5. Bildirim gönderilir

### 15.5 Günlük Zarar Limiti Sıfırlama

`DailyRiskResetJob` gece yarısı (UTC) çalışır:
- `DailyLossUsedUsdt` = 0 yapılır
- Eğer kullanıcı günlük limit nedeniyle durdurulmuşsa, `IsAutoTradeEnabled` true yapılmaz. Kullanıcı manuel reaktive etmeli.

---

## 16. Binance Entegrasyonu

### 16.1 Kullanılacak Kütüphane

**Binance.Net** (JKorf/Binance.Net) — C# için en gelişmiş Binance kütüphanesi.

- REST API + WebSocket tam destek
- Rate limit yönetimi dahili
- Strongly typed response modelleri
- Test net desteği

### 16.2 API Key Güvenliği

```
Kullanıcı API Key'i giriyor:
    ↓
AES-256-CBC ile şifrele (encryption key → ENV variable / Azure Key Vault)
    ↓
Şifreli metin DB'ye kayıt
    ↓
API Key hiçbir zaman loglanmaz
API Key response'larda hiçbir zaman dönmez (sadece son 4 karakter hint)
```

**Önerilen Binance API Key İzinleri:**
- ✅ Enable Reading
- ✅ Enable Spot & Margin Trading
- ❌ Enable Withdrawals (KESİNLİKLE VERİLMEMELİ)
- ❌ Enable Futures

**IP Kısıtlaması:**
- Kullanıcıya sunucu IP adresini Binance'de whitelist'e eklemesi önerilir
- Bu opsiyonel ama güçlü bir ek güvenlik katmanıdır

### 16.3 WebSocket Yönetimi

**Market Data WebSocket (Server-side, kullanıcıdan bağımsız):**

```
Sistem genelinde izlenen her coin için:
  - Kline (mum) stream: {symbol}@kline_{interval}
  - 24hr ticker stream: {symbol}@ticker

Bağlantı yönetimi:
  - Uygulama başladığında watchlist'teki tüm coinlere subscribe
  - Yeni coin eklendiğinde dinamik subscribe
  - Coin çıkarıldığında unsubscribe
  - Bağlantı kopunca otomatik yeniden bağlan (exponential backoff)
  - Binance 24 saatte bir bağlantıyı kapatır → önceden yenile
```

**Kullanıcı Bazlı Trade WebSocket:**

```
Her Binance hesabı için:
  - User Data Stream (listenKey)
  - Order güncellemeleri: executionReport
  - Bakiye değişimleri: outboundAccountPosition
  - listenKey 30 dakikada bir PUT ile yenilenir (Binance zorunluluğu)
```

### 16.4 Rate Limit Yönetimi

Binance rate limit: 1200 request/dakika (IP bazlı), weight bazlı sistem.

Strateji:
1. Binance.Net kütüphanesi kendi rate limit takibini yapar
2. Kütüphane `RateLimiterResponseHandler` ile 429 / 418 hatalarını yönetir
3. Sistem genelinde rate limit durumu `RateLimitMonitorService` ile izlenir
4. Kritik operasyonlara (order placement) öncelik verilir
5. Rate limit yaklaştığında non-critical sorgular throttle edilir

### 16.5 Hata Yönetimi

| Hata Tipi | Davranış |
|---|---|
| 429 Too Many Requests | Backoff, retry |
| 418 IP Ban | Alarm, admin bildirim, trade durdur |
| -1021 Timestamp hatası | NTP senkronizasyon kontrolü |
| -1100 Parametre hatası | Log, kullanıcı bildir |
| -2010 Yetersiz bakiye | Risk engine'e bildir, log |
| -2011 Order bulunamadı | Zaten kapatılmış kabul et, pozisyon güncelle |
| WebSocket bağlantı kopması | Reconnect (exp backoff), REST fallback |

---

## 17. Backtest Sistemi

### 17.1 Mimari

Backtest motor, canlı trade motorundan tamamen izole çalışır. Aynı `StrategyEngine` ve `IndicatorEngine` kullanır ama simüle modda.

```
BacktestRunner
  ├── CandleProvider (DB'den geçmiş veri)
  ├── StrategyEngine (aynı kod, farklı config)
  ├── SimulatedOrderBook
  ├── SimulatedPortfolio
  └── MetricsCalculator
```

### 17.2 Simülasyon Detayları

- **Slippage:** Şimdilik ihmal, ileride %0.05 varsayılan slippage eklenebilir
- **Komisyon:** Kullanıcı girişi, her işleme uygulanır
- **Emir tipi:** Simülasyonda sadece market emir varsayılır
- **Stop-loss / Take-profit:** Mum içi fiyat hareketleri ile simüle edilir (High/Low kullanılır)

### 17.3 Metrikler

| Metrik | Hesaplama |
|---|---|
| Net PnL | FinalCapital - InitialCapital |
| Net PnL % | NetPnl / InitialCapital × 100 |
| Win Rate | WinningTrades / TotalTrades × 100 |
| Max Drawdown | Equity curve üzerindeki en büyük tepe-dip farkı |
| Sharpe Ratio | (MeanReturn - RiskFreeRate) / StdDev(Returns) × √252 |
| Profit Factor | GrossProfit / GrossLoss |
| Avg Trade Duration | Ortalama pozisyon süresi |

### 17.4 Backtest Çalıştırma

- Backtest asenkron çalışır (Hangfire background job)
- Kullanıcıya job ID döner
- İlerleme durumu polling veya SignalR ile izlenebilir
- Büyük tarih aralığı / çok coin = uzun sürebilir, kullanıcıya beklenti verilir
- Paralel backtest sayısı kullanıcı başına 2 ile sınırlandırılır

---

## 18. Bildirim Sistemi

### 18.1 Kanallar

| Kanal | Teknik | Kullanım |
|---|---|---|
| Push Notification | Firebase Cloud Messaging (FCM) → APNs | iOS için temel kanal |
| In-App | SignalR | Web + mobil (uygulama açıkken) |
| E-posta | SMTP (opsiyonel, kullanıcı tercihi) | Günlük rapor, kritik alarm |

### 18.2 Bildirim Tipleri ve İçerikler

| Tip | Başlık | Örnek İçerik |
|---|---|---|
| BUY Sinyali | "📈 BUY Sinyali: BTCUSDT" | "Skor: +4.2, Fiyat: 43,250 USDT" |
| SELL Sinyali | "📉 SELL Sinyali: ETHUSDT" | "Skor: -3.8, Fiyat: 2,240 USDT" |
| Stop-Loss | "🔴 Stop-Loss Tetiklendi: SOLUSDT" | "Zarar: -2.3%, Fiyat: 95.20 USDT" |
| Take-Profit | "✅ Take-Profit Alındı: BNBUSDT" | "Kâr: +4.7%, Fiyat: 385.50 USDT" |
| Emir Gerçekleşti | "✅ Emir Gerçekleşti: BTCUSDT" | "0.0023 BTC @ 43,245 USDT" |
| Binance Hatası | "⚠️ Binance Bağlantı Hatası" | "API bağlantısı yeniden kuruluyor..." |
| Günlük Rapor | "📊 Günlük Rapor" | "Bugün: +$128.50, Açık: 3 pozisyon" |
| Risk Alarmı | "🚨 Günlük Zarar Limiti Doldu" | "Otomatik trade durduruldu" |

### 18.3 Bildirim Tercih Yönetimi

Her kullanıcı her bildirim tipi için:
- `PushEnabled`: bool
- `EmailEnabled`: bool
- `InAppEnabled`: bool (default true, kapatılamaz)

Sessiz saatler:
- `QuietHoursStart`, `QuietHoursEnd` (TimeOnly)
- Sessiz saatlerde push gönderilmez, in-app ve e-posta devam eder

### 18.4 Retry Mekanizması

- Push notification başarısız olursa 3 kez retry (5s, 30s, 5m)
- 3 başarısız denemeden sonra log yaz, device token geçersiz işaretle

---

## 19. Güvenlik Tasarımı

### 19.1 Authentication & Authorization

**JWT Yapısı:**
```
Access Token:
  - Süre: 15 dakika
  - Claims: userId, email, role, jti (unique ID)
  - İmzalama: HS256 (veya RS256 ileride)

Refresh Token:
  - Süre: 7 gün (rolling)
  - DB'de hash olarak saklanır
  - Tek kullanımlık (kullanılınca yenisi üretilir, eskisi geçersizleşir)
  - Yeni cihazdan login → tüm refresh tokenları geçersiz kılma seçeneği
```

**Token Revocation:**
- Refresh token DB'de tutulduğu için revoke edilebilir
- Logout → refresh token DB'den silindi
- Kullanıcı silindiğinde / suspend edildiğinde tüm tokenlar silindi

### 19.2 API Key Şifreleme

```
Şifreleme algoritması: AES-256-CBC

Uygulama encryption key'i:
  - Ortam değişkeni (ENCRYPTION_MASTER_KEY) olarak saklanır
  - Üretimde Azure Key Vault / AWS Secrets Manager ile yönetilir
  - Asla kod içinde veya DB'de olmaz

Şifreleme akışı:
  plaintext = "api_key_string"
  iv = CryptographicRandomBytes(16)
  ciphertext = AES256CBC.Encrypt(plaintext, masterKey, iv)
  stored = Base64(iv + ciphertext)  -- IV ciphertext ile birlikte saklanır

Şifre çözme:
  stored = DB'den oku
  iv = stored[0:16]
  ciphertext = stored[16:]
  plaintext = AES256CBC.Decrypt(ciphertext, masterKey, iv)
```

### 19.3 Kullanıcı Şifresi

- **bcrypt** ile hash (cost factor: 12)
- Salt otomatik dahil
- Şifre hiçbir zaman loglanmaz
- Şifre sıfırlama token'ı: kriptografik random 64 byte, 1 saat geçerli, tek kullanım

### 19.4 Rate Limiting

| Endpoint Grubu | Limit |
|---|---|
| POST /auth/login | 5 req/dakika per IP |
| POST /auth/register | 3 req/dakika per IP |
| POST /auth/forgot-password | 3 req/dakika per IP |
| POST /orders (trade) | 10 req/dakika per user |
| Genel API | 120 req/dakika per user |
| Admin API | 300 req/dakika per admin |

Kütüphane: `AspNetCoreRateLimit`

### 19.5 Audit Log

Trade ile ilgili tüm kritik aksiyonlar `ApiRequestLogs`'a ek olarak ayrıca loglanır:

- Binance API key ekleme/silme
- Strateji değişikliği
- Risk ayarları değişikliği
- Emir gönderimi
- Pozisyon kapatma
- Emergency stop

Her audit kaydında: userId, action, ipAddress, userAgent, timestamp, before/after (önemli değişiklikler için)

### 19.6 Input Validation

- Tüm API input'ları FluentValidation ile doğrulanır
- Parametre değerleri min/max sınırları ile kontrol edilir
- SQL injection: EF Core parametrik sorgular ile önlenir
- XSS: minimal (API only, HTML output yok), ama string output'lar encode edilir

### 19.7 HTTPS & Transport Security

- Üretimde TLS 1.2+ zorunlu
- HSTS header
- CORS sadece izin verilen originlere
- Sensitive header'lar loglanmaz (Authorization, Cookie)

### 19.8 2FA (İleride Ekleme Kapısı)

Mimari 2FA'ya hazır:
- `Users` tablosuna `TwoFactorEnabled`, `TwoFactorSecret` kolonu eklenebilir
- Login flow'u 2FA adımı için genişletilebilir
- MVP'de implementasyon yok, ama breaking change olmadan eklenebilir

---

## 20. Loglama ve Monitoring

### 20.1 Loglama Altyapısı

**Kütüphane:** Serilog

```
Sinkler:
  - Console (development)
  - MSSQL (SystemLogs tablosu — structured)
  - File (üretim: /logs/app-{date}.log, 30 gün rotasyon)
  - Email (kritik level → admin bildirimi)
```

**Log Seviyeleri:**
- `Critical`: Sistem durmak üzere, acil müdahale gerekiyor
- `Error`: İşlem başarısız, kullanıcı etkilendi
- `Warning`: Beklenen ama istenmeyen durum
- `Information`: Normal ama önemli sistem eventi
- `Debug`: Geliştirme amaçlı detay

### 20.2 Structured Logging

Her log kaydı JSON formatında:
```json
{
  "Timestamp": "2026-06-22T10:30:00Z",
  "Level": "Error",
  "Source": "OrderExecutionEngine",
  "Message": "Order placement failed",
  "UserId": "abc-123",
  "CoinId": 1,
  "Symbol": "BTCUSDT",
  "BinanceErrorCode": -2010,
  "Exception": "...",
  "CorrelationId": "req-xyz"
}
```

### 20.3 Correlation ID

Her API isteğinde `X-Correlation-Id` header oluşturulur veya geçirilir. Tüm log kayıtlarına ve downstream servis çağrılarına eklenir. Sorun debuglama için kritik.

### 20.4 Health Checks

ASP.NET Core Health Checks:
- `/health` → genel sistem durumu
- `/health/db` → MSSQL bağlantısı
- `/health/redis` → Redis bağlantısı
- `/health/binance` → Binance API ping

Hangfire Dashboard: `/hangfire` (admin kimlik doğrulaması arkasında)

### 20.5 Metrikler (Gelecek MVP)

Temel metrikler Prometheus/Grafana ile izlenebilir (sonraki fazda):
- Dakika başı sinyal üretim sayısı
- Order execution başarı/başarısız oranı
- Binance WebSocket uptime
- API response time percentilleri
- Aktif kullanıcı sayısı

---

## 21. Teknik Teknoloji Önerileri

### 21.1 Web Frontend: React mi, Blazor mı?

**Karar: React (TypeScript)**

| Kriter | React | Blazor |
|---|---|---|
| Ekosistem | Çok zengin | Sınırlı |
| Trading UI kütüphaneleri | TradingView Lightweight Charts, AGGrid | Neredeyse yok |
| Performans | SPA, optimal | WebAssembly download boyutu |
| Geliştirici havuzu | Çok büyük | Küçük |
| Build tooling | Vite, Next.js | Dahili |

**Öneri:** React + TypeScript + Vite + TanStack Query + TradingView Lightweight Charts + Tailwind CSS + shadcn/ui

### 21.2 iOS: SwiftUI mi, React Native mı?

**Karar: SwiftUI**

| Kriter | SwiftUI | React Native |
|---|---|---|
| Native his | %100 native | Yakın ama değil |
| Face ID entegrasyonu | Trivial | Ek kütüphane |
| Push notification | Trivial | Ek setup |
| Keychain | Dahili | Ek kütüphane |
| Gerçek zamanlı grafik | Native Charts (iOS 16+) | Üçüncü taraf |
| İleride Android | Hayır | Evet |
| Trading app performansı | Üstün | İyi |

**Öneri:** SwiftUI + Swift Concurrency (async/await) + Combine + Swift Charts (iOS 16+)

**Android için ilerisi:** Android eklenecekse Kotlin + Compose. React Native'e geçmek yerine iki native uygulama tercih edilebilir (fintech'te native deneyim kritik). Veya başından React Native seçilebilir — bu tercih sana kalmış.

### 21.3 Gerçek Zamanlı: SignalR Kullanılmalı mı?

**Karar: Evet, SignalR**

- Fiyat güncellemeleri: SignalR Hub üzerinden
- Sinyal bildirimleri: SignalR
- Pozisyon PnL güncellemeleri: SignalR
- iOS'ta: SignalR Swift Client veya REST polling (5 saniyede bir)
- SignalR → WebSocket → Long Polling fallback otomatik

### 21.4 Binance WebSocket Kullanılmalı mı?

**Karar: Kesinlikle evet**

REST polling ile gerçek zamanlı veri takibi yapılamaz. Mum kapanışı tetiklemesi için WebSocket şart. Binance.Net kütüphanesi bunu kolaylaştırır.

### 21.5 Background Job: Hangfire mi, Quartz.NET mi?

**Karar: Hangfire**

- SQL Server storage (ek altyapı yok)
- Dashboard UI (job durumu izleme)
- Retry mekanizması dahili
- .NET Core entegrasyonu çok basit
- Quartz.NET daha kurumsal ama daha karmaşık

**Ek:** Hangfire'da "Server" kavramı ile birden fazla sunucuya scale edilebilir.

### 21.6 Cache: Redis Gerekli mi?

**Karar: MVP'de Redis tercih edilir, zorunlu değil**

MVP'de Redis olmadan başlanabilir (in-memory cache ile), ama şunlar için çok değer katar:
- İndikatör hesaplama cache
- Kullanıcı session cache
- Fiyat cache (WebSocket → Redis → API)
- Rate limit sayacı
- Distributed lock (birden fazla job instance aynı işi yapmasın)

**Öneri:** StackExchange.Redis, prodda Azure Cache for Redis veya kendi Redis sunucusu.

### 21.7 Teknoloji Stack Özeti

| Katman | Teknoloji |
|---|---|
| Backend API | ASP.NET Core 8.0 |
| ORM | Entity Framework Core 8 |
| Veritabanı | MSSQL 2022 |
| Cache | Redis (StackExchange.Redis) |
| Auth | JWT + Refresh Token |
| Background Jobs | Hangfire |
| Binance | Binance.Net |
| Real-time | SignalR |
| Logging | Serilog |
| Validation | FluentValidation |
| CQRS | MediatR |
| Şifreleme | .NET AES (System.Security.Cryptography) |
| Web Frontend | React 18 + TypeScript + Vite |
| UI Kit | Tailwind CSS + shadcn/ui |
| Grafik | TradingView Lightweight Charts |
| iOS | SwiftUI + Swift 5.9 |
| Push | Firebase (FCM → APNs) |
| Deployment | Docker + nginx |

---

## 22. MVP Planı

### MVP Kapsam Kararı

MVP odaklanacak: **Binance bağlantısı + indikatör motoru + sinyal üretimi + web dashboard**.

MVP'de OLMAYACAKLAR:
- Otomatik trade (risk açısından MVP sonrası)
- iOS uygulama (web önce)
- Backtest
- E-posta bildirimi

MVP OLACAKLAR:
- Kullanıcı yönetimi
- Binance bağlantısı (bakiye + coin fiyatları + mum verileri)
- İndikatör motoru (Tillson + EMA200)
- Strateji motoru (puanlama)
- Sinyal üretimi (Web push + in-app)
- Dashboard + Sinyal geçmişi ekranı
- Manuel order gönderimi (UI'dan)
- Temel risk ayarları

---

## 23. Geliştirme Fazları

### Faz 1: Temel Altyapı (3-4 hafta)

**Yapılacaklar:**
- Solution yapısı ve Clean Architecture kurulumu
- Domain entity tanımları
- MSSQL veritabanı oluşturma, EF Core migrations
- ASP.NET Core API iskeleti (middleware, error handling, logging)
- JWT authentication (register, login, refresh)
- Kullanıcı CRUD
- Hangfire kurulumu
- Redis kurulumu
- Serilog yapılandırması
- Docker Compose (API + DB + Redis)

**Teknik gereksinimler:** ASP.NET Core 8, EF Core 8, MSSQL, Redis, Docker

**Öncelik:** Kritik — her şeyin üzerine inşa edileceği zemin

**Riskler:** DB schema erken kararlaştırılmalı, sonra migration maliyeti artar

**Tahmini karmaşıklık:** Orta

---

### Faz 2: Binance Entegrasyonu (2-3 hafta)

**Yapılacaklar:**
- Binance.Net kurulumu ve konfigürasyonu
- API key şifreli saklama (AES-256)
- REST: bakiye, fiyat, mum verisi
- WebSocket: kline stream, user data stream
- Emir gönderme (market + limit)
- Açık emir takibi
- Rate limit yönetimi
- Bağlantı test endpoint'i
- Coin listesi yönetimi
- CandleData DB sync (geçmiş + canlı)

**Teknik gereksinimler:** Binance.Net, AES şifreleme, WebSocket manager

**Öncelik:** Kritik

**Riskler:** Binance API değişiklikleri, testnet ile prod davranış farkları

**Tahmini karmaşıklık:** Yüksek

---

### Faz 3: İndikatör ve Sinyal Motoru (3-4 hafta)

**Yapılacaklar:**
- `IIndicator` interface tasarımı
- `IndicatorRegistry` (reflection tabanlı)
- Tillson indikatör implementasyonu (kod kullanıcıdan gelecek)
- EMA200 indikatör + özel kural motoru
- Parametre yönetimi (DB + cache)
- `StrategyEngine` (puanlama)
- `SignalEngine` (deduplication, güç hesabı)
- TradeSignal DB kayıt
- Mum bazlı strateji tetikleme (WebSocket event → job)
- Sinyal API endpoint'leri

**Teknik gereksinimler:** IIndicator plugin sistemi, Redis cache, MediatR

**Öncelik:** Kritik

**Riskler:** İndikatör hesaplama doğruluğu → TradingView referansı ile karşılaştırmalı test

**Tahmini karmaşıklık:** Yüksek

---

### Faz 4: Web Dashboard (4-5 hafta)

**Yapılacaklar:**
- React + Vite + TypeScript proje kurulumu
- TanStack Query + Axios API katmanı
- JWT authentication + token yenileme
- Dashboard ekranı
- Portföy ekranı
- Binance bağlantı ekranı
- Coin takip ekranı
- Strateji ayarları ekranı
- İndikatör aç/kapat + parametre ekranı
- Sinyal geçmişi ekranı
- SignalR entegrasyonu (gerçek zamanlı fiyat + sinyal)
- TradingView Lightweight Charts entegrasyonu
- Kullanıcı ayarları

**Teknik gereksinimler:** React 18, TradingView LWC, SignalR JS client, shadcn/ui

**Öncelik:** Yüksek

**Riskler:** Gerçek zamanlı veri güncellemelerinde performans, çok coin açık pozisyon

**Tahmini karmaşıklık:** Yüksek

---

### Faz 5: iOS Uygulama (4-5 hafta)

**Yapılacaklar:**
- SwiftUI proje kurulumu
- Network layer (URLSession + async/await)
- JWT token yönetimi (Keychain)
- Face ID / Touch ID entegrasyonu
- Ana tabbar + tüm ekranlar
- Swift Charts ile mini grafik
- APNs push notification (FCM üzerinden)
- SignalR Swift client
- Deep link yönetimi (bildirimden uygulama açılışı)

**Teknik gereksinimler:** SwiftUI, Swift 5.9, Keychain, Firebase SDK, SignalR Swift

**Öncelik:** Orta (web sonrası)

**Riskler:** App Store review süreci, iOS sürüm uyumluluğu

**Tahmini karmaşıklık:** Yüksek

---

### Faz 6: Backtest Sistemi (2-3 hafta)

**Yapılacaklar:**
- `BacktestRunner` tasarımı
- Simüle emir kitabı
- Simüle portföy
- Metrik hesaplama (win rate, drawdown, Sharpe)
- Hangfire background job olarak çalıştırma
- Backtest API endpoint'leri
- Web UI: konfigürasyon formu + sonuç ekranı
- Grafik üzerinde BUY/SELL noktaları
- Geçmiş backtest listesi

**Teknik gereksinimler:** Hangfire, geçmiş CandleData, MetricsCalculator

**Öncelik:** Orta

**Riskler:** Büyük tarih aralığında performans, memory kullanımı

**Tahmini karmaşıklık:** Orta

---

### Faz 7: Otomatik Trade (3-4 hafta)

**Yapılacaklar:**
- `OrderExecutionEngine`
- Risk engine tam implementasyon
- Pozisyon büyüklüğü hesabı
- OCO emir yönetimi (SL + TP)
- Trailing stop engine
- Manuel onaylı mod (push notification → approval UI)
- Emergency stop
- Günlük zarar limiti takibi
- Bağlantı kopma koruması
- Web UI: Canlı trade ekranı + risk ayarları güncelleme
- Kapsamlı entegrasyon testleri (testnet)

**Teknik gereksinimler:** Binance testnet, order state machine, Hangfire monitoring jobs

**Öncelik:** Yüksek (ama dikkatli)

**Riskler:** Gerçek para riski — testnet'te uzun süre test edilmeli, staging environment şart

**Tahmini karmaşıklık:** Çok Yüksek

---

### Faz 8: Risk Yönetimi ve Profesyonel Özellikler (2-3 hafta)

**Yapılacaklar:**
- Ani düşüş koruması
- Coin whitelist/blacklist tam implementasyon
- Admin paneli (kullanıcı yönetimi, sistem log, indikatör yönetimi)
- Log ekranı (SignalR ile gerçek zamanlı)
- Günlük rapor bildirimi
- E-posta bildirim sistemi
- Sistem health check dashboard
- Performance optimizasyonları (DB index, cache tuning)
- Yük testi

**Teknik gereksinimler:** Serilog Email sink, SMTP, Prometheus (opsiyonel)

**Öncelik:** Orta

**Riskler:** E-posta spam filtreleri, notification volume yönetimi

**Tahmini karmaşıklık:** Orta

---

## 24. Kritik Riskler

### 24.1 Gerçek Para Riski

**Risk:** Hatalı sinyal veya yazılım hatası nedeniyle kullanıcı para kaybeder.

**Azaltma:**
- Otomatik trade faz 7'ye ertelendi (önce sinyal only test)
- Testnet üzerinde minimum 4 hafta test
- Stop-loss zorunluluğu
- Pozisyon büyüklüğü limitleri
- Emergency stop
- Staging ortamında paper trading

### 24.2 Binance API Değişiklikleri

**Risk:** Binance API breaking change yapabilir.

**Azaltma:**
- Binance.Net kütüphanesi aktif olarak güncelleniyor
- `IBinanceRestClient` interface'i arkasında izolasyon
- API versiyon değişikliklerini takip eden monitoring

### 24.3 Rate Limit Aşımı

**Risk:** Çok kullanıcı / çok coin ile Binance rate limit aşılabilir.

**Azaltma:**
- Sistem genelinde WebSocket (REST polling değil)
- Rate limit monitor
- Kullanıcı başına izlenen coin sınırı (başlangıçta örn. max 20 coin)
- Adaptive throttling

### 24.4 Veri Kaybı Riski

**Risk:** DB hatası veya uygulama crash'i sırasında açık pozisyon bilgisi kaybolabilir.

**Azaltma:**
- Binance'deki gerçek emir/pozisyon durumu her zaman kaynak of truth
- `OrderStatusSyncJob` periyodik senkronizasyon
- Position state ile Binance state karşılaştırma ve reconciliation job

### 24.5 Şifreli API Key'e Erişim

**Risk:** Sunucu ele geçirilirse şifreli API keyler çözülebilir.

**Azaltma:**
- Master encryption key ortam değişkeni / Key Vault (asla DB'de değil)
- API key withdrawal izni hiçbir zaman kullanılmaz
- IP kısıtlaması önerisi
- Key rotation mekanizması ilerisi için hazır

### 24.6 Indicator Calculation Bugs

**Risk:** İndikatör hesaplama hatası yanlış sinyal üretir.

**Azaltma:**
- Her indikatör için birim testi
- TradingView referans değerleri ile karşılaştırma testi
- Backtest sonuçlarını beklenen strateji davranışıyla doğrulama

### 24.7 WebSocket Güvenilirliği

**Risk:** WebSocket bağlantısı kopar, sinyal üretimi durur.

**Azaltma:**
- Exponential backoff ile otomatik yeniden bağlanma
- Bağlantı kopukluğunda alarm
- REST fallback (kritik durumlarda polling)
- Connection state monitoring

### 24.8 Ölçeklenebilirlik

**Risk:** Çok kullanıcı ile sistem yavaşlar.

**Azaltma:**
- Redis cache (DB yükü azaltır)
- Veritabanı index'leri (tasarımda belirtildi)
- CandleData partitioning
- Hangfire scale-out (birden fazla worker)
- Background job kuyruk yönetimi (öncelik: order > signal > candle)

---

## 25. Sonraki Adımlar

### İlk Yazılacak Kodlar

Faz 1 için aşağıdaki sırayla başlanması önerilir:

1. **Solution ve proje yapısı**
   - `CriptoMoney.sln` oluştur
   - Clean Architecture proje klasörleri
   - Proje referansları ayarla

2. **Domain Entities**
   - Tüm entity sınıfları (sadece property, iş mantığı olmadan)
   - Value objects
   - Domain event sınıfları (skeleton)

3. **EF Core DbContext ve Migrations**
   - `AppDbContext`
   - Entity konfigürasyonları (Fluent API)
   - İlk migration
   - Seed data (admin user, temel indikatörler)

4. **Repository ve UnitOfWork**
   - `IGenericRepository<T>` interface
   - `IUnitOfWork` interface
   - EF Core implementasyonları

5. **Authentication**
   - JWT servis
   - Password hasher (bcrypt)
   - Refresh token yönetimi
   - Auth controller (register, login, refresh, logout)

6. **Binance API Key Yönetimi**
   - `IEncryptionService` + AES implementasyonu
   - `UserBinanceAccount` CRUD
   - Bağlantı test endpoint'i

7. **Binance.Net Entegrasyonu**
   - `IBinanceRestClient` wrapper
   - Bakiye endpoint'i
   - Fiyat endpoint'i
   - Mum verisi endpoint'i

8. **IIndicator Interface ve Registry**
   - Interface tanımı
   - IndicatorRegistry (reflection ile discovery)
   - Parametre çözümleme servisi

9. **İndikatör Implementasyonları**
   - EMA200 (hesaplama kodu kullanıcıdan gelecek)
   - Tillson (hesaplama kodu kullanıcıdan gelecek)

10. **StrategyEngine ve SignalEngine**
    - Puanlama motoru
    - EMA200 özel kural
    - TradeSignal üretim ve kayıt

---

*Doküman sonu. Versiyon 1.0 — 2026-06-22*
