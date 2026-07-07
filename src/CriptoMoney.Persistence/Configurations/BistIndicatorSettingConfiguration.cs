using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BistIndicatorSettingConfiguration : IEntityTypeConfiguration<BistIndicatorSetting>
{
    public void Configure(EntityTypeBuilder<BistIndicatorSetting> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.T3Factor).HasPrecision(5, 2);
        builder.Property(s => s.RsiBuyThreshold).HasPrecision(5, 2);

        builder.HasOne(s => s.User)
            .WithOne()
            .HasForeignKey<BistIndicatorSetting>(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.UserId).IsUnique();
    }
}
