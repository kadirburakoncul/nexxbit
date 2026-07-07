using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistStrategyConfiguration : IEntityTypeConfiguration<BistStrategy>
{
    public void Configure(EntityTypeBuilder<BistStrategy> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Timeframe).HasMaxLength(10).IsRequired();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.UserId);
        builder.HasIndex(s => s.IsActive);
    }
}
