using Fogo.Api.Dtos;
using Fogo.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fogo.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/previsao")]
public class PrevisaoController : ControllerBase
{
    private readonly IPrevisaoService _previsao;

    public PrevisaoController(IPrevisaoService previsao)
    {
        _previsao = previsao;
    }

    [HttpGet("risco-regioes")]
    public async Task<ActionResult<RiscoRegioesDto>> RiscoRegioes([FromQuery] DateOnly? data, [FromQuery] bool forcar = false)
        => Ok(await _previsao.ObterRiscoRegioesAsync(data, forcar));

    [HttpGet("demanda-agentes")]
    public async Task<ActionResult<DemandaAgentesDto>> DemandaAgentes([FromQuery] DateOnly? data, [FromQuery] bool forcar = false)
        => Ok(await _previsao.ObterDemandaAgentesAsync(data, forcar));

    [HttpGet("manutencao")]
    public async Task<ActionResult<ManutencaoPreditivaDto>> Manutencao([FromQuery] int top = 20, [FromQuery] bool forcar = false)
        => Ok(await _previsao.ObterManutencaoAsync(Math.Clamp(top, 1, 100), forcar));

    [HttpGet("anomalias")]
    public async Task<ActionResult<AnomaliasDto>> Anomalias([FromQuery] int dias = 7, [FromQuery] bool forcar = false)
        => Ok(await _previsao.ObterAnomaliasAsync(Math.Clamp(dias, 1, 30), forcar));

    [HttpGet("recomendacoes")]
    public async Task<ActionResult<RecomendacoesDto>> Recomendacoes([FromQuery] bool forcar = false)
        => Ok(await _previsao.ObterRecomendacoesAsync(forcar));
}