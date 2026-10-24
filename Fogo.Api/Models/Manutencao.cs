namespace Fogo.Api.Models;

public class Manutencao
{
    public int Id { get; set; }
    public int EquipamentoId { get; set; }
    public string Tipo { get; set; } = string.Empty; // Imediata, Agendada ou Periodica
    public DateOnly DataPrevista { get; set; }
    public DateOnly? DataRealizada { get; set; }
    public string Observacao { get; set; } = string.Empty;

    // Propriedades de Navegação
    public Equipamento Equipamento { get; set; } = null!;
}