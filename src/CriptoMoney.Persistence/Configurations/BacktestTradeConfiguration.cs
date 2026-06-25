using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BacktestTradeConfiguration : IEntityTypeConfiguration<BacktestTrade>
{
    public void Configure(EntityTypeBuilder<BacktestTrade> builder)
    {
        builder.HasKey(t => t.Id);
        builder.Property(t => t.EntryPrice).HasPrecision(28, 8);
        builder.Property(t => t.ExitPrice).HasPrecision(28, 8);
        builder.Property(t => t.Quantity).HasPrecision(28, 8);
        builder.Property(t => t.Commission).HasPrecision(28, 8);
        builder.Property(t => t.PnlUsdt).HasPrecision(18, 2);
        builder.Property(t => t.PnlPct).HasPrecision(8, 4);
        builder.Property(t => t.EntryScore).HasPrecision(8, 2);
        builder.Property(t => t.IndicatorScores).HasColumnType("nvarchar(max)");

        builder.HasIndex(t => t.BacktestRunId);

        builder.HasOne(t => t.BacktestRun)
            .WithMany(r => r.Trades)
            .HasForeignKey(t => t.BacktestRunId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(t => t.Coin)
            .WithMany()
            .HasForeignKey(t => t.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
