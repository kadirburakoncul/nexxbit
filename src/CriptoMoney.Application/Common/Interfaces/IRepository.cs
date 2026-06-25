using System.Linq.Expressions;

namespace CriptoMoney.Application.Common.Interfaces;

public interface IRepository<T> where T : class
{
    Task<T?> GetByIdAsync<TKey>(TKey id, CancellationToken ct = default);
    Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<List<T>> GetAllAsync(CancellationToken ct = default);
    Task<List<T>> FindAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<bool> AnyAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    Task<int> CountAsync(Expression<Func<T, bool>> predicate, CancellationToken ct = default);
    void Add(T entity);
    void Update(T entity);
    void Remove(T entity);
}
