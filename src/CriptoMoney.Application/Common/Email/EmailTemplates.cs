namespace CriptoMoney.Application.Common.Email;

public record ReasonStat(string Reason, int Count, int Wins, decimal AvgPct);
public record HoldStat(string Bucket, int Count, int Wins, decimal AvgPct);
public record TradeLine(string Symbol, decimal PnlPct, decimal? PnlUsdt, string ClosedAt, string? Reason = null);

public static class EmailTemplates
{
    private static string Wrap(string firstName, string title, string bodyContent) => $"""
        <!DOCTYPE html>
        <html lang="tr">
        <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;padding:0;background:#08080d;font-family:system-ui,-apple-system,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#08080d;padding:40px 20px;">
            <tr><td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1117;border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:#0b0b0f;padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:12px;">
                          <table cellpadding="0" cellspacing="0" style="background:#0f1117;border:1px solid rgba(251,191,36,0.3);border-radius:8px;width:36px;height:36px;" width="36" height="36">
                            <tr><td align="center" valign="middle" style="font-size:12px;font-weight:700;color:#FBBF24;letter-spacing:-0.5px;">XX</td></tr>
                          </table>
                        </td>
                        <td>
                          <span style="font-size:20px;font-weight:700;color:#FBBF24;letter-spacing:-0.5px;">NEXX</span><span style="font-size:20px;font-weight:300;color:#f1f5f9;">BIT</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:32px;">
                    <p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f8fafc;">{title}</p>
                    <p style="margin:0 0 24px;font-size:14px;color:#94a3b8;">Merhaba {firstName},</p>
                    {bodyContent}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.06);">
                    <p style="margin:0;font-size:12px;color:#334155;">Bu e-postayı siz talep etmediyseniz dikkate almayın.</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#1e293b;">© 2026 Nexxbit · nexxbit.com.tr</p>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
        """;

    public static string VerifyEmail(string firstName, string verifyUrl) => Wrap(
        firstName,
        "E-posta adresinizi doğrulayın",
        $"""
        <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.6;">
          Nexxbit hesabınız oluşturuldu. Hesabınızı etkinleştirmek için aşağıdaki butona tıklayın.
          Bağlantı <strong style="color:#f8fafc;">24 saat</strong> geçerlidir.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="background:#FBBF24;border-radius:10px;padding:12px 28px;">
              <a href="{verifyUrl}" style="font-size:14px;font-weight:700;color:#0b0b0f;text-decoration:none;display:block;">E-posta Adresimi Doğrula</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#475569;">Buton çalışmıyorsa şu adresi tarayıcıya yapıştırın:<br>
          <a href="{verifyUrl}" style="color:#FBBF24;word-break:break-all;">{verifyUrl}</a>
        </p>
        """
    );

    public static string LoginOtp(string firstName, string otp) => Wrap(
        firstName,
        "Giriş Doğrulama Kodunuz",
        $"""
        <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.6;">
          Nexxbit hesabınıza giriş için doğrulama kodu aşağıdadır.
          Bu kod <strong style="color:#f8fafc;">5 dakika</strong> geçerlidir.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="background:#0b0b0f;border:2px solid rgba(251,191,36,0.4);border-radius:12px;padding:20px 40px;text-align:center;">
              <span style="font-size:36px;font-weight:800;color:#FBBF24;letter-spacing:12px;font-family:monospace;">{otp}</span>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#64748b;">
          Bu kodu kimseyle paylaşmayın. Giriş talebini siz yapmadıysanız şifrenizi değiştirin.
        </p>
        """
    );

    public static string ResetPassword(string firstName, string resetUrl) => Wrap(
        firstName,
        "Şifre sıfırlama isteği",
        $"""
        <p style="margin:0 0 24px;font-size:15px;color:#cbd5e1;line-height:1.6;">
          Hesabınız için şifre sıfırlama talebinde bulundunuz. Aşağıdaki butona tıklayarak yeni şifrenizi belirleyin.
          Bağlantı <strong style="color:#f8fafc;">1 saat</strong> geçerlidir.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td style="background:#FBBF24;border-radius:10px;padding:12px 28px;">
              <a href="{resetUrl}" style="font-size:14px;font-weight:700;color:#0b0b0b;text-decoration:none;display:block;">Şifremi Sıfırla</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 12px;font-size:13px;color:#64748b;">
          Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın. Şifreniz değiştirilmeyecektir.
        </p>
        <p style="margin:0;font-size:12px;color:#475569;">Buton çalışmıyorsa şu adresi tarayıcıya yapıştırın:<br>
          <a href="{resetUrl}" style="color:#FBBF24;word-break:break-all;">{resetUrl}</a>
        </p>
        """
    );

    public static string DailyReport(
        string firstName,
        int totalSignals,
        int filledOrders,
        decimal realizedPnl,
        decimal dailyLossUsed,
        int openPositions)
    {
        var pnlColor = realizedPnl >= 0 ? "#10b981" : "#ef4444";
        var pnlSign  = realizedPnl >= 0 ? "+" : "";
        var pnlBg    = realizedPnl >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";
        var dateStr  = DateTime.UtcNow.AddDays(-1).ToString("dd MMMM yyyy", new System.Globalization.CultureInfo("tr-TR"));

        static string MetricRow(string label, string value, string valueColor = "#f8fafc") =>
            $"""
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;">{label}</td>
                    <td align="right" style="font-size:14px;font-weight:700;color:{valueColor};">{value}</td>
                  </tr>
                </table>
              </td>
            </tr>
            """;

        return Wrap(
            firstName,
            $"Günlük Rapor — {dateStr}",
            $"""
            <div style="background:{pnlBg};border:1px solid {pnlColor}33;border-radius:12px;padding:20px 24px;margin-bottom:24px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Günlük Gerçekleşen P&amp;L</p>
              <p style="margin:0;font-size:36px;font-weight:800;color:{pnlColor};letter-spacing:-1px;">{pnlSign}{realizedPnl:F2} <span style="font-size:18px;font-weight:400;">USDT</span></p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              {MetricRow("Üretilen Sinyal", totalSignals.ToString())}
              {MetricRow("Gerçekleşen Emir", filledOrders.ToString())}
              {MetricRow("Günlük Kullanılan Kayıp", $"{dailyLossUsed:F2} USDT", dailyLossUsed > 0 ? "#f59e0b" : "#f8fafc")}
              {MetricRow("Anlık Açık Pozisyon", openPositions.ToString(), openPositions > 0 ? "#FBBF24" : "#f8fafc")}
            </table>
            <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
              Bu rapor her gün otomatik olarak oluşturulur. Detaylar için
              <a href="https://app.nexxbit.com.tr/positions" style="color:#FBBF24;text-decoration:none;">uygulama</a>nızı ziyaret edin.
            </p>
            """
        );
    }

    public static string NewUserRegistered(string adminFirstName, string newUserFullName, string newUserEmail, DateTime registeredAt)
    {
        var dateStr = registeredAt.ToString("dd MMMM yyyy HH:mm", new System.Globalization.CultureInfo("tr-TR"));
        static string MetricRow(string label, string value) =>
            $"""
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:13px;color:#64748b;">{label}</td>
                    <td align="right" style="font-size:13px;font-weight:600;color:#f8fafc;">{value}</td>
                  </tr>
                </table>
              </td>
            </tr>
            """;

        return Wrap(
            adminFirstName,
            "Yeni Üye Kaydoldu",
            $"""
            <div style="background:rgba(251,191,36,0.06);border:1px solid rgba(251,191,36,0.2);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:14px;color:#FBBF24;font-weight:600;">Yeni bir kullanıcı platforma kaydoldu.</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              {MetricRow("Ad Soyad", newUserFullName)}
              {MetricRow("E-posta", newUserEmail)}
              {MetricRow("Kayıt Tarihi", dateStr)}
            </table>
            <p style="margin:0;font-size:13px;color:#475569;">
              Kullanıcı yönetimi için
              <a href="https://app.nexxbit.com.tr/admin" style="color:#FBBF24;text-decoration:none;">yönetim panelini</a> ziyaret edin.
            </p>
            """
        );
    }

    public static string TradingAnalysisReport(
        string firstName,
        DateTime date,
        int totalClosed,
        int wins,
        int losses,
        decimal avgPct,
        decimal avgWinPct,
        decimal avgLossPct,
        decimal netUsdt,
        decimal profitFactor,
        IList<ReasonStat> byReason,
        IList<HoldStat> byHold,
        IList<TradeLine> topWinners,
        IList<TradeLine> topLosers,
        IList<TradeLine> recent)
    {
        var ctr     = new System.Globalization.CultureInfo("tr-TR");
        var dateStr = date.ToString("dd MMMM yyyy", ctr);
        var winRate = totalClosed > 0 ? wins * 100m / totalClosed : 0m;

        string G(decimal v) => v >= 0 ? "#10b981" : "#ef4444";
        string P(decimal v) => $"{(v >= 0 ? "+" : "")}{v:F2}%";
        string U(decimal? v) => v.HasValue
            ? $"{(v.Value >= 0 ? "+" : "")}${Math.Abs(v.Value):F2}"
            : "—";

        var netColor  = G(netUsdt);
        var netBg     = netUsdt >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)";
        var netBorder = netUsdt >= 0 ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)";
        var netSign   = netUsdt >= 0 ? "+" : "";

        // --- Helpers ---
        string SH(string t) =>
            $"<p style=\"margin:22px 0 10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:8px;\">{t}</p>";

        string Card(string label, string value, string vColor, string sub) =>
            $"<td style=\"padding:4px;\"><div style=\"background:#0b0b0f;border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:14px 16px;\"><p style=\"margin:0 0 5px;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;\">{label}</p><p style=\"margin:0 0 3px;font-size:18px;font-weight:700;color:{vColor};\">{value}</p><p style=\"margin:0;font-size:11px;color:#475569;\">{sub}</p></div></td>";

        string TradeCard(TradeLine t) =>
            $"<tr><td style=\"padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"font-size:12px;color:#f1f5f9;font-weight:600;\">{t.Symbol}</td><td align=\"right\" style=\"font-size:12px;font-weight:700;color:{G(t.PnlPct)};\">{P(t.PnlPct)}</td></tr><tr><td style=\"font-size:10px;color:#475569;padding-top:2px;\">{t.ClosedAt}</td><td align=\"right\" style=\"font-size:10px;color:{G(t.PnlPct)};padding-top:2px;\">{U(t.PnlUsdt)}</td></tr></table></td></tr>";

        // --- Hero ---
        var hero = $"<div style=\"background:{netBg};border:1px solid {netBorder};border-radius:12px;padding:20px 24px;margin-bottom:20px;text-align:center;\"><p style=\"margin:0 0 4px;font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;\">Günlük Net P&amp;L</p><p style=\"margin:0 0 6px;font-size:38px;font-weight:800;color:{netColor};letter-spacing:-1px;\">{netSign}{netUsdt:F2} <span style=\"font-size:18px;font-weight:400;\">USDT</span></p><p style=\"margin:0;font-size:13px;color:#64748b;\">{totalClosed} kapalı işlem &middot; {wins} kazanç / {losses} kayıp</p></div>";

        // --- Summary grid ---
        var pfStr   = profitFactor > 0 ? $"{profitFactor:F2}" : "—";
        var pfColor = profitFactor >= 1 ? "#10b981" : "#ef4444";
        var wColor  = winRate >= 50 ? "#10b981" : "#ef4444";
        var grid    = $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border-collapse:collapse;margin-bottom:4px;\"><tr>{Card("Kazanma Oranı", $"%{winRate:F1}", wColor, $"{wins}K / {losses}K")}{Card("Ort. Getiri", P(avgPct), G(avgPct), $"Kazanç: {P(avgWinPct)}")}</tr><tr>{Card("Profit Factor", pfStr, pfColor, "Kazanç / Kayıp")}{Card("Ort. Kayıp", P(avgLossPct), G(avgLossPct), "Kaybeden işlemler")}</tr></table>";

        // --- Close reason section ---
        var reasonRows = string.Concat(byReason.Select(s =>
        {
            var wr = s.Count > 0 ? s.Wins * 100m / s.Count : 0m;
            var wrColor = wr >= 50 ? "#10b981" : "#f59e0b";
            return $"<tr><td style=\"padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"font-size:12px;color:#cbd5e1;width:38%;\">{s.Reason}</td><td align=\"center\" style=\"font-size:12px;color:#94a3b8;width:15%;\">{s.Count}</td><td align=\"center\" style=\"font-size:12px;color:{wrColor};width:20%;\">{wr:F0}%K</td><td align=\"right\" style=\"font-size:12px;font-weight:600;color:{G(s.AvgPct)};width:27%;\">{P(s.AvgPct)}</td></tr></table></td></tr>";
        }));
        var reasonSection = byReason.Count > 0
            ? SH("Kapatma Nedeni") +
              $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr style=\"border-bottom:1px solid rgba(255,255,255,0.06);\"><td style=\"font-size:10px;color:#475569;padding-bottom:6px;width:38%;\">NEDEN</td><td align=\"center\" style=\"font-size:10px;color:#475569;padding-bottom:6px;width:15%;\">İŞLEM</td><td align=\"center\" style=\"font-size:10px;color:#475569;padding-bottom:6px;width:20%;\">K/Z</td><td align=\"right\" style=\"font-size:10px;color:#475569;padding-bottom:6px;width:27%;\">ORT. %</td></tr>{reasonRows}</table>"
            : "";

        // --- Hold time section ---
        var maxHC = byHold.Count > 0 ? byHold.Max(h => h.Count) : 1;
        var holdRows = string.Concat(byHold.Where(h => h.Count > 0).Select(s =>
        {
            var barW    = maxHC > 0 ? s.Count * 100m / maxHC : 0m;
            var wr      = s.Count > 0 ? s.Wins * 100m / s.Count : 0m;
            var wrColor = wr >= 50 ? "#10b981" : "#f59e0b";
            return $"<tr><td style=\"padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"font-size:11px;color:#94a3b8;width:18%;\">{s.Bucket}</td><td style=\"width:47%;padding:0 10px;\"><div style=\"background:rgba(255,255,255,0.06);border-radius:3px;height:5px;\"><div style=\"background:#FBBF24;height:5px;width:{barW:F0}%;border-radius:3px;\"></div></div></td><td align=\"center\" style=\"font-size:11px;color:#64748b;width:20%;\">{s.Count}</td><td align=\"right\" style=\"font-size:11px;color:{wrColor};width:15%;\">{wr:F0}%K</td></tr></table></td></tr>";
        }));
        var holdSection = holdRows.Length > 0
            ? SH("Tutma Süresi") + $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">{holdRows}</table>"
            : "";

        // --- Winners / Losers ---
        var winnersHtml = string.Concat(topWinners.Take(5).Select(TradeCard));
        var losersHtml  = string.Concat(topLosers.Take(5).Select(TradeCard));
        var winnersSection = winnersHtml.Length > 0
            ? SH("En İyi 5 İşlem") + $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">{winnersHtml}</table>"
            : "";
        var losersSection = losersHtml.Length > 0
            ? SH("En Kötü 5 İşlem") + $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\">{losersHtml}</table>"
            : "";

        // --- Recent trades ---
        var recentRows = string.Concat(recent.Take(10).Select(t =>
            $"<tr><td style=\"padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);\"><table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"font-size:12px;color:#f1f5f9;font-weight:600;width:32%;\">{t.Symbol}</td><td style=\"font-size:11px;color:#64748b;width:33%;\">{t.Reason ?? "—"}</td><td align=\"right\" style=\"font-size:11px;color:#475569;width:20%;\">{t.ClosedAt}</td><td align=\"right\" style=\"font-size:12px;font-weight:700;color:{G(t.PnlPct)};width:15%;\">{P(t.PnlPct)}</td></tr></table></td></tr>"));
        var recentSection = recentRows.Length > 0
            ? SH("Son İşlemler") +
              $"<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td style=\"font-size:10px;color:#475569;padding-bottom:6px;width:32%;\">COİN</td><td style=\"font-size:10px;color:#475569;padding-bottom:6px;width:33%;\">NEDEN</td><td align=\"right\" style=\"font-size:10px;color:#475569;padding-bottom:6px;width:20%;\">ZAMAN</td><td align=\"right\" style=\"font-size:10px;color:#475569;padding-bottom:6px;width:15%;\">P&amp;L</td></tr>{recentRows}</table>"
            : "";

        var appLink = "<p style=\"margin:28px 0 0;font-size:13px;color:#475569;line-height:1.6;\">Detaylı analiz için <a href=\"https://app.nexxbit.com.tr/analysis\" style=\"color:#FBBF24;text-decoration:none;\">Trader Analizi</a> sayfasını ziyaret edin.</p>";

        var body = hero + grid + reasonSection + holdSection + winnersSection + losersSection + recentSection + appLink;
        return Wrap(firstName, $"Günlük Trader Raporu — {dateStr}", body);
    }

    public static string TradeError(string firstName, string symbol, string strategyName, string reason) => Wrap(
        firstName,
        "Canlı Al-Sat Durduruldu",
        $"""
        <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.25);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#ef4444;font-weight:600;">⚠️ Strateji hatası nedeniyle gerçek işlem otomatik durduruldu.</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;">Coin</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#f8fafc;">{symbol}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;">Strateji</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#f8fafc;">{strategyName}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:13px;color:#64748b;">Hata</td>
                  <td align="right" style="font-size:13px;font-weight:600;color:#ef4444;">{reason}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
          Strateji sayfasından API anahtarınızı kontrol edip gerçek işlemi yeniden etkinleştirebilirsiniz.
        </p>
        """
    );

    public static string AccountApproved(string firstName) => Wrap(
        firstName,
        "Hesabınız Onaylandı",
        """
        <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:12px;padding:16px 20px;margin-bottom:24px;">
          <p style="margin:0;font-size:14px;color:#10b981;font-weight:600;">🎉 Hesabınız yönetici tarafından onaylandı.</p>
        </div>
        <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;">
          Artık Nexxbit'e giriş yapabilir ve tüm özelliklere erişebilirsiniz.
        </p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://nexxbit.com.tr/login"
             style="display:inline-block;background:#FBBF24;color:#0b0b0f;font-weight:700;
                    font-size:14px;padding:12px 32px;border-radius:10px;text-decoration:none;">
            Giriş Yap
          </a>
        </div>
        """
    );
}
