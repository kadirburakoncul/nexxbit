using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserIndicatorSettingConfiguration : IEntityTypeConfiguration<UserIndicatorSetting>
{
    public void Configure(EntityTypeBuilder<UserIndicatorSetting> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Weight).HasPrecision(5, 2);

        builder.HasIndex(s => new { s.UserId, s.IndicatorId, s.CoinId }).IsUnique();

        builder.HasOne(s => s.User)
            .WithMany(u => u.IndicatorSettings)
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Indicator)
            .WithMany(i => i.UserSettings)
            .HasForeignKey(s => s.IndicatorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
