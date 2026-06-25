using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class TradeSignalConfiguration : IEntityTypeConfiguration<TradeSignal>
{
    public void Configure(EntityTypeBuilder<TradeSignal> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Timeframe).HasMaxLength(5).IsRequired();
        builder.Property(s => s.TotalScore).HasPrecision(8, 2);
        builder.Property(s => s.Price).HasPrecision(28, 8);
        builder.Property(s => s.IndicatorScores).HasColumnType("nvarchar(max)");

        builder.HasIndex(s => new { s.UserId, s.CreatedAt });
        builder.HasIndex(s => new { s.UserId, s.CoinId });
        builder.HasIndex(s => s.Direction);

        builder.HasOne(s => s.User)
            .WithMany(u => u.Signals)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Strategy)
            .WithMany(st => st.Signals)
            .HasForeignKey(s => s.StrategyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Coin)
            .WithMany()
            .HasForeignKey(s => s.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
