using System.Net;
using System.Text.Json;
using FluentValidation;

namespace CriptoMoney.API.Middleware;

public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (ValidationException ex)
        {
            context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            context.Response.ContentType = "application/json";

            var errors = ex.Errors.Select(e => e.ErrorMessage).ToArray();
            var response = new { errors };
            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogWarning(ex, "Yetkisiz erişim denemesi");
            context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"errors\":[\"Bu işlem için yetkiniz bulunmamaktadır.\"]}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Beklenmeyen hata: {Message}", ex.Message);
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"errors\":[\"Sunucu hatası oluştu. Lütfen tekrar deneyin.\"]}");
        }
    }
}
