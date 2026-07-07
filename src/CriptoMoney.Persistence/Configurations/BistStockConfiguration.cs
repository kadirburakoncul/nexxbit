using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistStockConfiguration : IEntityTypeConfiguration<BistStock>
{
    public void Configure(EntityTypeBuilder<BistStock> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Symbol).HasMaxLength(20).IsRequired();
        builder.Property(s => s.DisplayName).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Sector).HasMaxLength(50);

        builder.HasIndex(s => s.Symbol).IsUnique();
    }
}
