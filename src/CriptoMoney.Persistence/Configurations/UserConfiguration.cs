using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(512).IsRequired();
        builder.Property(u => u.FirstName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.EmailVerifyToken).HasMaxLength(256);
        builder.Property(u => u.RefreshToken).HasMaxLength(512);

        builder.HasIndex(u => u.Email).IsUnique();
        builder.HasIndex(u => new { u.IsActive, u.IsDeleted });

        builder.HasOne(u => u.BinanceAccount)
            .WithOne(b => b.User)
            .HasForeignKey<UserBinanceAccount>(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(u => u.RiskSettings)
            .WithOne(r => r.User)
            .HasForeignKey<UserRiskSettings>(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}
