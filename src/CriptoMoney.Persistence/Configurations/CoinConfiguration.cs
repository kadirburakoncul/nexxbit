using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class CoinConfiguration : IEntityTypeConfiguration<Coin>
{
    public void Configure(EntityTypeBuilder<Coin> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Symbol).HasMaxLength(20).IsRequired();
        builder.Property(c => c.BaseAsset).HasMaxLength(10).IsRequired();
        builder.Property(c => c.QuoteAsset).HasMaxLength(10).IsRequired();
        builder.Property(c => c.DisplayName).HasMaxLength(50).IsRequired();

        builder.HasIndex(c => c.Symbol).IsUnique();
        builder.HasIndex(c => c.IsActive);
    }
}
