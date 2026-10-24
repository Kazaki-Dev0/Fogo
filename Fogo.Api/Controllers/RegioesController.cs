using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RegioesController : ControllerBase
{
    private readonly AppDbContext _context;

    public RegioesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<List<RegiaoDto>>> GetRegioes()
    {
        var regioes = await _context.Regioes.AsNoTracking()
            .Select(r => new RegiaoDto
            {
                Id = r.Id,
                Codigo = r.Codigo,
                Nome = r.Nome,
                Latitude = r.Latitude,
                Longitude = r.Longitude
            })
            .ToListAsync();

        return Ok(regioes);
    }
}