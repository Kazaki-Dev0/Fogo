namespace Fogo.Api.Models;

public class Telemetria
{
    public long Id { get; set; }
    public int EquipamentoId { get; set; }
    public DateTime Timestamp { get; set; }
    public string Tipo { get; set; } = string.Empty; // Heartbeat ou MudancaSituacao
    public Situacao SituacaoNoMomento { get; set; }
    public decimal? Valor { get; set; }

    // Propriedades de Navegação
    public Equipamento Equipamento { get; set; } = null!;
}