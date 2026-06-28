using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserIndicatorSubscriptionConfiguration : IEntityTypeConfiguration<UserIndicatorSubscription>
{
    public void Configure(EntityTypeBuilder<UserIndicatorSubscription> builder)
    {
        builder.HasKey(s => s.Id);
        builder.HasIndex(s => new { s.UserId, s.IndicatorId }).IsUnique();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.Indicator)
            .WithMany()
            .HasForeignKey(s => s.IndicatorId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
