namespace Fogo.Api.Models;

public class Ocorrencia
{
    public int Id { get; set; }
    public TipoOcorrencia Tipo { get; set; }
    public int Gravidade { get; set; } // De 1 a 3
    public int RegiaoId { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public DateTime DataHora { get; set; }

    // Propriedades de Navegação
    public Regiao Regiao { get; set; } = null!;
}