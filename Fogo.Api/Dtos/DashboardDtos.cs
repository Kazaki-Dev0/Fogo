using Fogo.Api.Models;

namespace Fogo.Api.Dtos;

public class ResumoDto
{
    public DateTime GeradoEm { get; set; }
    public int TotalEquipamentos { get; set; }
    public int NaoInstalados { get; set; }
    public int Operacionais { get; set; }
    public int Indisponiveis { get; set; }
    public double PercentualDisponibilidade { get; set; }
    public int ManutencaoImediata { get; set; }
    public int ManutencaoProxima { get; set; }
    public int TotalAgentes { get; set; }
    public int AgentesEmCampo { get; set; }
    public int AlertasAtivos { get; set; }
    public int AlertasCriticos { get; set; }
    public int OcorrenciasHoje { get; set; }
    public List<PorTipoDto> PorTipo { get; set; } = new();
    public List<PorSituacaoDto> PorSituacao { get; set; } = new();
    public List<PorRegiaoDto> PorRegiao { get; set; } = new();
}

public class PorTipoDto
{
    public string TipoCodigo { get; set; } = string.Empty;
    public string TipoNome { get; set; } = string.Empty;
    public string Icone { get; set; } = string.Empty;
    public string Cor { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Operacionais { get; set; }
    public int Indisponiveis { get; set; }
}

public class PorSituacaoDto
{
    public Situacao Situacao { get; set; }
    public int Total { get; set; }
}

public class PorRegiaoDto
{
    public int RegiaoId { get; set; }
    public string Nome { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int Total { get; set; }
    public int Operacionais { get; set; }
    public double PercentualDisponibilidade { get; set; }
    public int AlertasAtivos { get; set; }
    public int AlertasCriticos { get; set; }
    public NivelRegiao Nivel { get; set; }
}

public class ManutencaoDto
{
    public int EquipamentoId { get; set; }
    public string NumeroSerie { get; set; } = string.Empty;
    public string TipoCodigo { get; set; } = string.Empty;
    public string TipoNome { get; set; } = string.Empty;
    public Situacao Situacao { get; set; }
    public NecessidadeManutencao NecessidadeManutencao { get; set; }
    public DateOnly ProximaManutencao { get; set; }
    public int DiasRestantes { get; set; }
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public string Bairro { get; set; } = string.Empty;
}