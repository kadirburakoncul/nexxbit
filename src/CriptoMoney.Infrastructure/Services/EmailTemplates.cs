namespace CriptoMoney.Infrastructure.Services;

public static class EmailTemplates
{
    private const string Css = @"
      body { font-family: 'Segoe UI', sans-serif; background: #0d0d0d; color: #e0e0e0; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 32px auto; background: #1a1a2e; border-radius: 12px; overflow: hidden; }
      .header { background: linear-gradient(135deg, #f0b90b 0%, #f8d062 100%); padding: 24px; text-align: center; }
      .header h1 { margin: 0; color: #0d0d0d; font-size: 22px; }
      .content { padding: 32px; }
      .content h2 { color: #f0b90b; margin-top: 0; }
      .metric { background: #0d0d0d; border-radius: 8px; padding: 12px 16px; margin: 8px 0; display: flex; justify-content: space-between; }
      .metric span { color: #888; font-size: 13px; }
      .metric strong { color: #fff; font-size: 15px; }
      .positive { color: #00d09c; }
      .negative { color: #f6465d; }
      .footer { text-align: center; padding: 16px; color: #555; font-size: 12px; }";

    private static string Wrap(string title, string body) =>
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>" + Css + "</style></head><body>" +
        "<div class=\"container\">" +
        "<div class=\"header\"><h1>NEXXBIT &mdash; " + title + "</h1></div>" +
        "<div class=\"content\">" + body + "</div>" +
        "<div class=\"footer\">Bu e-posta otomatik oluşturulmuştur. NEXXBIT &mdash; Withdrawal yetkisi kullanılmaz.</div>" +
        "</div></body></html>";

    public static string DailyReport(
        string firstName,
        int totalSignals,
        int filledOrders,
        decimal realizedPnl,
        decimal dailyLossUsed,
        int openPositions)
    {
        var pnlClass = realizedPnl >= 0 ? "positive" : "negative";
        var pnlSign = realizedPnl >= 0 ? "+" : "";

        var body =
            $"<h2>Günlük Performans Raporu</h2>" +
            $"<p>Merhaba <strong>{firstName}</strong>, bugünkü özet:</p>" +
            $"<div class=\"metric\"><span>Üretilen Sinyal</span><strong>{totalSignals}</strong></div>" +
            $"<div class=\"metric\"><span>Gerçekleşen Emir</span><strong>{filledOrders}</strong></div>" +
            $"<div class=\"metric\"><span>Gerçekleşen P&amp;L</span><strong class=\"{pnlClass}\">{pnlSign}{realizedPnl:F2} USDT</strong></div>" +
            $"<div class=\"metric\"><span>Günlük Kullanılan Kayıp</span><strong>{dailyLossUsed:F2} USDT</strong></div>" +
            $"<div class=\"metric\"><span>Açık Pozisyon</span><strong>{openPositions}</strong></div>";

        return Wrap("Günlük Rapor", body);
    }

    public static string FlashCrashAlert(string firstName, string symbol, decimal dropPct, int windowMinutes)
    {
        var body =
            $"<h2>⚠️ Flash Crash Uyarısı</h2>" +
            $"<p>Merhaba <strong>{firstName}</strong>,</p>" +
            $"<p><strong>{symbol}</strong> son <strong>{windowMinutes} dakikada %{dropPct:F2}</strong> düştü.</p>" +
            "<p>Otomatik işlemler <strong>geçici olarak durduruldu</strong>. Piyasa toparlanınca yeniden devreye girecek.</p>" +
            $"<div class=\"metric\"><span>Etkilenen Sembol</span><strong>{symbol}</strong></div>" +
            $"<div class=\"metric\"><span>Düşüş</span><strong class=\"negative\">%{dropPct:F2}</strong></div>" +
            $"<div class=\"metric\"><span>Zaman Penceresi</span><strong>{windowMinutes} dakika</strong></div>";

        return Wrap("Flash Crash Uyarısı", body);
    }

    public static string OrderFilled(
        string firstName, string symbol, string side, decimal qty, decimal price, decimal total)
    {
        var sideLabel = side == "Buy" ? "ALIM" : "SATIM";
        var sideClass = side == "Buy" ? "positive" : "negative";

        var body =
            $"<h2>Emir Gerçekleşti</h2>" +
            $"<p>Merhaba <strong>{firstName}</strong>, emriniz gerçekleşti:</p>" +
            $"<div class=\"metric\"><span>Sembol</span><strong>{symbol}</strong></div>" +
            $"<div class=\"metric\"><span>İşlem Yönü</span><strong class=\"{sideClass}\">{sideLabel}</strong></div>" +
            $"<div class=\"metric\"><span>Miktar</span><strong>{qty:F6}</strong></div>" +
            $"<div class=\"metric\"><span>Fiyat</span><strong>{price:F2} USDT</strong></div>" +
            $"<div class=\"metric\"><span>Toplam</span><strong>{total:F2} USDT</strong></div>";

        return Wrap("Emir Gerçekleşti", body);
    }
}
