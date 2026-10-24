using Fogo.Api.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;

namespace Fogo.Api.Services;

public class ResumoNotificador
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<OperacoesHub> _hubContext;
    private DateTime _ultimaNotificacao = DateTime.MinValue;
    private readonly object _lock = new();

    public ResumoNotificador(IServiceScopeFactory scopeFactory, IHubContext<OperacoesHub> hubContext)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
    }

    public void Solicitar()
    {
        lock (_lock)
        {
            if ((DateTime.UtcNow - _ultimaNotificacao).TotalSeconds < 2) return;
            _ultimaNotificacao = DateTime.UtcNow;
        }

        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var dashboardService = scope.ServiceProvider.GetRequiredService<IDashboardService>();
                var resumo = await dashboardService.ObterResumoAsync();
                await _hubContext.Clients.All.SendAsync(EventosHub.ResumoAtualizado, resumo);
            }
            catch
            {
                // Ignora falhas assíncronas no disparo em tempo real
            }
        });
    }
}