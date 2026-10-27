using Fogo.Api.Dtos;

namespace Fogo.Api.Services;

public interface IPrevisaoService
{
    Task<RiscoRegioesDto> ObterRiscoRegioesAsync(DateOnly? data, bool forcar);
    Task<DemandaAgentesDto> ObterDemandaAgentesAsync(DateOnly? data, bool forcar);
    Task<ManutencaoPreditivaDto> ObterManutencaoAsync(int top, bool forcar);
    Task<AnomaliasDto> ObterAnomaliasAsync(int dias, bool forcar);
    Task<RecomendacoesDto> ObterRecomendacoesAsync(bool forcar);
}