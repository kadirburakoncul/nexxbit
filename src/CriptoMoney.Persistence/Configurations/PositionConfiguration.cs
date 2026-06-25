using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.EntryPrice).HasPrecision(28, 8);
        builder.Property(p => p.EntryQuantity).HasPrecision(28, 8);
        builder.Property(p => p.EntryValueUsdt).HasPrecision(28, 8);
        builder.Property(p => p.StopLossPrice).HasPrecision(28, 8);
        builder.Property(p => p.TakeProfitPrice).HasPrecision(28, 8);
        builder.Property(p => p.TrailingStopPct).HasPrecision(5, 2);
        builder.Property(p => p.TrailingStopHighWatermark).HasPrecision(28, 8);
        builder.Property(p => p.ClosePrice).HasPrecision(28, 8);
        builder.Property(p => p.CloseValueUsdt).HasPrecision(28, 8);
        builder.Property(p => p.RealizedPnl).HasPrecision(28, 8);
        builder.Property(p => p.RealizedPnlPct).HasPrecision(8, 4);

        builder.HasIndex(p => new { p.UserId, p.Status });
        builder.HasIndex(p => new { p.UserId, p.CoinId, p.Status });

        builder.HasOne(p => p.EntryOrder)
            .WithMany()
            .HasForeignKey(p => p.EntryOrderId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(p => p.CloseOrder)
            .WithMany()
            .HasForeignKey(p => p.CloseOrderId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(p => p.User)
            .WithMany(u => u.Positions)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Coin)
            .WithMany()
            .HasForeignKey(p => p.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
