using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class CandleDataConfiguration : IEntityTypeConfiguration<CandleData>
{
    public void Configure(EntityTypeBuilder<CandleData> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Timeframe).HasMaxLength(5).IsRequired();
        builder.Property(c => c.Open).HasPrecision(28, 8);
        builder.Property(c => c.High).HasPrecision(28, 8);
        builder.Property(c => c.Low).HasPrecision(28, 8);
        builder.Property(c => c.Close).HasPrecision(28, 8);
        builder.Property(c => c.Volume).HasPrecision(28, 8);
        builder.Property(c => c.QuoteVolume).HasPrecision(28, 8);

        builder.HasIndex(c => new { c.CoinId, c.Timeframe, c.OpenTime })
            .IsUnique()
            .HasDatabaseName("IX_CandleData_CoinId_Timeframe_OpenTime");

        builder.HasOne(c => c.Coin)
            .WithMany(co => co.Candles)
            .HasForeignKey(c => c.CoinId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
