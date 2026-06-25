namespace CriptoMoney.Domain.Entities;

public class UserIndicatorParameterValue
{
    public Guid Id { get; set; } = Guid.CreateVersion7();
    public Guid UserIndicatorSettingId { get; set; }
    public int ParameterDefinitionId { get; set; }
    public string Value { get; set; } = string.Empty;

    public UserIndicatorSetting UserIndicatorSetting { get; set; } = null!;
    public IndicatorParameterDefinition ParameterDefinition { get; set; } = null!;
}
