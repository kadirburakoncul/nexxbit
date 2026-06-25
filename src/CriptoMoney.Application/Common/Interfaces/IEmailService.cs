namespace CriptoMoney.Application.Common.Interfaces;

public record EmailMessage(
    string To,
    string Subject,
    string HtmlBody,
    string? TextBody = null
);

public interface IEmailService
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
    Task SendAsync(string to, string subject, string htmlBody, CancellationToken ct = default);
}
