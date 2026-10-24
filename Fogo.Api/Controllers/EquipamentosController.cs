using System.Text.Json;
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
public class EquipamentosController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IRegiaoService _regiaoService;
    private readonly IAlertaService _alertaService;
    private readonly IHubContext<OperacoesHub> _hubContext;
    private readonly ResumoNotificador _resumoNotificador;

    public EquipamentosController(
        AppDbContext context,
        IRegiaoService regiaoService,
        IAlertaService alertaService,
        IHubContext<OperacoesHub> hubContext,
        ResumoNotificador resumoNotificador)
    {
        _context = context;
        _regiaoService = regiaoService;
        _alertaService = alertaService;
        _hubContext = hubContext;
        _resumoNotificador = resumoNotificador;
    }

    [HttpGet]
    public async Task<ActionResult<PaginadoDto<EquipamentoDetalheDto>>> GetEquipamentos(
        [FromQuery] string? tipo,
        [FromQuery] Situacao? situacao,
        [FromQuery] int? regiaoId,
        [FromQuery] string? bairro,
        [FromQuery] Orgao? orgao,
        [FromQuery] string? busca,
        [FromQuery] string? manutencao,
        [FromQuery] int pagina = 1,
        [FromQuery] int tamanho = 20)
    {
        tamanho = Math.Clamp(tamanho, 1, 200);
        pagina = Math.Max(1, pagina);

        var query = _context.Equipamentos.AsNoTracking()
            .Include(e => e.TipoEquipamento)
            .Include(e => e.Regiao)
            .AsQueryable();

        query = AplicarFiltros(query, tipo, situacao, regiaoId, bairro, orgao, busca, manutencao);

        int total = await query.CountAsync();

        var itens = await query
            .OrderByDescending(e => e.Id)
            .Skip((pagina - 1) * tamanho)
            .Take(tamanho)
            .ToListAsync();

        var dtos = itens.Select(EquipamentoMapper.ParaDetalheDto).ToList();

        return Ok(new PaginadoDto<EquipamentoDetalheDto>
        {
            Itens = dtos,
            Total = total,
            Pagina = pagina,
            Tamanho = tamanho
        });
    }

    [HttpGet("mapa")]
    public async Task<ActionResult<List<EquipamentoMapaDto>>> GetEquipamentosMapa(
        [FromQuery] string? tipo,
        [FromQuery] Situacao? situacao,
        [FromQuery] int? regiaoId,
        [FromQuery] string? bairro,
        [FromQuery] Orgao? orgao,
        [FromQuery] string? busca,
        [FromQuery] string? manutencao)
    {
        var query = _context.Equipamentos.AsNoTracking()
            .Include(e => e.TipoEquipamento)
            .AsQueryable();

        query = AplicarFiltros(query, tipo, situacao, regiaoId, bairro, orgao, busca, manutencao);

        var itens = await query.ToListAsync();
        var dtos = itens.Select(EquipamentoMapper.ParaMapaDto).ToList();

        return Ok(dtos);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<EquipamentoDetalheDto>> GetEquipamento(int id)
    {
        var eq = await _context.Equipamentos.AsNoTracking()
            .Include(e => e.TipoEquipamento)
            .Include(e => e.Regiao)
            .Include(e => e.Manutencoes)
            .Include(e => e.Alertas)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (eq == null)
        {
            return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404, Detail = "Equipamento não existe." });
        }

        return Ok(EquipamentoMapper.ParaDetalheDto(eq));
    }

    [HttpPost]
    public async Task<ActionResult<EquipamentoDetalheDto>> CriarEquipamento([FromBody] EquipamentoSalvarDto dto)
    {
        var tipoEq = await _context.TiposEquipamento.FirstOrDefaultAsync(t => t.Codigo.ToLower() == dto.TipoCodigo.ToLower());
        if (tipoEq == null)
        {
            return BadRequest(new ProblemDetails { Title = "Tipo inválido", Status = 400, Detail = "Código de tipo não cadastrado." });
        }

        if (await _context.Equipamentos.AnyAsync(e => e.NumeroSerie.ToLower() == dto.NumeroSerie.ToLower()))
        {
            return Conflict(new ProblemDetails { Title = "Série duplicada", Status = 409, Detail = "Número de série já cadastrado." });
        }

        int regiaoIdCalculada = _regiaoService.ObterRegiaoId(dto.Latitude, dto.Longitude);

        var eq = new Equipamento
        {
            TipoEquipamentoId = tipoEq.Id,
            NumeroSerie = dto.NumeroSerie,
            Marca = dto.Marca,
            Modelo = dto.Modelo,
            Cep = dto.Cep,
            Rua = dto.Rua,
            Bairro = dto.Bairro,
            Cidade = dto.Cidade,
            Uf = dto.Uf,
            Referencia = dto.Referencia,
            Latitude = dto.Latitude,
            Longitude = dto.Longitude,
            RegiaoId = regiaoIdCalculada,
            Orgao = dto.Orgao,
            Situacao = dto.Situacao,
            NecessidadeManutencao = dto.NecessidadeManutencao,
            ProximaManutencao = dto.ProximaManutencao,
            UltimoHeartbeat = DateTime.UtcNow,
            CaracteristicasJson = dto.Caracteristicas != null ? JsonSerializer.Serialize(dto.Caracteristicas) : "{}",
            CriadoEm = DateTime.UtcNow,
            AtualizadoEm = DateTime.UtcNow
        };

        _context.Equipamentos.Add(eq);
        await _context.SaveChangesAsync();

        await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);

        var eqSalvo = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao).FirstAsync(e => e.Id == eq.Id);
        var mapaDto = EquipamentoMapper.ParaMapaDto(eqSalvo);

        await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, mapaDto);
        _resumoNotificador.Solicitar();

        return CreatedAtAction(nameof(GetEquipamento), new { id = eq.Id }, EquipamentoMapper.ParaDetalheDto(eqSalvo));
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<EquipamentoDetalheDto>> AtualizarEquipamento(int id, [FromBody] EquipamentoSalvarDto dto)
    {
        var eq = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao).FirstOrDefaultAsync(e => e.Id == id);
        if (eq == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        var tipoEq = await _context.TiposEquipamento.FirstOrDefaultAsync(t => t.Codigo.ToLower() == dto.TipoCodigo.ToLower());
        if (tipoEq == null) return BadRequest(new ProblemDetails { Title = "Tipo inválido", Status = 400 });

        if (await _context.Equipamentos.AnyAsync(e => e.NumeroSerie.ToLower() == dto.NumeroSerie.ToLower() && e.Id != id))
        {
            return Conflict(new ProblemDetails { Title = "Série duplicada", Status = 409 });
        }

        int regiaoIdCalculada = _regiaoService.ObterRegiaoId(dto.Latitude, dto.Longitude);

        eq.TipoEquipamentoId = tipoEq.Id;
        eq.NumeroSerie = dto.NumeroSerie;
        eq.Marca = dto.Marca;
        eq.Modelo = dto.Modelo;
        eq.Cep = dto.Cep;
        eq.Rua = dto.Rua;
        eq.Bairro = dto.Bairro;
        eq.Cidade = dto.Cidade;
        eq.Uf = dto.Uf;
        eq.Referencia = dto.Referencia;
        eq.Latitude = dto.Latitude;
        eq.Longitude = dto.Longitude;
        eq.RegiaoId = regiaoIdCalculada;
        eq.Orgao = dto.Orgao;
        eq.Situacao = dto.Situacao;
        eq.NecessidadeManutencao = dto.NecessidadeManutencao;
        eq.ProximaManutencao = dto.ProximaManutencao;
        eq.CaracteristicasJson = dto.Caracteristicas != null ? JsonSerializer.Serialize(dto.Caracteristicas) : "{}";
        eq.AtualizadoEm = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);

        var mapaDto = EquipamentoMapper.ParaMapaDto(eq);
        await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, mapaDto);
        _resumoNotificador.Solicitar();

        return Ok(EquipamentoMapper.ParaDetalheDto(eq));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> ExcluirEquipamento(int id)
    {
        var eq = await _context.Equipamentos.FindAsync(id);
        if (eq == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        var manutencoes = await _context.Manutencoes.Where(m => m.EquipamentoId == id).ToListAsync();
        _context.Manutencoes.RemoveRange(manutencoes);

        var alertas = await _context.Alertas.Where(a => a.EquipamentoId == id).ToListAsync();
        _context.Alertas.RemoveRange(alertas);

        var telemetrias = await _context.Telemetrias.Where(t => t.EquipamentoId == id).ToListAsync();
        _context.Telemetrias.RemoveRange(telemetrias);

        _context.Equipamentos.Remove(eq);
        await _context.SaveChangesAsync();

        _resumoNotificador.Solicitar();
        return NoContent();
    }

    [HttpPatch("{id:int}/situacao")]
    public async Task<ActionResult<EquipamentoDetalheDto>> AlterarSituacao(int id, [FromBody] AlterarSituacaoDto dto)
    {
        var eq = await _context.Equipamentos.Include(e => e.TipoEquipamento).Include(e => e.Regiao).FirstOrDefaultAsync(e => e.Id == id);
        if (eq == null) return NotFound(new ProblemDetails { Title = "Não encontrado", Status = 404 });

        eq.Situacao = dto.Situacao;
        eq.AtualizadoEm = DateTime.UtcNow;

        var telemetria = new Telemetria
        {
            EquipamentoId = eq.Id,
            Timestamp = DateTime.UtcNow,
            Tipo = "MudancaSituacao",
            SituacaoNoMomento = dto.Situacao,
            Valor = null
        };
        _context.Telemetrias.Add(telemetria);

        await _context.SaveChangesAsync();

        await _alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);

        var mapaDto = EquipamentoMapper.ParaMapaDto(eq);
        await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, mapaDto);
        _resumoNotificador.Solicitar();

        return Ok(EquipamentoMapper.ParaDetalheDto(eq));
    }

    private static IQueryable<Equipamento> AplicarFiltros(
        IQueryable<Equipamento> query,
        string? tipo,
        Situacao? situacao,
        int? regiaoId,
        string? bairro,
        Orgao? orgao,
        string? busca,
        string? manutencao)
    {
        if (!string.IsNullOrWhiteSpace(tipo))
            query = query.Where(e => e.TipoEquipamento.Codigo.ToLower() == tipo.ToLower());

        if (situacao.HasValue)
            query = query.Where(e => e.Situacao == situacao.Value);

        if (regiaoId.HasValue)
            query = query.Where(e => e.RegiaoId == regiaoId.Value);

        if (!string.IsNullOrWhiteSpace(bairro))
            query = query.Where(e => e.Bairro.ToLower() == bairro.ToLower());

        if (orgao.HasValue)
            query = query.Where(e => e.Orgao == orgao.Value);

        if (!string.IsNullOrWhiteSpace(busca))
        {
            var b = busca.ToLower();
            query = query.Where(e =>
                e.NumeroSerie.ToLower().Contains(b) ||
                e.Marca.ToLower().Contains(b) ||
                e.Modelo.ToLower().Contains(b) ||
                e.Rua.ToLower().Contains(b));
        }

        if (!string.IsNullOrWhiteSpace(manutencao))
        {
            var m = manutencao.ToLower();
            var hoje = DateOnly.FromDateTime(DateTime.UtcNow);

            if (m == "imediata")
            {
                query = query.Where(e => e.NecessidadeManutencao == NecessidadeManutencao.Imediata);
            }
            else if (m == "proxima")
            {
                var limite = hoje.AddDays(7);
                query = query.Where(e => e.ProximaManutencao.HasValue && e.ProximaManutencao.Value >= hoje && e.ProximaManutencao.Value <= limite);
            }
        }

        return query;
    }
}