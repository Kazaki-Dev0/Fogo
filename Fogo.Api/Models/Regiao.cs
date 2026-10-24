namespace Fogo.Api.Models;

public class Regiao
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    // Propriedades de Navegação
    public ICollection<Equipamento> Equipamentos { get; set; } = new List<Equipamento>();
    public ICollection<Agente> Agentes { get; set; } = new List<Agente>();
    public ICollection<Alerta> Alertas { get; set; } = new List<Alerta>();
    public ICollection<Ocorrencia> Ocorrencias { get; set; } = new List<Ocorrencia>();
}