using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Hubs;
using Fogo.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Fogo.Api.Services;

public class AlertaService : IAlertaService
{
    private readonly AppDbContext _context;
    private readonly IHubContext<OperacoesHub> _hubContext;
    private readonly ResumoNotificador _resumoNotificador;
    private readonly int _limiteOfflineSegundos;

    public AlertaService(
        AppDbContext context,
        IHubContext<OperacoesHub> hubContext,
        ResumoNotificador resumoNotificador,
        IConfiguration configuration)
    {
        _context = context;
        _hubContext = hubContext;
        _resumoNotificador = resumoNotificador;
        _limiteOfflineSegundos = configuration.GetValue<int>("Simulacao:LimiteOfflineSegundos", 90);
    }

    public async Task AvaliarRegrasEquipamentoAsync(int equipamentoId)
    {
        var eq = await _context.Equipamentos
            .Include(e => e.TipoEquipamento)
            .Include(e => e.Regiao)
            .FirstOrDefaultAsync(e => e.Id == equipamentoId);

        if (eq == null) return;

        var alertasAtivos = await _context.Alertas
            .Where(a => a.EquipamentoId == eq.Id && (a.Status == StatusAlerta.Ativo || a.Status == StatusAlerta.Reconhecido))
            .ToListAsync();

        var tiposDesejados = new HashSet<TipoAlerta>();
        var dataHoje = DateOnly.FromDateTime(DateTime.UtcNow);

        // Regra 1: Furtado
        if (eq.Situacao == Situacao.Furtado)
        {
            tiposDesejados.Add(TipoAlerta.Furtado);
            await GarantirAlertaAsync(eq, TipoAlerta.Furtado, Criticidade.Critico,
                $"Equipamento {eq.NumeroSerie} furtado", $"O equipamento {eq.NumeroSerie} foi marcado como furtado.");
        }

        // Regra 2: MauFuncionamento
        if (eq.Situacao == Situacao.MauFuncionamento)
        {
            tiposDesejados.Add(TipoAlerta.MauFuncionamento);
            bool ehCritico = eq.TipoEquipamento.Codigo is "radar" or "camera" or "balanca";
            var crit = ehCritico ? Criticidade.Critico : Criticidade.Atencao;

            await GarantirAlertaAsync(eq, TipoAlerta.MauFuncionamento, crit,
                $"Mau funcionamento no equipamento {eq.NumeroSerie}", $"O equipamento {eq.NumeroSerie} apresentou falha operacional.");
        }

        // Regra 3: Offline
        bool semHeartbeat = (DateTime.UtcNow - eq.UltimoHeartbeat).TotalSeconds > _limiteOfflineSegundos;
        if (eq.Situacao == Situacao.Operacional && semHeartbeat)
        {
            tiposDesejados.Add(TipoAlerta.Offline);
            await GarantirAlertaAsync(eq, TipoAlerta.Offline, Criticidade.Critico,
                $"Equipamento {eq.NumeroSerie} offline", $"Sem registros de heartbeat há mais de {_limiteOfflineSegundos} segundos.");
        }

        // Regra 4 e 5: Manutenção Vencida / Próxima
        if (eq.ProximaManutencao.HasValue)
        {
            if (eq.ProximaManutencao.Value < dataHoje)
            {
                tiposDesejados.Add(TipoAlerta.ManutencaoVencida);
                await GarantirAlertaAsync(eq, TipoAlerta.ManutencaoVencida, Criticidade.Atencao,
                    $"Manutenção vencida em {eq.NumeroSerie}", $"A manutenção do equipamento {eq.NumeroSerie} venceu em {eq.ProximaManutencao.Value:yyyy-MM-dd}.");
            }
            else if (eq.ProximaManutencao.Value <= dataHoje.AddDays(7))
            {
                tiposDesejados.Add(TipoAlerta.ManutencaoProxima);
                await GarantirAlertaAsync(eq, TipoAlerta.ManutencaoProxima, Criticidade.Info,
                    $"Manutenção próxima em {eq.NumeroSerie}", $"A manutenção do equipamento {eq.NumeroSerie} está prevista para {eq.ProximaManutencao.Value:yyyy-MM-dd}.");
            }
        }

        // Resolver alertas que não se aplicam mais
        foreach (var alerta in alertasAtivos)
        {
            if (!tiposDesejados.Contains(alerta.Tipo))
            {
                alerta.Status = StatusAlerta.Resolvido;
                alerta.ResolvidoEm = DateTime.UtcNow;

                var dtoRes = MapearAlerta(alerta, eq.NumeroSerie, eq.Regiao?.Nome);
                await DispararNotificacoesAsync(dtoRes, EventosHub.AlertaAtualizado, $"Alerta de {alerta.Tipo} resolvido para {eq.NumeroSerie}");
            }
        }

        await _context.SaveChangesAsync();
    }

    public async Task<AlertaDto> CriarAlertaManualAsync(Alerta alerta)
    {
        _context.Alertas.Add(alerta);
        await _context.SaveChangesAsync();

        var eq = alerta.EquipamentoId.HasValue ? await _context.Equipamentos.FindAsync(alerta.EquipamentoId.Value) : null;
        var reg = alerta.RegiaoId.HasValue ? await _context.Regioes.FindAsync(alerta.RegiaoId.Value) : null;

        var dto = MapearAlerta(alerta, eq?.NumeroSerie, reg?.Nome);
        await DispararNotificacoesAsync(dto, EventosHub.AlertaCriado, alerta.Titulo);

        return dto;
    }

    public async Task<AlertaDto?> ReconhecerAlertaAsync(int alertaId)
    {
        var alerta = await _context.Alertas
            .Include(a => a.Equipamento)
            .Include(a => a.Regiao)
            .FirstOrDefaultAsync(a => a.Id == alertaId);

        if (alerta == null) return null;

        alerta.Status = StatusAlerta.Reconhecido;
        alerta.ReconhecidoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var dto = MapearAlerta(alerta, alerta.Equipamento?.NumeroSerie, alerta.Regiao?.Nome);
        await DispararNotificacoesAsync(dto, EventosHub.AlertaAtualizado, $"Alerta {alerta.Titulo} reconhecido");

        return dto;
    }

    public async Task<AlertaDto?> ResolverAlertaAsync(int alertaId)
    {
        var alerta = await _context.Alertas
            .Include(a => a.Equipamento)
            .Include(a => a.Regiao)
            .FirstOrDefaultAsync(a => a.Id == alertaId);

        if (alerta == null) return null;

        alerta.Status = StatusAlerta.Resolvido;
        alerta.ResolvidoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var dto = MapearAlerta(alerta, alerta.Equipamento?.NumeroSerie, alerta.Regiao?.Nome);
        await DispararNotificacoesAsync(dto, EventosHub.AlertaAtualizado, $"Alerta {alerta.Titulo} resolvido");

        return dto;
    }

    private async Task GarantirAlertaAsync(Equipamento eq, TipoAlerta tipo, Criticidade crit, string titulo, string descricao)
    {
        bool existe = await _context.Alertas.AnyAsync(a =>
            a.EquipamentoId == eq.Id &&
            a.Tipo == tipo &&
            (a.Status == StatusAlerta.Ativo || a.Status == StatusAlerta.Reconhecido));

        if (!existe)
        {
            var alerta = new Alerta
            {
                Tipo = tipo,
                Criticidade = crit,
                Titulo = titulo,
                Descricao = descricao,
                Status = StatusAlerta.Ativo,
                EquipamentoId = eq.Id,
                RegiaoId = eq.RegiaoId,
                Latitude = eq.Latitude,
                Longitude = eq.Longitude,
                CriadoEm = DateTime.UtcNow
            };

            _context.Alertas.Add(alerta);
            await _context.SaveChangesAsync();

            var dto = MapearAlerta(alerta, eq.NumeroSerie, eq.Regiao?.Nome);
            await DispararNotificacoesAsync(dto, EventosHub.AlertaCriado, titulo);
        }
    }

    private async Task DispararNotificacoesAsync(AlertaDto dto, string eventoHub, string mensagemEvento)
    {
        await _hubContext.Clients.All.SendAsync(eventoHub, dto);

        var eventoOp = new EventoOperacionalDto
        {
            Timestamp = DateTime.UtcNow,
            Mensagem = mensagemEvento,
            Criticidade = dto.Criticidade
        };
        await _hubContext.Clients.All.SendAsync(EventosHub.EventoOperacional, eventoOp);

        _resumoNotificador.Solicitar();
    }

    private static AlertaDto MapearAlerta(Alerta a, string? eqSerie, string? regNome)
    {
        return new AlertaDto
        {
            Id = a.Id,
            Tipo = a.Tipo,
            Criticidade = a.Criticidade,
            Titulo = a.Titulo,
            Descricao = a.Descricao,
            Status = a.Status,
            EquipamentoId = a.EquipamentoId,
            EquipamentoSerie = eqSerie,
            AgenteId = a.AgenteId,
            RegiaoId = a.RegiaoId,
            RegiaoNome = regNome,
            Latitude = a.Latitude,
            Longitude = a.Longitude,
            CriadoEm = a.CriadoEm,
            ReconhecidoEm = a.ReconhecidoEm,
            ResolvidoEm = a.ResolvidoEm
        };
    }
}