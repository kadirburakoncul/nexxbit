using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
        builder.Property(n => n.Body).HasMaxLength(1000).IsRequired();
        builder.Property(n => n.Payload).HasColumnType("nvarchar(max)");

        builder.HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
        builder.HasIndex(n => n.IsSent).HasFilter("[IsSent] = 0");
    }
}
