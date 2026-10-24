using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Models;
using Fogo.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AlertasController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAlertaService _alertaService;

    public AlertasController(AppDbContext context, IAlertaService alertaService)
    {
        _context = context;
        _alertaService = alertaService;
    }

    [HttpGet]
    public async Task<ActionResult<List<AlertaDto>>> GetAlertas(
     [FromQuery] Criticidade? criticidade,
     [FromQuery] int? regiaoId,
     [FromQuery] StatusAlerta status = StatusAlerta.Ativo,
     [FromQuery] int limite = 50)
    {
        var query = _context.Alertas.AsNoTracking()
            .Include(a => a.Equipamento)
            .Include(a => a.Regiao)
            .Where(a => a.Status == status);

        if (criticidade.HasValue) query = query.Where(a => a.Criticidade == criticidade.Value);
        if (regiaoId.HasValue) query = query.Where(a => a.RegiaoId == regiaoId.Value);

        var alertas = await query
            .OrderBy(a => a.Criticidade)
            .ThenByDescending(a => a.CriadoEm)
            .Take(limite)
            .ToListAsync();

        var dtos = alertas.Select(a => new AlertaDto
        {
            Id = a.Id,
            Tipo = a.Tipo,
            Criticidade = a.Criticidade,
            Titulo = a.Titulo,
            Descricao = a.Descricao,
            Status = a.Status,
            EquipamentoId = a.EquipamentoId,
            EquipamentoSerie = a.Equipamento?.NumeroSerie,
            AgenteId = a.AgenteId,
            RegiaoId = a.RegiaoId,
            RegiaoNome = a.Regiao?.Nome,
            Latitude = a.Latitude,
            Longitude = a.Longitude,
            CriadoEm = a.CriadoEm,
            ReconhecidoEm = a.ReconhecidoEm,
            ResolvidoEm = a.ResolvidoEm
        }).ToList();

        return Ok(dtos);
    }

    [HttpPatch("{id:int}/reconhecer")]
    public async Task<ActionResult<AlertaDto>> ReconhecerAlerta(int id)
    {
        var alerta = await _alertaService.ReconhecerAlertaAsync(id);
        if (alerta == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        return Ok(alerta);
    }

    [HttpPatch("{id:int}/resolver")]
    public async Task<ActionResult<AlertaDto>> ResolverAlerta(int id)
    {
        var alerta = await _alertaService.ResolverAlertaAsync(id);
        if (alerta == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        return Ok(alerta);
    }
}