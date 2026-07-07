using System.Text;
using System.Threading.RateLimiting;
using AspNetCoreRateLimit;
using Microsoft.EntityFrameworkCore;
using CriptoMoney.API.Hubs;
using CriptoMoney.API.Logging;
using CriptoMoney.API.Middleware;
using CriptoMoney.Application;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.BackgroundJobs;
using CriptoMoney.Infrastructure;
using CriptoMoney.Infrastructure.HealthChecks;
using CriptoMoney.Infrastructure.Services;
using CriptoMoney.Persistence;
using CriptoMoney.Persistence.Context;
using CriptoMoney.Persistence.Seed;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

// Serilog
builder.Host.UseSerilog((ctx, lc) =>
    lc.ReadFrom.Configuration(ctx.Configuration));

var configuration = builder.Configuration;

// Clean Architecture layers
builder.Services.AddApplication();
builder.Services.AddPersistence(configuration);
builder.Services.AddInfrastructure(configuration);
builder.Services.AddBackgroundJobs(configuration);

// AutoTradeService
builder.Services.AddScoped<IAutoTradeService, AutoTradeService>();

// CurrentUserService
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
builder.Services.AddSingleton<ICandleHubNotifier, CandleHubNotifier>();
builder.Services.AddScoped<CriptoMoney.Application.Common.Interfaces.IBacktestProgressNotifier, CriptoMoney.API.Hubs.BacktestProgressNotifier>();

// JWT Authentication
var jwtKey = configuration["Jwt:SecretKey"]
    ?? throw new InvalidOperationException("Jwt:SecretKey yapılandırması eksik.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = configuration["Jwt:Issuer"],
            ValidAudience = configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.Zero
        };
        // SignalR WebSocket bağlantıları için token query string'den okunur
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(opts =>
{
    opts.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));
});

// IP tabanlı rate limiting
builder.Services.AddMemoryCache();
builder.Services.Configure<IpRateLimitOptions>(configuration.GetSection("IpRateLimiting"));
builder.Services.AddInMemoryRateLimiting();
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// User bazlı rate limiting (JWT user ID ile partition)
builder.Services.AddRateLimiter(opts =>
{
    opts.RejectionStatusCode = 429;
    // Genel API kullanıcı limiti: 60 req/dk
    opts.AddPolicy("user-general", ctx =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: ctx.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                PermitLimit = 60,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));
    // Backtest limiti: 5 başlatma/5dk
    opts.AddPolicy("backtest", ctx =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: ctx.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "anon",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                Window = TimeSpan.FromMinutes(5),
                SegmentsPerWindow = 5,
                PermitLimit = 5,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));
});

// Controllers + Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "CriptoMoney API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new()
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
    });
    c.AddSecurityRequirement(new()
    {
        {
            new() { Reference = new() { Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme, Id = "Bearer" } },
            []
        }
    });
});

// CORS — sadece https:// originler (http:// güvensiz)
var allowedOrigins = builder.Environment.IsDevelopment()
    ? new[] { "http://localhost:3000", "http://localhost:5173" }
    : new[] { "https://nexxbit.com.tr", "https://www.nexxbit.com.tr", "https://app.nexxbit.com.tr" };

builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins)
              .WithHeaders("Authorization", "Content-Type", "Accept", "X-Requested-With")
              .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
              .AllowCredentials()));

// SignalR
builder.Services.AddSignalR();

// Health checks
builder.Services
    .AddHealthChecks()
    .AddMySql(
        configuration.GetConnectionString("DefaultConnection") ?? "",
        name: "mysql",
        tags: ["db", "mysql"])
    .AddCheck<BinanceHealthCheck>("binance", tags: ["external"])
    .AddCheck<MigrationHealthCheck>("migrations", tags: ["db"])
    .AddHangfire(opts => opts.MinimumAvailableServers = 1, name: "hangfire", tags: ["jobs"]);

var app = builder.Build();

// Migrate + Seed
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var startupLogger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        await db.Database.MigrateAsync();
        await DatabaseSeeder.SeedAsync(db);
        MigrationHealthCheck.ReportSuccess();
    }
    catch (Exception ex)
    {
        MigrationHealthCheck.ReportFailure(ex);
        startupLogger.LogError(ex, "Migration/Seed başarısız — uygulama degraded modda devam ediyor.");
    }
}

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();
app.UseIpRateLimiting();
app.UseRateLimiter();

// React SPA — önce statik dosyaları sun, API route'larını ezip geçme
app.UseDefaultFiles();
app.UseStaticFiles();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
    app.UseHsts();

app.UseHttpsRedirection();
app.UseCors();

// Temel güvenlik header'ları (nginx zaten ekliyor ama uygulama da bağımsız garanti versin)
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    ctx.Response.Headers.Append("X-Frame-Options", "DENY");
    ctx.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    await next();
});
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<CandleHub>("/hubs/candle");
app.MapHub<LogHub>("/hubs/logs");
app.MapHub<BacktestHub>("/hubs/backtest");

// React SPA fallback — /api veya /hubs olmayan tüm rotalar index.html'e düşer
app.MapFallbackToFile("index.html");

// Serilog'a SignalR sink'i ekle — app build'den sonra IHubContext hazır
var logHubCtx = app.Services.GetRequiredService<IHubContext<LogHub>>();
Serilog.Log.Logger = new Serilog.LoggerConfiguration()
    .ReadFrom.Configuration(configuration)
    .WriteTo.Sink(new SignalRLogSink(logHubCtx))
    .CreateLogger();

// Health check endpoints — kimlik doğrulama gerektirmez (uptime monitor için), bu yüzden
// iç hata mesajlarını (DB/migration exception detayları) public yanıta hiç koymuyoruz.
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = async (ctx, report) =>
    {
        ctx.Response.ContentType = "application/json";
        var result = JsonSerializer.Serialize(new
        {
            status = report.Status.ToString(),
            timestamp = DateTime.UtcNow,
            checks = report.Entries.Select(e => new
            {
                name = e.Key,
                status = e.Value.Status.ToString(),
                duration = e.Value.Duration.TotalMilliseconds
            })
        });
        await ctx.Response.WriteAsync(result);
    }
});
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false  // Sadece uygulama ayakta mı?
});

// Hangfire Dashboard — development'ta açık, production'da admin JWT zorunlu
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = app.Environment.IsDevelopment()
        ? []
        : [new CriptoMoney.API.Middleware.HangfireAdminAuthFilter()],
    DashboardTitle = "Nexxbit — Hangfire"
});

// Hangfire recurring job'larını kaydet
try
{
    using var scope = app.Services.CreateScope();
    var recurringManager = scope.ServiceProvider.GetRequiredService<IRecurringJobManager>();
    CriptoMoney.BackgroundJobs.DependencyInjection.RegisterRecurringJobs(recurringManager);
}
catch (Exception ex)
{
    Log.Warning(ex, "Hangfire recurring job kaydı başarısız, uygulama devam ediyor.");
}

app.Run();
