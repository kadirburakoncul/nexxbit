using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistStrategyStockConfiguration : IEntityTypeConfiguration<BistStrategyStock>
{
    public void Configure(EntityTypeBuilder<BistStrategyStock> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.LastCheckedReason).HasMaxLength(300);

        builder.HasOne(s => s.BistStrategy)
            .WithMany(st => st.StrategyStocks)
            .HasForeignKey(s => s.BistStrategyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.BistStock)
            .WithMany(st => st.StrategyStocks)
            .HasForeignKey(s => s.BistStockId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => new { s.BistStrategyId, s.BistStockId }).IsUnique();
    }
}
