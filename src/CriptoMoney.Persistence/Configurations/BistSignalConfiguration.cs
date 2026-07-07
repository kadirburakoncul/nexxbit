using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistSignalConfiguration : IEntityTypeConfiguration<BistSignal>
{
    public void Configure(EntityTypeBuilder<BistSignal> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Reason).HasMaxLength(300);

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.BistStrategy)
            .WithMany()
            .HasForeignKey(s => s.BistStrategyId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.BistStock)
            .WithMany(st => st.Signals)
            .HasForeignKey(s => s.BistStockId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.CandleTime);
        builder.HasIndex(s => new { s.BistStrategyId, s.BistStockId, s.CandleTime }).IsUnique();
    }
}
