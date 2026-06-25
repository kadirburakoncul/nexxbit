using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class TradeOrderConfiguration : IEntityTypeConfiguration<TradeOrder>
{
    public void Configure(EntityTypeBuilder<TradeOrder> builder)
    {
        builder.HasKey(o => o.Id);
        builder.Property(o => o.ClientOrderId).HasMaxLength(100);
        builder.Property(o => o.CommissionAsset).HasMaxLength(10);
        builder.Property(o => o.Quantity).HasPrecision(28, 8);
        builder.Property(o => o.Price).HasPrecision(28, 8);
        builder.Property(o => o.FilledQuantity).HasPrecision(28, 8);
        builder.Property(o => o.FilledPrice).HasPrecision(28, 8);
        builder.Property(o => o.Commission).HasPrecision(28, 8);
        builder.Property(o => o.ErrorMessage).HasMaxLength(1000);

        builder.HasIndex(o => new { o.UserId, o.CreatedAt });
        builder.HasIndex(o => o.BinanceOrderId);
        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => new { o.UserId, o.CoinId, o.Status });

        builder.HasOne(o => o.User)
            .WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(o => o.Signal)
            .WithMany(s => s.Orders)
            .HasForeignKey(o => o.SignalId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(o => o.Coin)
            .WithMany()
            .HasForeignKey(o => o.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
