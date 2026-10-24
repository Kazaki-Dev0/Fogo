using Fogo.Api.Data;
using Fogo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class HistoricoController : ControllerBase
{
    private readonly AppDbContext _context;

    public HistoricoController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("telemetria")]
    public async Task<ActionResult> GetHistoricoTelemetria(
        [FromQuery] int? equipamentoId,
        [FromQuery] int? regiaoId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate)
    {
        var query = _context.Telemetrias.AsNoTracking().AsQueryable();

        if (equipamentoId.HasValue) query = query.Where(t => t.EquipamentoId == equipamentoId.Value);
        if (regiaoId.HasValue) query = query.Where(t => t.Equipamento.RegiaoId == regiaoId.Value);
        if (de.HasValue) query = query.Where(t => t.Timestamp >= de.Value);
        if (ate.HasValue) query = query.Where(t => t.Timestamp <= ate.Value);

        var resultados = await query
            .OrderByDescending(t => t.Timestamp)
            .Take(5000)
            .Select(t => new
            {
                t.Id,
                t.EquipamentoId,
                t.Timestamp,
                t.Tipo,
                t.SituacaoNoMomento,
                t.Valor
            })
            .ToListAsync();

        return Ok(resultados);
    }

    [HttpGet("ocorrencias")]
    public async Task<ActionResult> GetHistoricoOcorrencias(
        [FromQuery] int? regiaoId,
        [FromQuery] TipoOcorrencia? tipo,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate)
    {
        var query = _context.Ocorrencias.AsNoTracking().AsQueryable();

        if (regiaoId.HasValue) query = query.Where(o => o.RegiaoId == regiaoId.Value);
        if (tipo.HasValue) query = query.Where(o => o.Tipo == tipo.Value);
        if (de.HasValue) query = query.Where(o => o.DataHora >= de.Value);
        if (ate.HasValue) query = query.Where(o => o.DataHora <= ate.Value);

        var resultados = await query
            .OrderByDescending(o => o.DataHora)
            .Take(5000)
            .Select(o => new
            {
                o.Id,
                o.Tipo,
                o.Gravidade,
                o.RegiaoId,
                o.Latitude,
                o.Longitude,
                o.DataHora
            })
            .ToListAsync();

        return Ok(resultados);
    }

    [HttpGet("serie")]
    public async Task<ActionResult> GetHistoricoSerie(
        [FromQuery] string metrica,
        [FromQuery] string agrupar,
        [FromQuery] int? regiaoId,
        [FromQuery] DateTime? de,
        [FromQuery] DateTime? ate)
    {
        de ??= DateTime.UtcNow.AddDays(-30);
        ate ??= DateTime.UtcNow;

        if (metrica.Equals("ocorrencias", StringComparison.OrdinalIgnoreCase))
        {
            var q = _context.Ocorrencias.AsNoTracking().Where(o => o.DataHora >= de && o.DataHora <= ate);
            if (regiaoId.HasValue) q = q.Where(o => o.RegiaoId == regiaoId.Value);

            var dados = await q.ToListAsync();

            var serie = dados
                .GroupBy(o => new
                {
                    Periodo = agrupar == "hora" ? o.DataHora.ToString("yyyy-MM-dd HH:00") : o.DataHora.ToString("yyyy-MM-dd"),
                    o.RegiaoId
                })
                .Select(g => new
                {
                    periodo = g.Key.Periodo,
                    regiaoId = g.Key.RegiaoId,
                    valor = g.Count()
                })
                .OrderBy(x => x.periodo)
                .ToList();

            return Ok(serie);
        }
        else
        {
            var q = _context.Telemetrias.AsNoTracking().Where(t => t.Timestamp >= de && t.Timestamp <= ate && t.Tipo == "MudancaSituacao" && t.SituacaoNoMomento == Situacao.MauFuncionamento);
            if (regiaoId.HasValue) q = q.Where(t => t.Equipamento.RegiaoId == regiaoId.Value);

            var dados = await q.Select(t => new { t.Timestamp, t.Equipamento.RegiaoId }).ToListAsync();

            var serie = dados
                .GroupBy(t => new
                {
                    Periodo = agrupar == "hora" ? t.Timestamp.ToString("yyyy-MM-dd HH:00") : t.Timestamp.ToString("yyyy-MM-dd"),
                    t.RegiaoId
                })
                .Select(g => new
                {
                    periodo = g.Key.Periodo,
                    regiaoId = g.Key.RegiaoId,
                    valor = g.Count()
                })
                .OrderBy(x => x.periodo)
                .ToList();

            return Ok(serie);
        }
    }
}