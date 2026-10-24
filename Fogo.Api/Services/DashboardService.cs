using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Services;

public class DashboardService : IDashboardService
{
    private readonly AppDbContext _context;

    public DashboardService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<ResumoDto> ObterResumoAsync()
    {
        var equipamentos = await _context.Equipamentos.AsNoTracking().Include(e => e.TipoEquipamento).ToListAsync();
        var tipos = await _context.TiposEquipamento.AsNoTracking().ToListAsync();
        var regioes = await _context.Regioes.AsNoTracking().ToListAsync();
        var agentes = await _context.Agentes.AsNoTracking().ToListAsync();
        var alertasAtivos = await _context.Alertas.AsNoTracking().Where(a => a.Status == StatusAlerta.Ativo).ToListAsync();

        var inicioHoje = DateTime.UtcNow.Date;
        int ocorrenciasHoje = await _context.Ocorrencias.AsNoTracking().CountAsync(o => o.DataHora >= inicioHoje);

        int totalEq = equipamentos.Count;
        int naoInstalados = equipamentos.Count(e => e.Situacao == Situacao.NaoInstalado);
        int operacionais = equipamentos.Count(e => e.Situacao == Situacao.Operacional);
        int indisponiveis = equipamentos.Count(e => e.Situacao is Situacao.MauFuncionamento or Situacao.EmManutencao or Situacao.Desativado or Situacao.Furtado);

        int baseCalculo = totalEq - naoInstalados;
        double percDisponibilidade = baseCalculo > 0 ? Math.Round((double)operacionais / baseCalculo * 100.0, 1) : 0.0;

        int manutencaoImediata = equipamentos.Count(e => e.NecessidadeManutencao == NecessidadeManutencao.Imediata);
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        int manutencaoProxima = equipamentos.Count(e => e.ProximaManutencao.HasValue && e.ProximaManutencao.Value >= hoje && e.ProximaManutencao.Value <= hoje.AddDays(7));

        int totalAgentes = agentes.Count;
        int agentesEmCampo = agentes.Count(a => a.Status is StatusAgente.EmAtividade or StatusAgente.Disponivel);

        int totalAlertas = alertasAtivos.Count;
        int alertasCriticos = alertasAtivos.Count(a => a.Criticidade == Criticidade.Critico);

        // Agrupamento por Tipo
        var porTipoList = tipos.Select(t =>
        {
            var eqDoTipo = equipamentos.Where(e => e.TipoEquipamentoId == t.Id).ToList();
            int tot = eqDoTipo.Count;
            int op = eqDoTipo.Count(e => e.Situacao == Situacao.Operacional);
            int ind = eqDoTipo.Count(e => e.Situacao is Situacao.MauFuncionamento or Situacao.EmManutencao or Situacao.Desativado or Situacao.Furtado);

            return new PorTipoDto
            {
                TipoCodigo = t.Codigo,
                TipoNome = t.Nome,
                Icone = t.Icone,
                Cor = t.Cor,
                Total = tot,
                Operacionais = op,
                Indisponiveis = ind
            };
        }).ToList();

        // Agrupamento por Situação
        var porSituacaoList = Enum.GetValues<Situacao>().Select(s => new PorSituacaoDto
        {
            Situacao = s,
            Total = equipamentos.Count(e => e.Situacao == s)
        }).ToList();

        // Agrupamento por Região
        var porRegiaoList = regioes.Select(r =>
        {
            var eqReg = equipamentos.Where(e => e.RegiaoId == r.Id).ToList();
            int tot = eqReg.Count;
            int naoInst = eqReg.Count(e => e.Situacao == Situacao.NaoInstalado);
            int op = eqReg.Count(e => e.Situacao == Situacao.Operacional);

            int baseReg = tot - naoInst;
            double percReg = baseReg > 0 ? Math.Round((double)op / baseReg * 100.0, 1) : 0.0;

            var alertasReg = alertasAtivos.Where(a => a.RegiaoId == r.Id).ToList();
            int altAtivos = alertasReg.Count;
            int altCriticos = alertasReg.Count(a => a.Criticidade == Criticidade.Critico);

            NivelRegiao nivel;
            if (percReg < 80.0 || altCriticos >= 3)
            {
                nivel = NivelRegiao.Critico;
            }
            else if (percReg < 92.0 || altCriticos >= 1)
            {
                nivel = NivelRegiao.Atencao;
            }
            else
            {
                nivel = NivelRegiao.Normal;
            }

            return new PorRegiaoDto
            {
                RegiaoId = r.Id,
                Nome = r.Nome,
                Latitude = r.Latitude,
                Longitude = r.Longitude,
                Total = tot,
                Operacionais = op,
                PercentualDisponibilidade = percReg,
                AlertasAtivos = altAtivos,
                AlertasCriticos = altCriticos,
                Nivel = nivel
            };
        }).ToList();

        return new ResumoDto
        {
            GeradoEm = DateTime.UtcNow,
            TotalEquipamentos = totalEq,
            NaoInstalados = naoInstalados,
            Operacionais = operacionais,
            Indisponiveis = indisponiveis,
            PercentualDisponibilidade = percDisponibilidade,
            ManutencaoImediata = manutencaoImediata,
            ManutencaoProxima = manutencaoProxima,
            TotalAgentes = totalAgentes,
            AgentesEmCampo = agentesEmCampo,
            AlertasAtivos = totalAlertas,
            AlertasCriticos = alertasCriticos,
            OcorrenciasHoje = ocorrenciasHoje,
            PorTipo = porTipoList,
            PorSituacao = porSituacaoList,
            PorRegiao = porRegiaoList
        };
    }

    public async Task<List<ManutencaoDto>> ObterManutencoesAsync(int dias)
    {
        var hoje = DateOnly.FromDateTime(DateTime.UtcNow);
        var limite = hoje.AddDays(dias);

        var equipamentos = await _context.Equipamentos.AsNoTracking()
            .Include(e => e.TipoEquipamento)
            .Where(e => e.NecessidadeManutencao == NecessidadeManutencao.Imediata ||
                        (e.ProximaManutencao.HasValue && e.ProximaManutencao.Value <= limite))
            .ToListAsync();

        var resultado = equipamentos.Select(e =>
        {
            DateOnly prox = e.ProximaManutencao ?? hoje;
            int diasRestantes = prox.DayNumber - hoje.DayNumber;

            return new ManutencaoDto
            {
                EquipamentoId = e.Id,
                NumeroSerie = e.NumeroSerie,
                TipoCodigo = e.TipoEquipamento.Codigo,
                TipoNome = e.TipoEquipamento.Nome,
                Situacao = e.Situacao,
                NecessidadeManutencao = e.NecessidadeManutencao,
                ProximaManutencao = prox,
                DiasRestantes = diasRestantes,
                Latitude = e.Latitude,
                Longitude = e.Longitude,
                Bairro = e.Bairro
            };
        })
        .OrderBy(m => m.NecessidadeManutencao != NecessidadeManutencao.Imediata)
        .ThenBy(m => m.DiasRestantes)
        .ToList();

        return resultado;
    }
}