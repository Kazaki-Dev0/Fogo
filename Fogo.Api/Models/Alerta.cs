namespace Fogo.Api.Models;

public class Alerta
{
    public int Id { get; set; }
    public TipoAlerta Tipo { get; set; }
    public Criticidade Criticidade { get; set; }
    public string Titulo { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public StatusAlerta Status { get; set; }
    public int? EquipamentoId { get; set; }
    public int? AgenteId { get; set; }
    public int? RegiaoId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime? ReconhecidoEm { get; set; }
    public DateTime? ResolvidoEm { get; set; }

    // Propriedades de Navegação
    public Equipamento? Equipamento { get; set; }
    public Agente? Agente { get; set; }
    public Regiao? Regiao { get; set; }
}