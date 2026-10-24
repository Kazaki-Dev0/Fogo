namespace Fogo.Api.Models;

public class TipoEquipamento
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string PrefixoSerie { get; set; } = string.Empty;
    public string Icone { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public bool Movel { get; set; }
    public string CamposSchemaJson { get; set; } = string.Empty;

    // Propriedades de Navegação
    public ICollection<Equipamento> Equipamentos { get; set; } = new List<Equipamento>();
}