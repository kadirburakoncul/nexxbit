using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class MarketDataExportConfiguration : IEntityTypeConfiguration<MarketDataExport>
{
    public void Configure(EntityTypeBuilder<MarketDataExport> b)
    {
        b.HasKey(e => e.Id);
        b.Property(e => e.Name).HasMaxLength(120);
        b.Property(e => e.Timeframe).HasMaxLength(10);
        b.Property(e => e.Format).HasMaxLength(10);
        b.Property(e => e.FilePath).HasMaxLength(500);
        b.Property(e => e.DataQualityNote).HasMaxLength(4000);
        b.Property(e => e.ErrorMessage).HasMaxLength(1000);

        b.HasOne(e => e.User).WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(e => new { e.UserId, e.CreatedAt });
    }
}

public class IndicatorOptimizationConfiguration : IEntityTypeConfiguration<IndicatorOptimization>
{
    public void Configure(EntityTypeBuilder<IndicatorOptimization> b)
    {
        b.HasKey(o => o.Id);
        b.Property(o => o.Name).HasMaxLength(120);
        b.Property(o => o.Timeframe).HasMaxLength(10);
        b.Property(o => o.IndicatorFamily).HasMaxLength(20);
        b.Property(o => o.Verdict).HasMaxLength(2000);
        b.Property(o => o.ErrorMessage).HasMaxLength(1000);

        b.Property(o => o.CommissionPct).HasPrecision(8, 4);
        b.Property(o => o.BestReturnPct).HasPrecision(18, 4);
        b.Property(o => o.BestWinRate).HasPrecision(8, 2);
        b.Property(o => o.BuyHoldReturnPct).HasPrecision(18, 4);
        b.Property(o => o.InSampleReturnPct).HasPrecision(18, 4);
        b.Property(o => o.OutOfSampleReturnPct).HasPrecision(18, 4);

        b.HasOne(o => o.User).WithMany()
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasIndex(o => new { o.UserId, o.CreatedAt });
    }
}
