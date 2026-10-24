using System.ComponentModel.DataAnnotations;
using Fogo.Api.Models;

namespace Fogo.Api.Dtos;

public class PaginadoDto<T>
{
    public List<T> Itens { get; set; } = new();
    public int Total { get; set; }
    public int Pagina { get; set; }
    public int Tamanho { get; set; }
}

public class TipoEquipamentoDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public string PrefixoSerie { get; set; } = string.Empty;
    public string Icone { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public bool Movel { get; set; }
    public object? CamposSchema { get; set; }
}

public class RegiaoDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nome { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public class DominiosDto
{
    public List<OpcaoDto> Situacoes { get; set; } = new();
    public List<OpcaoDto> Orgaos { get; set; } = new();
    public List<OpcaoDto> Cargos { get; set; } = new();
    public List<OpcaoDto> StatusAgente { get; set; } = new();
    public List<OpcaoDto> Criticidades { get; set; } = new();
    public List<OpcaoDto> NecessidadesManutencao { get; set; } = new();
    public List<string> Bairros { get; set; } = new();
}

public class OpcaoDto
{
    public string Valor { get; set; } = string.Empty;
    public string Rotulo { get; set; } = string.Empty;
    public string? Cor { get; set; }
}

public class SimularFalhaDto
{
    public int? EquipamentoId { get; set; }

    [Required(ErrorMessage = "O tipo da falha é obrigatório.")]
    public string Tipo { get; set; } = string.Empty; // MauFuncionamento | Furtado | Offline
}

public class RestaurarDto
{
    [Required(ErrorMessage = "O ID do equipamento é obrigatório.")]
    public int EquipamentoId { get; set; }
}