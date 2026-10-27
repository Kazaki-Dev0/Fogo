using System.Globalization;
using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Configuration;

namespace Fogo.Api.Services;

public class PrevisaoService : IPrevisaoService
{
    private readonly AppDbContext _db;
    private readonly IDashboardService _dashboard;
    private readonly IMemoryCache _cache;
    private readonly IConfiguration _config;

    public PrevisaoService(
        AppDbContext db,
        IDashboardService dashboard,
        IMemoryCache cache,
        IConfiguration config)
    {
        _db = db;
        _dashboard = dashboard;
        _cache = cache;
        _config = config;
    }

    private static DateTime HoraLocal(DateTime utc) => utc.AddHours(-3);

    public async Task<RiscoRegioesDto> ObterRiscoRegioesAsync(DateOnly? data, bool forcar)
    {
        DateOnly dataAlvo = data ?? DateOnly.FromDateTime(HoraLocal(DateTime.UtcNow).AddDays(1));
        string cacheKey = $"previsao_risco_{dataAlvo:yyyyMMdd}";

        if (!forcar && _cache.TryGetValue(cacheKey, out RiscoRegioesDto? cached) && cached != null)
        {
            return cached;
        }

        var inicio90d = DateTime.UtcNow.AddDays(-90);
        var ocorrencias = await _db.Ocorrencias
            .AsNoTracking()
            .Where(o => o.DataHora >= inicio90d)
            .ToListAsync();

        var regioes = await _db.Regioes.AsNoTracking().ToListAsync();
        var equipamentos = await _db.Equipamentos.AsNoTracking().ToListAsync();

        var diaSemanaAlvo = dataAlvo.DayOfWeek;
        var culturaPt = new CultureInfo("pt-BR");

        // Faixas de 2 horas
        var faixas = Enumerable.Range(0, 12).Select(i => new FaixaHorariaDto
        {
            Indice = i,
            Rotulo = $"{i * 2:D2}:00-{(i + 1) * 2:D2}:00"
        }).ToList();

        var celulas = new Dictionary<(int RegiaoId, int FaixaIndice), double>();
        var contagemGravidade3 = new Dictionary<(int RegiaoId, int FaixaIndice), int>();

        foreach (var oc in ocorrencias)
        {
            var dtLocal = HoraLocal(oc.DataHora);
            if (dtLocal.DayOfWeek != diaSemanaAlvo) continue;

            int faixa = dtLocal.Hour / 2;
            double pesoRecencia = (DateTime.UtcNow - oc.DataHora).TotalDays <= 14 ? 1.0 : 0.6;
            double pesoGravidade = oc.Gravidade switch { 1 => 1.0, 2 => 1.5, _ => 2.0 };
            double pesoTotal = pesoRecencia * pesoGravidade;

            var key = (oc.RegiaoId, faixa);
            celulas[key] = celulas.GetValueOrDefault(key, 0) + pesoTotal;

            if (oc.Gravidade == 3 && (DateTime.UtcNow - oc.DataHora).TotalDays <= 14)
            {
                contagemGravidade3[key] = contagemGravidade3.GetValueOrDefault(key, 0) + 1;
            }
        }

        double maiorSoma = celulas.Values.DefaultIfEmpty(1.0).Max();
        if (maiorSoma <= 0) maiorSoma = 1.0;

        var itens = new List<RiscoItemDto>();

        foreach (var reg in regioes)
        {
            var eqsReg = equipamentos.Where(e => e.RegiaoId == reg.Id).ToList();
            int totalEqs = eqsReg.Count(e => e.Situacao != Situacao.NaoInstalado);
            int opEqs = eqsReg.Count(e => e.Situacao == Situacao.Operacional);
            double disponib = totalEqs > 0 ? (double)opEqs / totalEqs * 100.0 : 100.0;
            bool bonusDisponib = disponib < 92.0;

            for (int f = 0; f < 12; f++)
            {
                var key = (reg.Id, f);
                double soma = celulas.GetValueOrDefault(key, 0);
                double scoreCalc = (soma / maiorSoma) * 100.0;

                if (bonusDisponib) scoreCalc += 10.0;
                int scoreFinal = Math.Min(100, (int)Math.Round(scoreCalc));

                NivelRisco nivel = scoreFinal >= 70 ? NivelRisco.Alto : (scoreFinal >= 40 ? NivelRisco.Medio : NivelRisco.Baixo);

                var fatores = new List<string>();
                int g3 = contagemGravidade3.GetValueOrDefault(key, 0);
                if (g3 > 0) fatores.Add($"{g3} ocorrência(s) grave(s) (gravidade 3) nos últimos 14 dias");
                if (bonusDisponib) fatores.Add($"Disponibilidade de equipamentos da região em {disponib:F1}%");

                itens.Add(new RiscoItemDto
                {
                    RegiaoId = reg.Id,
                    RegiaoNome = reg.Nome,
                    FaixaIndice = f,
                    FaixaRotulo = faixas[f].Rotulo,
                    Score = scoreFinal,
                    Nivel = nivel,
                    Fatores = fatores
                });
            }
        }

        var resumoRegioes = regioes.Select(reg =>
        {
            var itensReg = itens.Where(i => i.RegiaoId == reg.Id).ToList();
            var maxItem = itensReg.OrderByDescending(i => i.Score).First();
            return new RiscoResumoRegiaoDto
            {
                RegiaoId = reg.Id,
                RegiaoNome = reg.Nome,
                Latitude = reg.Latitude,
                Longitude = reg.Longitude,
                ScoreMaximo = maxItem.Score,
                NivelMaximo = maxItem.Nivel,
                FaixaPico = maxItem.FaixaRotulo
            };
        }).ToList();

        var resultado = new RiscoRegioesDto
        {
            GeradoEm = DateTime.UtcNow,
            Data = dataAlvo.ToString("yyyy-MM-dd"),
            DiaSemana = culturaPt.DateTimeFormat.GetDayName(diaSemanaAlvo),
            Faixas = faixas,
            Itens = itens,
            ResumoRegioes = resumoRegioes,
            TotalAlto = itens.Count(i => i.Nivel == NivelRisco.Alto),
            Explicacao = new ExplicacaoDto
            {
                OQuePreve = "Nível de risco de incidentes por região e faixa horária para o dia selecionado.",
                DadosUsados = new List<string> { "Histórico de ocorrências dos últimos 90 dias", "Gravidade dos incidentes", "Disponibilidade de equipamentos na região" },
                ComoAjuda = "Auxilia no planejamento de patrulhamento preventivo e alocação de agentes nas faixas mais críticas."
            }
        };

        _cache.Set(cacheKey, resultado, TimeSpan.FromMinutes(5));
        return resultado;
    }

    public async Task<DemandaAgentesDto> ObterDemandaAgentesAsync(DateOnly? data, bool forcar)
    {
        DateOnly dataAlvo = data ?? DateOnly.FromDateTime(HoraLocal(DateTime.UtcNow).AddDays(1));
        string cacheKey = $"previsao_demanda_{dataAlvo:yyyyMMdd}";

        if (!forcar && _cache.TryGetValue(cacheKey, out DemandaAgentesDto? cached) && cached != null)
        {
            return cached;
        }

        var inicio90d = DateTime.UtcNow.AddDays(-90);
        var ocorrencias = await _db.Ocorrencias.AsNoTracking().Where(o => o.DataHora >= inicio90d).ToListAsync();
        var agentesAtual = await _db.Agentes.AsNoTracking().CountAsync(a => a.Status == StatusAgente.EmAtividade || a.Status == StatusAgente.Disponivel);

        var diaSemanaAlvo = dataAlvo.DayOfWeek;
        var agoraLocal = HoraLocal(DateTime.UtcNow);
        bool ehHoje = dataAlvo == DateOnly.FromDateTime(agoraLocal);

        var horas = new List<DemandaHoraDto>();

        for (int h = 0; h < 24; h++)
        {
            int? hojeVal = null;
            if (ehHoje && h <= agoraLocal.Hour)
            {
                hojeVal = ocorrencias.Count(o => HoraLocal(o.DataHora).Date == agoraLocal.Date && HoraLocal(o.DataHora).Hour == h);
            }

            var ocsMesmoDiaSemana = ocorrencias.Where(o => HoraLocal(o.DataHora).DayOfWeek == diaSemanaAlvo && HoraLocal(o.DataHora).Hour == h).ToList();
            int totalDiasMesmoDiaSemana = Math.Max(1, 90 / 7);
            double previsto = (double)ocsMesmoDiaSemana.Count / totalDiasMesmoDiaSemana;

            var ocsTodasHoras = ocorrencias.Where(o => HoraLocal(o.DataHora).Hour == h).ToList();
            double mediaSemana = (double)ocsTodasHoras.Count / 90.0;

            int agentesRec = (int)Math.Ceiling(previsto * 1.5);

            horas.Add(new DemandaHoraDto
            {
                Hora = h,
                Hoje = hojeVal,
                Previsto = Math.Round(previsto, 1),
                MediaSemana = Math.Round(mediaSemana, 1),
                AgentesRecomendados = Math.Max(1, agentesRec)
            });
        }

        var picos = horas.OrderByDescending(h => h.Previsto).Take(3).Select(h => new DemandaPicoDto
        {
            Hora = h.Hora,
            Previsto = h.Previsto,
            AgentesRecomendados = h.AgentesRecomendados
        }).ToList();

        var resultado = new DemandaAgentesDto
        {
            GeradoEm = DateTime.UtcNow,
            DataPrevista = dataAlvo.ToString("yyyy-MM-dd"),
            AgentesEmCampoAtual = agentesAtual,
            Horas = horas,
            Picos = picos,
            Explicacao = new ExplicacaoDto
            {
                OQuePreve = "Estimativa de volume de ocorrências por hora e número ideal de agentes de campo.",
                DadosUsados = new List<string> { "Média de chamados no mesmo dia da semana nos últimos 90 dias", "Fator de cobertura operacional 1.5x" },
                ComoAjuda = "Otimiza a escala de trabalho dos agentes e turnos operacionais."
            }
        };

        _cache.Set(cacheKey, resultado, TimeSpan.FromMinutes(5));
        return resultado;
    }

    public async Task<ManutencaoPreditivaDto> ObterManutencaoAsync(int top, bool forcar)
    {
        string cacheKey = $"previsao_manutencao_{top}";

        if (!forcar && _cache.TryGetValue(cacheKey, out ManutencaoPreditivaDto? cached) && cached != null)
        {
            return cached;
        }

        var inicio90d = DateTime.UtcNow.AddDays(-90);
        var inicio30d = DateTime.UtcNow.AddDays(-30);
        var hoje = DateOnly.FromDateTime(HoraLocal(DateTime.UtcNow));

        var equipamentos = await _db.Equipamentos
            .Include(e => e.TipoEquipamento)
            .AsNoTracking()
            .Where(e => e.Situacao != Situacao.NaoInstalado)
            .ToListAsync();

        var telemetrias90d = await _db.Telemetrias
            .AsNoTracking()
            .Where(t => t.Timestamp >= inicio90d && t.Tipo == "MudancaSituacao" && t.SituacaoNoMomento == Situacao.MauFuncionamento)
            .ToListAsync();

        // Taxa do modelo
        var taxasModelo = equipamentos
            .GroupBy(e => (e.Marca, e.Modelo))
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var eqIds = g.Select(x => x.Id).ToHashSet();
                    int falhasModelo = telemetrias90d.Count(t => eqIds.Contains(t.EquipamentoId));
                    return (double)falhasModelo / g.Count();
                });

        double maiorTaxaModelo = taxasModelo.Values.DefaultIfEmpty(1.0).Max();
        if (maiorTaxaModelo <= 0) maiorTaxaModelo = 1.0;

        var itens = new List<ManutencaoPreditivaItemDto>();

        foreach (var eq in equipamentos)
        {
            int ptsModelo = 0;
            if (taxasModelo.TryGetValue((eq.Marca, eq.Modelo), out double tModelo))
            {
                ptsModelo = (int)Math.Round(40.0 * (tModelo / maiorTaxaModelo));
            }

            int ptsAtraso = 0;
            if (eq.ProximaManutencao.HasValue)
            {
                if (eq.ProximaManutencao.Value < hoje)
                {
                    int diasAtraso = hoje.DayNumber - eq.ProximaManutencao.Value.DayNumber;
                    ptsAtraso = (int)Math.Round(25.0 * Math.Min((double)diasAtraso / 30.0, 1.0));
                }
            }
            else
            {
                ptsAtraso = 5;
            }

            int falhasRecentes = telemetrias90d.Count(t => t.EquipamentoId == eq.Id && t.Timestamp >= inicio30d);
            int ptsFalhas = (int)Math.Round(25.0 * Math.Min((double)falhasRecentes / 3.0, 1.0));
            int ptsSituacao = eq.Situacao == Situacao.MauFuncionamento ? 10 : 0;

            int scoreTotal = Math.Min(100, ptsModelo + ptsAtraso + ptsFalhas + ptsSituacao);
            NivelRisco nivel = scoreTotal >= 70 ? NivelRisco.Alto : (scoreTotal >= 40 ? NivelRisco.Medio : NivelRisco.Baixo);

            var fatores = new List<string>();
            if (ptsAtraso > 0 && eq.ProximaManutencao.HasValue && eq.ProximaManutencao < hoje)
            {
                fatores.Add($"Manutenção atrasada há {hoje.DayNumber - eq.ProximaManutencao.Value.DayNumber} dias");
            }
            if (falhasRecentes > 0)
            {
                fatores.Add($"{falhasRecentes} falha(s) registrada(s) nos últimos 30 dias");
            }
            if (ptsModelo > 20)
            {
                fatores.Add($"Modelo {eq.Marca} {eq.Modelo} possui alta taxa de falhas no histórico");
            }

            itens.Add(new ManutencaoPreditivaItemDto
            {
                EquipamentoId = eq.Id,
                NumeroSerie = eq.NumeroSerie,
                TipoCodigo = eq.TipoEquipamento.Codigo,
                TipoNome = eq.TipoEquipamento.Nome,
                Marca = eq.Marca,
                Modelo = eq.Modelo,
                Bairro = eq.Bairro,
                RegiaoId = eq.RegiaoId,
                Situacao = eq.Situacao,
                Score = scoreTotal,
                Nivel = nivel,
                Fatores = fatores
            });
        }

        var ordenados = itens.OrderByDescending(i => i.Score).ToList();
        int emRiscoCount = ordenados.Count(i => i.Score >= 60);

        var resultado = new ManutencaoPreditivaDto
        {
            GeradoEm = DateTime.UtcNow,
            TotalAvaliados = equipamentos.Count,
            EmRisco = emRiscoCount,
            PercentualEmRisco = equipamentos.Count > 0 ? Math.Round((double)emRiscoCount / equipamentos.Count * 100.0, 1) : 0,
            LimiteRisco = 60,
            Itens = ordenados.Take(top).ToList(),
            Explicacao = new ExplicacaoDto
            {
                OQuePreve = "Índice de risco de falha iminente para priorização de manutenção preventiva.",
                DadosUsados = new List<string> { "Histórico de falhas por modelo", "Dias de atraso na manutenção agendada", "Falhas nos últimos 30 dias" },
                ComoAjuda = "Evita que equipamentos entrem em pane total direcionando equipes de manutenção com antecedência."
            }
        };

        _cache.Set(cacheKey, resultado, TimeSpan.FromMinutes(5));
        return resultado;
    }

    public async Task<AnomaliasDto> ObterAnomaliasAsync(int dias, bool forcar)
    {
        string cacheKey = $"previsao_anomalias_{dias}";

        if (!forcar && _cache.TryGetValue(cacheKey, out AnomaliasDto? cached) && cached != null)
        {
            return cached;
        }

        var inicioDias = DateTime.UtcNow.AddDays(-dias);
        var inicioBaseline = DateTime.UtcNow.AddDays(-90);

        var ocorrencias = await _db.Ocorrencias.AsNoTracking().Where(o => o.DataHora >= inicioBaseline).ToListAsync();
        var regioes = await _db.Regioes.AsNoTracking().ToDictionaryAsync(r => r.Id, r => r.Nome);

        var anomalias = new List<AnomaliaItemDto>();
        var ocorrenciasRecentes = ocorrencias.Where(o => o.DataHora >= inicioDias).ToList();

        var gruposRecentes = ocorrenciasRecentes
            .GroupBy(o => (o.RegiaoId, Hora: HoraLocal(o.DataHora).Date.AddHours(HoraLocal(o.DataHora).Hour)));

        foreach (var g in gruposRecentes)
        {
            int contagem = g.Count();
            if (contagem < 3) continue;

            var regId = g.Key.RegiaoId;
            var dtHoraLocal = g.Key.Hora;
            var diaSemana = dtHoraLocal.DayOfWeek;
            int hora = dtHoraLocal.Hour;

            var historicoBase = ocorrencias
                .Where(o => o.RegiaoId == regId &&
                            HoraLocal(o.DataHora).Date < dtHoraLocal.Date &&
                            HoraLocal(o.DataHora).DayOfWeek == diaSemana &&
                            HoraLocal(o.DataHora).Hour == hora)
                .GroupBy(o => HoraLocal(o.DataHora).Date)
                .Select(grp => grp.Count())
                .ToList();

            double esperado = historicoBase.Count > 0 ? historicoBase.Average() : 0.5;
            double variancia = historicoBase.Count > 1 ? historicoBase.Sum(v => Math.Pow(v - esperado, 2)) / (historicoBase.Count - 1) : 0.25;
            double desvioPadrao = Math.Max(0.5, Math.Sqrt(variancia));

            double z = (contagem - esperado) / desvioPadrao;

            if (z >= 2.5)
            {
                string nomeRegiao = regioes.GetValueOrDefault(regId, "Região");
                anomalias.Add(new AnomaliaItemDto
                {
                    RegiaoId = regId,
                    RegiaoNome = nomeRegiao,
                    Inicio = g.Key.Hora,
                    Contagem = contagem,
                    Esperado = Math.Round(esperado, 1),
                    DesvioPadrao = Math.Round(desvioPadrao, 1),
                    Z = Math.Round(z, 1),
                    Mensagem = $"{nomeRegiao}: {contagem} ocorrências às {hora}h (esperado {esperado:F1}). {z:F1} desvios acima do normal."
                });
            }
        }

        var resultado = new AnomaliasDto
        {
            GeradoEm = DateTime.UtcNow,
            Dias = dias,
            Total = anomalias.Count,
            Itens = anomalias.OrderByDescending(a => a.Z).Take(10).ToList(),
            Explicacao = new ExplicacaoDto
            {
                OQuePreve = "Detecção de picos atípicos de ocorrências em relação ao padrão histórico da região.",
                DadosUsados = new List<string> { "Ocorrências no mesmo horário e dia da semana nos últimos 90 dias", "Análise de Z-score estatístico" },
                ComoAjuda = "Alerta a central sobre eventos imprevistos, acidentes graves ou manifestações em andamento."
            }
        };

        _cache.Set(cacheKey, resultado, TimeSpan.FromMinutes(5));
        return resultado;
    }

    public async Task<RecomendacoesDto> ObterRecomendacoesAsync(bool forcar)
    {
        string cacheKey = "previsao_recomendacoes";

        if (!forcar && _cache.TryGetValue(cacheKey, out RecomendacoesDto? cached) && cached != null)
        {
            return cached;
        }

        var risco = await ObterRiscoRegioesAsync(null, forcar);
        var manutencao = await ObterManutencaoAsync(5, forcar);
        var anomalias = await ObterAnomaliasAsync(2, forcar);
        var resumoDash = await _dashboard.ObterResumoAsync();

        var recomendacoes = new List<RecomendacaoItemDto>();

        // R1: Risco Alto
        var riscosAltos = risco.Itens.Where(i => i.Score >= 70).OrderByDescending(i => i.Score).Take(3);
        foreach (var r in riscosAltos)
        {
            int qtdAgentes = r.Score >= 85 ? 2 : 1;
            string prio = r.Score >= 85 ? "Alta" : "Media";

            recomendacoes.Add(new RecomendacaoItemDto
            {
                Id = $"reforco-{r.RegiaoId}-{r.FaixaIndice}",
                Prioridade = prio,
                Categoria = "Reforco",
                Titulo = $"Reforçar +{qtdAgentes} agente(s) na {r.RegiaoNome} ({r.FaixaRotulo})",
                Descricao = $"Risco {r.Nivel.ToString().ToUpper()} previsto para a região na faixa das {r.FaixaRotulo}.",
                RegiaoId = r.RegiaoId,
                Motivos = new List<string> { $"Score de risco preditivo atingiu {r.Score} pontos" }
            });
        }

        // R2: Manutenção Preditiva
        foreach (var m in manutencao.Itens.Where(i => i.Score >= 70))
        {
            string prio = m.Score >= 85 ? "Alta" : "Media";
            recomendacoes.Add(new RecomendacaoItemDto
            {
                Id = $"manutencao-{m.EquipamentoId}",
                Prioridade = prio,
                Categoria = "Manutencao",
                Titulo = $"Programar manutenção no equipamento {m.NumeroSerie} ({m.TipoNome})",
                Descricao = $"Equipamento no bairro {m.Bairro} apresenta elevado risco de falha.",
                EquipamentoId = m.EquipamentoId,
                RegiaoId = m.RegiaoId,
                Motivos = m.Fatores.Count > 0 ? m.Fatores : new List<string> { $"Score de risco de falha: {m.Score}" }
            });
        }

        // R3: Anomalias recentes
        foreach (var a in anomalias.Itens.Take(2))
        {
            recomendacoes.Add(new RecomendacaoItemDto
            {
                Id = $"anomalia-{a.RegiaoId}-{a.Inicio:HHmm}",
                Prioridade = "Media",
                Categoria = "Anomalia",
                Titulo = $"Investigar volume atípico na {a.RegiaoNome}",
                Descricao = a.Mensagem,
                RegiaoId = a.RegiaoId,
                Motivos = new List<string> { $"Z-Score de {a.Z:F1} desvios acima da média histórica" }
            });
        }

        // R4: Regiões Críticas no Dashboard
        foreach (var reg in resumoDash.PorRegiao.Where(r => r.Nivel == NivelRegiao.Critico || r.Nivel == NivelRegiao.Atencao))
        {
            string prio = reg.Nivel == NivelRegiao.Critico ? "Alta" : "Media";
            recomendacoes.Add(new RecomendacaoItemDto
            {
                Id = $"operacao-{reg.RegiaoId}",
                Prioridade = prio,
                Categoria = "Operacao",
                Titulo = $"Priorizar restauração de cobertura na {reg.Nome}",
                Descricao = $"Disponibilidade operacional em {reg.PercentualDisponibilidade:F1}% ({reg.AlertasAtivos} alertas ativos).",
                RegiaoId = reg.RegiaoId,
                Motivos = new List<string> { $"Nível operacional da região: {reg.Nivel}" }
            });
        }

        var ordenadas = recomendacoes
            .OrderBy(r => r.Prioridade == "Alta" ? 0 : (r.Prioridade == "Media" ? 1 : 2))
            .ToList();

        var resultado = new RecomendacoesDto
        {
            GeradoEm = DateTime.UtcNow,
            Total = ordenadas.Count,
            Itens = ordenadas,
            Explicacao = new ExplicacaoDto
            {
                OQuePreve = "Sugestões de ações operacionais priorizadas por impacto e urgência.",
                DadosUsados = new List<string> { "Consolidação de risco preditivo, manutenção, anomalias e disponibilidade atual" },
                ComoAjuda = "Suporta a tomada de decisão rápida dos gestores da central de comando."
            }
        };

        _cache.Set(cacheKey, resultado, TimeSpan.FromMinutes(5));
        return resultado;
    }
}