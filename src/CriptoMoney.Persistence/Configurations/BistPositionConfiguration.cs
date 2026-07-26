using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistPositionConfiguration : IEntityTypeConfiguration<BistPosition>
{
    public void Configure(EntityTypeBuilder<BistPosition> builder)
    {
        builder.HasKey(p => p.Id);
        builder.Property(p => p.CloseReason).HasMaxLength(200);
        builder.Property(p => p.EntryPrice).HasPrecision(18, 6);
        builder.Property(p => p.PeakPrice).HasPrecision(18, 6);
        builder.Property(p => p.StopLossPrice).HasPrecision(18, 6);
        builder.Property(p => p.ClosePrice).HasPrecision(18, 6);
        builder.Property(p => p.RealizedPnlPct).HasPrecision(10, 4);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.BistStrategy)
            .WithMany()
            .HasForeignKey(p => p.BistStrategyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(p => p.BistStock)
            .WithMany()
            .HasForeignKey(p => p.BistStockId)
            .OnDelete(DeleteBehavior.Cascade);

        // Aynı strateji+hisse için aynı anda tek açık pozisyon
        builder.HasIndex(p => new { p.BistStrategyId, p.BistStockId, p.Status });
        builder.HasIndex(p => p.OpenedAt);
    }
}
