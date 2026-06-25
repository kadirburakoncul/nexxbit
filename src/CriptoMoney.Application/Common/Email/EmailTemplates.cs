namespace CriptoMoney.Application.Common.Email;

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
}
