using CriptoMoney.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CriptoMoney.Persistence.Configurations;

public class UserWatchlistConfiguration : IEntityTypeConfiguration<UserWatchlist>
{
    public void Configure(EntityTypeBuilder<UserWatchlist> builder)
    {
        builder.HasKey(w => w.Id);
        builder.HasIndex(w => new { w.UserId, w.CoinId }).IsUnique();

        builder.HasOne(w => w.User)
            .WithMany(u => u.Watchlist)
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(w => w.Coin)
            .WithMany(c => c.Watchlists)
            .HasForeignKey(w => w.CoinId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
