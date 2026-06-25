using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class IndicatorConfiguration : IEntityTypeConfiguration<Indicator>
{
    public void Configure(EntityTypeBuilder<Indicator> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Name).HasMaxLength(50).IsRequired();
        builder.Property(i => i.DisplayName).HasMaxLength(100).IsRequired();
        builder.Property(i => i.Category).HasMaxLength(50).IsRequired();
        builder.Property(i => i.ClassName).HasMaxLength(200).IsRequired();
        builder.Property(i => i.Description).HasMaxLength(500);
        builder.Property(i => i.DefaultWeight).HasPrecision(5, 2);

        builder.HasIndex(i => i.Name).IsUnique();
    }
}
