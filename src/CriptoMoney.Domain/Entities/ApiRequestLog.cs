namespace CriptoMoney.Domain.Entities;

public class ApiRequestLog
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string HttpMethod { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public int DurationMs { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? RequestBody { get; set; }
    public string? ResponseBody { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
