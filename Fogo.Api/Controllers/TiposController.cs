using System.Text.Json;
using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TiposController : ControllerBase
{
    private readonly AppDbContext _context;

    public TiposController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<TipoEquipamentoDto>>> GetTipos()
    {
        var tipos = await _context.TiposEquipamento.AsNoTracking().ToListAsync();

        var resultado = tipos.Select(t =>
        {
            object? schemaObj = null;
            if (!string.IsNullOrWhiteSpace(t.CamposSchemaJson))
            {
                try { schemaObj = JsonSerializer.Deserialize<object>(t.CamposSchemaJson); } catch { }
            }

            return new TipoEquipamentoDto
            {
                Id = t.Id,
                Codigo = t.Codigo,
                Nome = t.Nome,
                PrefixoSerie = t.PrefixoSerie,
                Icone = t.Icone,
                Cor = t.Cor,
                Movel = t.Movel,
                CamposSchema = schemaObj
            };
        }).ToList();

        return Ok(resultado);
    }
}