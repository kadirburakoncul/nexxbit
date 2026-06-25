using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserRiskSettingsConfiguration : IEntityTypeConfiguration<UserRiskSettings>
{
    public void Configure(EntityTypeBuilder<UserRiskSettings> builder)
    {
        builder.HasKey(r => r.Id);
        builder.Property(r => r.MaxDailyLossUsdt).HasPrecision(18, 2);
        builder.Property(r => r.MaxDailyLossPct).HasPrecision(5, 2);
        builder.Property(r => r.MaxPositionSizeUsdt).HasPrecision(18, 2);
        builder.Property(r => r.MaxPositionSizePct).HasPrecision(5, 2);
        builder.Property(r => r.DefaultStopLossPct).HasPrecision(5, 2);
        builder.Property(r => r.DefaultTakeProfitPct).HasPrecision(5, 2);
        builder.Property(r => r.DailyLossUsedUsdt).HasPrecision(18, 2);
        builder.Property(r => r.AllowedCoinIds).HasColumnType("nvarchar(max)");
        builder.Property(r => r.BlockedCoinIds).HasColumnType("nvarchar(max)");
    }
}
