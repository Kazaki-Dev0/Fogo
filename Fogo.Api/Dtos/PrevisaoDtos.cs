using Fogo.Api.Models;

namespace Fogo.Api.Dtos;

public class ExplicacaoDto
{
    public string OQuePreve { get; set; } = string.Empty;
    public List<string> DadosUsados { get; set; } = new();
    public string ComoAjuda { get; set; } = string.Empty;
}

public class FaixaHorariaDto
{
    public int Indice { get; set; }
    public string Rotulo { get; set; } = string.Empty;
}

public class RiscoItemDto
{
    public int RegiaoId { get; set; }
    public string RegiaoNome { get; set; } = string.Empty;
    public int FaixaIndice { get; set; }
    public string FaixaRotulo { get; set; } = string.Empty;
    public int Score { get; set; }
    public NivelRisco Nivel { get; set; }
    public List<string> Fatores { get; set; } = new();
}

public class RiscoResumoRegiaoDto
{
    public int RegiaoId { get; set; }
    public string RegiaoNome { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int ScoreMaximo { get; set; }
    public NivelRisco NivelMaximo { get; set; }
    public string FaixaPico { get; set; } = string.Empty;
}

public class RiscoRegioesDto
{
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
    public string Data { get; set; } = string.Empty;
    public string DiaSemana { get; set; } = string.Empty;
    public List<FaixaHorariaDto> Faixas { get; set; } = new();
    public List<RiscoItemDto> Itens { get; set; } = new();
    public List<RiscoResumoRegiaoDto> ResumoRegioes { get; set; } = new();
    public int TotalAlto { get; set; }
    public ExplicacaoDto Explicacao { get; set; } = new();
}

public class DemandaHoraDto
{
    public int Hora { get; set; }
    public int? Hoje { get; set; }
    public double Previsto { get; set; }
    public double MediaSemana { get; set; }
    public int AgentesRecomendados { get; set; }
}

public class DemandaPicoDto
{
    public int Hora { get; set; }
    public double Previsto { get; set; }
    public int AgentesRecomendados { get; set; }
}

public class DemandaAgentesDto
{
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
    public string DataPrevista { get; set; } = string.Empty;
    public int AgentesEmCampoAtual { get; set; }
    public List<DemandaHoraDto> Horas { get; set; } = new();
    public List<DemandaPicoDto> Picos { get; set; } = new();
    public ExplicacaoDto Explicacao { get; set; } = new();
}

public class ManutencaoPreditivaItemDto
{
    public int EquipamentoId { get; set; }
    public string NumeroSerie { get; set; } = string.Empty;
    public string TipoCodigo { get; set; } = string.Empty;
    public string TipoNome { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Bairro { get; set; } = string.Empty;
    public int RegiaoId { get; set; }
    public Situacao Situacao { get; set; }
    public int Score { get; set; }
    public NivelRisco Nivel { get; set; }
    public List<string> Fatores { get; set; } = new();
}

public class ManutencaoPreditivaDto
{
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
    public int TotalAvaliados { get; set; }
    public int EmRisco { get; set; }
    public double PercentualEmRisco { get; set; }
    public int LimiteRisco { get; set; } = 60;
    public List<ManutencaoPreditivaItemDto> Itens { get; set; } = new();
    public ExplicacaoDto Explicacao { get; set; } = new();
}

public class AnomaliaItemDto
{
    public int RegiaoId { get; set; }
    public string RegiaoNome { get; set; } = string.Empty;
    public DateTime Inicio { get; set; }
    public int Contagem { get; set; }
    public double Esperado { get; set; }
    public double DesvioPadrao { get; set; }
    public double Z { get; set; }
    public string Mensagem { get; set; } = string.Empty;
}

public class AnomaliasDto
{
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
    public int Dias { get; set; }
    public int Total { get; set; }
    public List<AnomaliaItemDto> Itens { get; set; } = new();
    public ExplicacaoDto Explicacao { get; set; } = new();
}

public class RecomendacaoItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Prioridade { get; set; } = string.Empty; // Alta, Media, Baixa
    public string Categoria { get; set; } = string.Empty;  // Reforco, Manutencao, Anomalia, Operacao
    public string Titulo { get; set; } = string.Empty;
    public string Descricao { get; set; } = string.Empty;
    public int? RegiaoId { get; set; }
    public int? EquipamentoId { get; set; }
    public List<string> Motivos { get; set; } = new();
}

public class RecomendacoesDto
{
    public DateTime GeradoEm { get; set; } = DateTime.UtcNow;
    public int Total { get; set; }
    public List<RecomendacaoItemDto> Itens { get; set; } = new();
    public ExplicacaoDto Explicacao { get; set; } = new();
}