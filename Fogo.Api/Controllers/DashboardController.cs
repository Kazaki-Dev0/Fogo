using Fogo.Api.Dtos;
using Fogo.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IDashboardService _dashboardService;

    public DashboardController(IDashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    [HttpGet("resumo")]
    public async Task<ActionResult<ResumoDto>> GetResumo()
    {
        var resumo = await _dashboardService.ObterResumoAsync();
        return Ok(resumo);
    }

    [HttpGet("manutencoes")]
    public async Task<ActionResult<List<ManutencaoDto>>> GetManutencoes([FromQuery] int dias = 7)
    {
        var manutencoes = await _dashboardService.ObterManutencoesAsync(dias);
        return Ok(manutencoes);
    }
}