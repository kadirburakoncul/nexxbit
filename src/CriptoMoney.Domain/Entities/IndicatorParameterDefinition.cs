namespace CriptoMoney.Domain.Entities;

public class IndicatorParameterDefinition
{
    public int Id { get; set; }
    public int IndicatorId { get; set; }
    public string ParameterKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public string DefaultValue { get; set; } = string.Empty;
    public string? MinValue { get; set; }
    public string? MaxValue { get; set; }
    public string? SelectOptions { get; set; }
    public int SortOrder { get; set; } = 0;

    public Indicator Indicator { get; set; } = null!;
    public ICollection<UserIndicatorParameterValue> UserValues { get; set; } = [];
}
