using Fogo.Api.Dtos;

namespace Fogo.Api.Services;

public interface IDashboardService
{
    Task<ResumoDto> ObterResumoAsync();
    Task<List<ManutencaoDto>> ObterManutencoesAsync(int dias);
}