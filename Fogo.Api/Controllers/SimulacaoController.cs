using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Hubs;
using Fogo.Api.Models;
using Fogo.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SimulacaoController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAlertaService _alertaService;
    private readonly IHubContext<OperacoesHub> _hubContext;
    private readonly ResumoNotificador _resumoNotificador;

    public SimulacaoController(
        AppDbContext context,
        IAlertaService alertaService,
        IHubContext<OperacoesHub> hubContext,
        ResumoNotificador resumoNotificador)
    {
        _context = context;
        _alertaService = alertaService;
        _hubContext = hubContext;
        _resumoNotificador = resumoNotificador;
    }

    [HttpPost("falha")]
    public async Task<ActionResult<EquipamentoDetalheDto>> SimularFalha([FromBody] SimularFalhaDto dto)
    {
        Equipamento? eq;

        if (dto.EquipamentoId.HasValue)
        {
            eq = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao).FirstOrDefaultAsync(e => e.Id == dto.EquipamentoId.Value);
        }
        else
        {
            eq = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao)
                .Where(e => e.Situacao == Situacao.Operacional)
                .OrderBy(_ => Guid.NewGuid())
                .FirstOrDefaultAsync();
        }

        if (eq == null)
        {
            return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404, Detail = "Nenhum equipamento disponível." });
        }

        if (!eq.SituacaoBase.HasValue)
        {
            eq.SituacaoBase = eq.Situacao;
        }

        if (dto.Tipo.Equals("Offline", StringComparison.OrdinalIgnoreCase))
        {
            eq.HeartbeatSuspenso = true;
        }
        else if (Enum.TryParse<Situacao>(dto.Tipo, true, out var novaSituacao))
        {
            eq.Situacao = novaSituacao;
        }

        eq.AtualizadoEm = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);

        var mapaDto = EquipamentoMapper.ParaMapaDto(eq);
        await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, mapaDto);
        _resumoNotificador.Solicitar();

        return Ok(EquipamentoMapper.ParaDetalheDto(eq));
    }

    [HttpPost("restaurar")]
    public async Task<ActionResult<EquipamentoDetalheDto>> RestaurarEquipamento([FromBody] RestaurarDto dto)
    {
        var eq = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao).FirstOrDefaultAsync(e => e.Id == dto.EquipamentoId);
        if (eq == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        eq.Situacao = eq.SituacaoBase ?? Situacao.Operacional;
        eq.SituacaoBase = null;
        eq.HeartbeatSuspenso = false;
        eq.UltimoHeartbeat = DateTime.UtcNow;
        eq.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);

        var mapaDto = EquipamentoMapper.ParaMapaDto(eq);
        await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, mapaDto);
        _resumoNotificador.Solicitar();

        return Ok(EquipamentoMapper.ParaDetalheDto(eq));
    }

    [HttpPost("resetar")]
    public async Task<ActionResult> ResetarSimulacao()
    {
        var alterados = await _context.Equipamentos
            .Where(e => e.SituacaoBase.HasValue || e.HeartbeatSuspenso)
            .ToListAsync();

        foreach (var eq in alterados)
        {
            eq.Situacao = eq.SituacaoBase ?? Situacao.Operacional;
            eq.SituacaoBase = null;
            eq.HeartbeatSuspenso = false;
            eq.UltimoHeartbeat = DateTime.UtcNow;
            eq.AtualizadoEm = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();

        foreach (var eq in alterados)
        {
            await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);
        }

        _resumoNotificador.Solicitar();
        return Ok(new { restaurados = alterados.Count });
    }
}