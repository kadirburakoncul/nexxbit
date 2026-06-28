using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserStrategyConfiguration : IEntityTypeConfiguration<UserStrategy>
{
    public void Configure(EntityTypeBuilder<UserStrategy> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Name).HasMaxLength(100).IsRequired();
        builder.Property(s => s.Timeframe).HasMaxLength(5).IsRequired();
        builder.Property(s => s.Ema200Timeframe).HasMaxLength(5).IsRequired();
        builder.Property(s => s.TakeProfitPct).HasPrecision(5, 2);
        builder.Property(s => s.MinVolumeUsdt).HasPrecision(18, 2);
        builder.Property(s => s.BuyThreshold).HasPrecision(5, 2);
        builder.Property(s => s.SellThreshold).HasPrecision(5, 2);
        builder.Property(s => s.StrongSellThreshold).HasPrecision(5, 2);

        builder.HasIndex(s => new { s.UserId, s.IsActive });

        builder.HasOne(s => s.User)
            .WithMany(u => u.Strategies)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Coin)
            .WithMany()
            .HasForeignKey(s => s.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
