using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class BalanceSnapshotConfiguration : IEntityTypeConfiguration<BalanceSnapshot>
{
    public void Configure(EntityTypeBuilder<BalanceSnapshot> builder)
    {
        builder.HasKey(b => b.Id);
        builder.Property(b => b.TotalValueUsdt).HasPrecision(18, 2);
        builder.Property(b => b.Assets).HasColumnType("nvarchar(max)");

        builder.HasIndex(b => new { b.UserId, b.SnapshotAt });

        builder.HasOne(b => b.User)
            .WithMany(u => u.BalanceSnapshots)
            .HasForeignKey(b => b.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
