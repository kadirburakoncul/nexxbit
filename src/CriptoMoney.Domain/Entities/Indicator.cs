namespace CriptoMoney.Domain.Entities;

public class Indicator : BaseEntity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? HowItWorks { get; set; }
    public string Category { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public decimal DefaultWeight { get; set; } = 1.0m;
    public bool IsSystemDefault { get; set; } = false;
    public bool IsActive { get; set; } = true;

    public ICollection<IndicatorParameterDefinition> ParameterDefinitions { get; set; } = [];
    public ICollection<UserIndicatorSetting> UserSettings { get; set; } = [];
}
