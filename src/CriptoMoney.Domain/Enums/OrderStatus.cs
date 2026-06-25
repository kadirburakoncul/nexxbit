namespace CriptoMoney.Domain.Enums;

public enum OrderStatus
{
    Pending = 0,
    Open = 1,
    Filled = 2,
    Cancelled = 3,
    Rejected = 4,
    PartiallyFilled = 5
}
