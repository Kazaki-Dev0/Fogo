using System.ComponentModel.DataAnnotations;
using Fogo.Api.Models;

namespace Fogo.Api.Dtos;

public class AgenteDto
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
    public string RegiaoNome { get; set; } = string.Empty;
    public int? EquipamentoVinculadoId { get; set; }
}

public class AgenteSalvarDto
{
    [Required(ErrorMessage = "O nome é obrigatório.")]
    public string Nome { get; set; } = string.Empty;

    [Required(ErrorMessage = "A matrícula é obrigatória.")]
    public string Matricula { get; set; } = string.Empty;

    [Required]
    public CargoAgente Cargo { get; set; }

    [Required]
    public Orgao Orgao { get; set; }

    public string Telefone { get; set; } = string.Empty;

    [Required]
    public StatusAgente Status { get; set; }

    [Required]
    [Range(-90.0, 90.0)]
    public double Latitude { get; set; }

    [Required]
    [Range(-180.0, 180.0)]
    public double Longitude { get; set; }

    public int? EquipamentoVinculadoId { get; set; }
}

public class AlterarStatusAgenteDto
{
    [Required(ErrorMessage = "O status é obrigatório.")]
    public StatusAgente Status { get; set; }
}