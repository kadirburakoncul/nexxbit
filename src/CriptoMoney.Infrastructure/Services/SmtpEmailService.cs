using System.Net;
using System.Net.Mail;
using CriptoMoney.Application.Common.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CriptoMoney.Infrastructure.Services;

public class SmtpEmailService(
    IConfiguration configuration,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    public Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default)
        => SendAsync(new EmailMessage(to, subject, htmlBody), ct);

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var section = configuration.GetSection("Email");
        var host = section["Smtp:Host"];
        var portStr = section["Smtp:Port"];
        var user = section["Smtp:Username"];
        var pass = section["Smtp:Password"];
        var fromAddr = section["From:Address"] ?? "info.nexxbit@gmail.com";
        var fromName = section["From:Name"] ?? "Nexxbit";

        if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(user))
        {
            logger.LogWarning("SMTP yapılandırması eksik — e-posta gönderilmedi. To={To}", message.To);
            return;
        }

        try
        {
            using var smtp = new SmtpClient(host, int.Parse(portStr ?? "587"))
            {
                EnableSsl = true,
                Credentials = new NetworkCredential(user, pass),
                Timeout = 10_000,
            };

            using var mail = new MailMessage
            {
                From = new MailAddress(fromAddr, fromName),
                Subject = message.Subject,
                Body = message.HtmlBody,
                IsBodyHtml = true,
            };
            mail.To.Add(message.To);

            if (!string.IsNullOrEmpty(message.TextBody))
                mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
                    message.TextBody, null, "text/plain"));

            await smtp.SendMailAsync(mail, ct);
            logger.LogInformation("E-posta gönderildi: {To} / {Subject}", message.To, message.Subject);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "E-posta gönderilemedi: {To} / {Subject}", message.To, message.Subject);
        }
    }
}
