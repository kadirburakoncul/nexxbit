using System.Linq.Expressions;
using CriptoMoney.Application.Common.Interfaces;
using CriptoMoney.Persistence.Context;
using Microsoft.EntityFrameworkCore;

namespace CriptoMoney.Persistence.Repositories;

public class Repository<T>(AppDbContext context) : IRepository<T> where T : class
{
    protected readonly DbSet<T> DbSet = context.Set<T>();

    public async Task<T?> GetByIdAsync<TKey>(TKey id, CancellationToken ct = default)
        => await DbSet.FindAsync([id], ct);

    public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await DbSet.FirstOrDefaultAsync(predicate, ct);

    public async Task<List<T>> GetAllAsync(CancellationToken ct = default)
        => await DbSet.ToListAsync(ct);

    public async Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await DbSet.Where(predicate).ToListAsync(ct);

    public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await DbSet.AnyAsync(predicate, ct);

    public async Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default)
        => await DbSet.CountAsync(predicate, ct);

    public void Add(T entity) => DbSet.Add(entity);
    public void Update(T entity) => DbSet.Update(entity);
    public void Remove(T entity) => DbSet.Remove(entity);
}
