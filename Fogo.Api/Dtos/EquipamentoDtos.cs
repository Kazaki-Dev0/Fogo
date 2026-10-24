using System.ComponentModel.DataAnnotations;
using Fogo.Api.Models;

namespace Fogo.Api.Dtos;

public class EquipamentoMapaDto
{
    public int Id { get; set; }
    public string TipoCodigo { get; set; } = string.Empty;
    public string TipoNome { get; set; } = string.Empty;
    public string NumeroSerie { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public Situacao Situacao { get; set; }
    public NecessidadeManutencao NecessidadeManutencao { get; set; }
    public DateOnly? ProximaManutencao { get; set; }
    public int RegiaoId { get; set; }
    public string Bairro { get; set; } = string.Empty;
    public Orgao Orgao { get; set; }
    public DateTime UltimoHeartbeat { get; set; }
}

public class EquipamentoDetalheDto : EquipamentoMapaDto
{
    public string Cep { get; set; } = string.Empty;
    public string Rua { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string RegiaoNome { get; set; } = string.Empty;
    public object? Caracteristicas { get; set; }
    public List<ManutencaoItemDto> Manutencoes { get; set; } = new();
    public List<AlertaDto> AlertasAtivos { get; set; } = new();
    public DateTime CriadoEm { get; set; }
    public DateTime AtualizadoEm { get; set; }
}

public class EquipamentoSalvarDto
{
    [Required(ErrorMessage = "O código do tipo é obrigatório.")]
    public string TipoCodigo { get; set; } = string.Empty;

    [Required(ErrorMessage = "O número de série é obrigatório.")]
    [StringLength(50)]
    public string NumeroSerie { get; set; } = string.Empty;

    [Required(ErrorMessage = "A marca é obrigatória.")]
    public string Marca { get; set; } = string.Empty;

    [Required(ErrorMessage = "O modelo é obrigatório.")]
    public string Modelo { get; set; } = string.Empty;

    public string Cep { get; set; } = string.Empty;
    public string Rua { get; set; } = string.Empty;
    public string Bairro { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;

    [Required]
    [Range(-90.0, 90.0, ErrorMessage = "Latitude inválida.")]
    public double Latitude { get; set; }

    [Required]
    [Range(-180.0, 180.0, ErrorMessage = "Longitude inválida.")]
    public double Longitude { get; set; }

    [Required]
    public Orgao Orgao { get; set; }

    [Required]
    public Situacao Situacao { get; set; }

    [Required]
    public NecessidadeManutencao NecessidadeManutencao { get; set; }

    public DateOnly? ProximaManutencao { get; set; }
    public object? Caracteristicas { get; set; }
}

public class ManutencaoItemDto
{
    public int Id { get; set; }
    public string Tipo { get; set; } = string.Empty;
    public DateOnly DataPrevista { get; set; }
    public DateOnly? DataRealizada { get; set; }
    public string Observacao { get; set; } = string.Empty;
}

public class AlterarSituacaoDto
{
    [Required(ErrorMessage = "A situação é obrigatória.")]
    public Situacao Situacao { get; set; }
    public string? Observacao { get; set; }
}