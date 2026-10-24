using Fogo.Api.Dtos;
using Fogo.Api.Models;

namespace Fogo.Api.Services;

public interface IAlertaService
{
    Task AvaliarRegrasEquipamentoAsync(int equipamentoId);
    Task<AlertaDto> CriarAlertaManualAsync(Alerta alerta);
    Task<AlertaDto?> ReconhecerAlertaAsync(int alertaId);
    Task<AlertaDto?> ResolverAlertaAsync(int alertaId);
}