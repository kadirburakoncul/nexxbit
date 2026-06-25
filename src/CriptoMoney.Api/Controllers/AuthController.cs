using CriptoMoney.Application.Features.Auth.Commands.ForgotPassword;
using CriptoMoney.Application.Features.Auth.Commands.Login;
using CriptoMoney.Application.Features.Auth.Commands.Logout;
using CriptoMoney.Application.Features.Auth.Commands.RefreshToken;
using CriptoMoney.Application.Features.Auth.Commands.Register;
using CriptoMoney.Application.Features.Auth.Commands.ResetPassword;
using CriptoMoney.Application.Features.Auth.Commands.VerifyEmail;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CriptoMoney.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(IMediator mediator) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> Register([FromBody] RegisterCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(result.Data);
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        if (!result.Succeeded)
            return Unauthorized(new { errors = result.Errors });

        return Ok(result.Data);
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<IActionResult> Refresh([FromBody] RefreshTokenCommand command, CancellationToken ct)
    {
        var result = await mediator.Send(command, ct);
        if (!result.Succeeded)
            return Unauthorized(new { errors = result.Errors });

        return Ok(result.Data);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout(CancellationToken ct)
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)
                          ?? User.FindFirst("sub");
        if (userIdClaim is null || !Guid.TryParse(userIdClaim.Value, out var userId))
            return Unauthorized();

        await mediator.Send(new LogoutCommand(userId), ct);
        return NoContent();
    }

    [HttpPost("verify-email")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new VerifyEmailCommand(request.Token), ct);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(new { message = "E-posta adresiniz doğrulandı." });
    }

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        await mediator.Send(new ForgotPasswordCommand(request.Email), ct);
        return Ok(new { message = "E-posta adresiniz kayıtlıysa şifre sıfırlama bağlantısı gönderildi." });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new ResetPasswordCommand(request.Token, request.NewPassword), ct);
        if (!result.Succeeded)
            return BadRequest(new { errors = result.Errors });

        return Ok(new { message = "Şifreniz başarıyla güncellendi." });
    }
}

public record VerifyEmailRequest(string Token);
public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);
