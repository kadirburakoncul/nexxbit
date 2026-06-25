namespace CriptoMoney.Application.Common.Models;

public class Result
{
    protected Result(bool succeeded, IEnumerable<string> errors)
    {
        Succeeded = succeeded;
        Errors = [.. errors];
    }

    public bool Succeeded { get; }
    public string[] Errors { get; }

    public static Result Success() => new(true, []);
    public static Result Failure(params string[] errors) => new(false, errors);
    public static Result Failure(IEnumerable<string> errors) => new(false, errors);
}

public class Result<T> : Result
{
    private Result(bool succeeded, T? data, IEnumerable<string> errors)
        : base(succeeded, errors)
    {
        Data = data;
    }

    public T? Data { get; }

    public static Result<T> Success(T data) => new(true, data, []);
    public new static Result<T> Failure(params string[] errors) => new(false, default, errors);
    public new static Result<T> Failure(IEnumerable<string> errors) => new(false, default, errors);
}
