namespace Fogo.Api.Models;

public class Equipamento
{
    public int Id { get; set; }
    public int TipoEquipamentoId { get; set; }
    public string NumeroSerie { get; set; } = string.Empty;
    public string Marca { get; set; } = string.Empty;
    public string Modelo { get; set; } = string.Empty;
    public string Cep { get; set; } = string.Empty;
    public string Rua { get; set; } = string.Empty;
    public string Bairro { get; set; } = string.Empty;
    public string Cidade { get; set; } = string.Empty;
    public string Uf { get; set; } = string.Empty;
    public string Referencia { get; set; } = string.Empty;
    public double Latitude { get; set; }
    public double Longitude { get; set; }
    public int RegiaoId { get; set; }
    public Orgao Orgao { get; set; }
    public Situacao Situacao { get; set; }
    public NecessidadeManutencao NecessidadeManutencao { get; set; }
    public DateOnly? ProximaManutencao { get; set; }
    public DateTime UltimoHeartbeat { get; set; }
    public string CaracteristicasJson { get; set; } = string.Empty;
    public Situacao? SituacaoBase { get; set; }
    public bool HeartbeatSuspenso { get; set; }
    public DateTime CriadoEm { get; set; }
    public DateTime AtualizadoEm { get; set; }

    // Propriedades de Navegação
    public TipoEquipamento TipoEquipamento { get; set; } = null!;
    public Regiao Regiao { get; set; } = null!;
    public ICollection<Manutencao> Manutencoes { get; set; } = new List<Manutencao>();
    public ICollection<Telemetria> Telemetrias { get; set; } = new List<Telemetria>();
    public ICollection<Alerta> Alertas { get; set; } = new List<Alerta>();
    public ICollection<Agente> AgentesVinculados { get; set; } = new List<Agente>();
}