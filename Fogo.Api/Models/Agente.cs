namespace Fogo.Api.Models;

public class Agente
{
    public int Id { get; set; }
    public string Nome { get; set; } = string.Empty;
    public string Matricula { get; set; } = string.Empty;
    public CargoAgente Cargo { get; set; }
    public Orgao Orgao { get; set; }
    public string Telefone { get; set; } = string.Empty;
    public StatusAgente Status { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime UltimaPosicaoEm { get; set; }
    public int RegiaoId { get; set; }
    public int? EquipamentoVinculadoId { get; set; }

    // Propriedades de Navegação
    public Regiao Regiao { get; set; } = null!;
    public Equipamento? EquipamentoVinculado { get; set; }
    public ICollection<Alerta> Alertas { get; set; } = new List<Alerta>();
}