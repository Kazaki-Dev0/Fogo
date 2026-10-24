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
public class AgentesController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IRegiaoService _regiaoService;
    private readonly IHubContext<OperacoesHub> _hubContext;

    public AgentesController(AppDbContext context, IRegiaoService regiaoService, IHubContext<OperacoesHub> hubContext)
    {
        _context = context;
        _regiaoService = regiaoService;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<ActionResult<List<AgenteDto>>> GetAgentes(
        [FromQuery] CargoAgente? cargo,
        [FromQuery] StatusAgente? status,
        [FromQuery] int? regiaoId,
        [FromQuery] string? busca)
    {
        var query = _context.Agentes.AsNoTracking().Include(a => a.Regiao).AsQueryable();

        if (cargo.HasValue) query = query.Where(a => a.Cargo == cargo.Value);
        if (status.HasValue) query = query.Where(a => a.Status == status.Value);
        if (regiaoId.HasValue) query = query.Where(a => a.RegiaoId == regiaoId.Value);

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var b = busca.ToLower();
            query = query.Where(a => a.Nome.ToLower().Contains(b) || a.Matricula.ToLower().Contains(b));
        }

        var agentes = await query.ToListAsync();

        var dtos = agentes.Select(MapearDto).ToList();
        return Ok(dtos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AgenteDto>> GetAgente(int id)
    {
        var agente = await _context.Agentes.AsNoTracking().Include(a => a.Regiao).FirstOrDefaultAsync(a => a.Id == id);
        if (agente == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        return Ok(MapearDto(agente));
    }

    [HttpPost]
    public async Task<ActionResult<AgenteDto>> CriarAgente([FromBody] AgenteSalvarDto dto)
    {
        if (await _context.Agentes.AnyAsync(a => a.Matricula.ToLower() == dto.Matricula.ToLower()))
        {
            return Conflict(new ProblemDetails { Title = "Matrícula duplicada", Status = 409 });
        }

        int regiaoId = _regiaoService.ObterRegiaoId(dto.Latitude, dto.Longitude);

        var agente = new Agente
        {
            Nome = dto.Nome,
            Matricula = dto.Matricula,
            Cargo = dto.Cargo,
            Orgao = dto.Orgao,
            Telefone = dto.Telefone,
            Status = dto.Status,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            UltimaPosicaoEm = DateTime.UtcNow,
            RegiaoId = regiaoId,
            EquipamentoVinculadoId = dto.EquipamentoVinculadoId
        };

        _context.Agentes.Add(agente);
        await _context.SaveChangesAsync();

        var agenteSalvo = await _context.Agentes.Include(a => a.Regiao).FirstAsync(a => a.Id == agente.Id);
        var agenteDto = MapearDto(agenteSalvo);

        await _hubContext.Clients.All.SendAsync(EventosHub.AgenteAtualizado, agenteDto);

        return CreatedAtAction(nameof(GetAgente), new { id = agente.Id }, agenteDto);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<AgenteDto>> AtualizarAgente(int id, [FromBody] AgenteSalvarDto dto)
    {
        var agente = await _context.Agentes.Include(a => a.Regiao).FirstOrDefaultAsync(a => a.Id == id);
        if (agente == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        if (await _context.Agentes.AnyAsync(a => a.Matricula.ToLower() == dto.Matricula.ToLower() && a.Id != id))
        {
            return Conflict(new ProblemDetails { Title = "Matrícula duplicada", Status = 409 });
        }

        int regiaoId = _regiaoService.ObterRegiaoId(dto.Latitude, dto.Longitude);

        agente.Nome = dto.Nome;
        agente.Matricula = dto.Matricula;
        agente.Cargo = dto.Cargo;
        agente.Orgao = dto.Orgao;
        agente.Telefone = dto.Telefone;
        agente.Status = dto.Status;
        agente.Latitude = dto.Latitude;
        agente.Longitude = dto.Longitude;
        agente.UltimaPosicaoEm = DateTime.UtcNow;
        agente.RegiaoId = regiaoId;
        agente.EquipamentoVinculadoId = dto.EquipamentoVinculadoId;

        await _context.SaveChangesAsync();

        var agenteDto = MapearDto(agente);
        await _hubContext.Clients.All.SendAsync(EventosHub.AgenteAtualizado, agenteDto);

        return Ok(agenteDto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> ExcluirAgente(int id)
    {
        var agente = await _context.Agentes.FindAsync(id);
        if (agente == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        _context.Agentes.Remove(agente);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id:int}/status")]
    public async Task<ActionResult<AgenteDto>> AlterarStatus(int id, [FromBody] AlterarStatusAgenteDto dto)
    {
        var agente = await _context.Agentes.Include(a => a.Regiao).FirstOrDefaultAsync(a => a.Id == id);
        if (agente == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        agente.Status = dto.Status;
        agente.UltimaPosicaoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        var agenteDto = MapearDto(agente);
        await _hubContext.Clients.All.SendAsync(EventosHub.AgenteAtualizado, agenteDto);

        return Ok(agenteDto);
    }

    private static AgenteDto MapearDto(Agente a) => new()
    {
        Id = a.Id,
        Nome = a.Nome,
        Matricula = a.Matricula,
        Cargo = a.Cargo,
        Orgao = a.Orgao,
        Telefone = a.Telefone,
        Status = a.Status,
        Latitude = a.Latitude,
        Longitude = a.Longitude,
        UltimaPosicaoEm = a.UltimaPosicaoEm,
        RegiaoId = a.RegiaoId,
        RegiaoNome = a.Regiao?.Nome ?? string.Empty,
        EquipamentoVinculadoId = a.EquipamentoVinculadoId
    };
}