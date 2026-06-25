using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BacktestRunConfiguration : IEntityTypeConfiguration<BacktestRun>
{
    public void Configure(EntityTypeBuilder<BacktestRun> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.Name).HasMaxLength(200);
        builder.Property(r => r.Timeframe).HasMaxLength(5).IsRequired();
        builder.Property(r => r.CoinIds).HasColumnType("nvarchar(max)");
        builder.Property(r => r.StrategyConfig).HasColumnType("nvarchar(max)");
        builder.Property(r => r.ErrorMessage).HasMaxLength(2000);
        builder.Property(r => r.InitialCapital).HasPrecision(18, 2);
        builder.Property(r => r.CommissionRate).HasPrecision(6, 5);
        builder.Property(r => r.StopLossPct).HasPrecision(5, 2);
        builder.Property(r => r.TakeProfitPct).HasPrecision(5, 2);
        builder.Property(r => r.FinalCapital).HasPrecision(18, 2);
        builder.Property(r => r.NetPnl).HasPrecision(18, 2);
        builder.Property(r => r.NetPnlPct).HasPrecision(8, 4);
        builder.Property(r => r.WinRate).HasPrecision(5, 2);
        builder.Property(r => r.MaxDrawdown).HasPrecision(5, 2);
        builder.Property(r => r.SharpeRatio).HasPrecision(8, 4);

        builder.HasIndex(r => new { r.UserId, r.Status });

        builder.HasOne(r => r.User)
            .WithMany(u => u.BacktestRuns)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
