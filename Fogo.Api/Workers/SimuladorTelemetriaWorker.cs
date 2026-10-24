using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Hubs;
using Fogo.Api.Models;
using Fogo.Api.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Fogo.Api.Workers;

public class SimuladorTelemetriaWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<OperacoesHub> _hubContext;
    private readonly ResumoNotificador _resumoNotificador;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SimuladorTelemetriaWorker> _logger;
    private readonly Random _random = new(2026);

    public SimuladorTelemetriaWorker(
        IServiceScopeFactory scopeFactory,
        IHubContext<OperacoesHub> hubContext,
        ResumoNotificador resumoNotificador,
        IConfiguration configuration,
        ILogger<SimuladorTelemetriaWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _hubContext = hubContext;
        _resumoNotificador = resumoNotificador;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        int intervaloSegundos = _configuration.GetValue<int>("Simulacao:IntervaloSegundos", 5);
        int heartbeatSegundos = _configuration.GetValue<int>("Simulacao:HeartbeatSegundos", 30);

        double centroLat = _configuration.GetValue<double>("Cidade:CentroLatitude", -22.2171);
        double centroLon = _configuration.GetValue<double>("Cidade:CentroLongitude", -49.9501);
        double raioMaximoKm = 7.0;

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var alertaService = scope.ServiceProvider.GetRequiredService<IAlertaService>();

                bool houveMudanca = false;
                var agora = DateTime.UtcNow;

                // Carregar coleções em memória para evitar N+1 queries dentro dos loops
                var equipamentos = await db.Equipamentos
                    .Include(e => e.TipoEquipamento)
                    .ToListAsync(stoppingToken);

                var agentes = await db.Agentes
                    .ToListAsync(stoppingToken);

                var telemetriasParaInserir = new List<Telemetria>();

                // 1. Heartbeat
                foreach (var eq in equipamentos)
                {
                    bool elegivelHeartbeat = (eq.Situacao == Situacao.Operacional || eq.Situacao == Situacao.MauFuncionamento)
                                             && !eq.HeartbeatSuspenso;

                    if (elegivelHeartbeat && (agora - eq.UltimoHeartbeat).TotalSeconds >= heartbeatSegundos)
                    {
                        eq.UltimoHeartbeat = agora;
                        telemetriasParaInserir.Add(new Telemetria
                        {
                            EquipamentoId = eq.Id,
                            Timestamp = agora,
                            Tipo = "Heartbeat",
                            SituacaoNoMomento = eq.Situacao,
                            Valor = null
                        });
                        houveMudanca = true;
                    }
                }

                // 2. Movimento (Deslocamento de 20m a 60m sem sair do raio de ~7 km)
                foreach (var eq in equipamentos.Where(e => e.TipoEquipamento.Movel && e.Situacao == Situacao.Operacional))
                {
                    var (novaLat, novaLon) = DeslocarComLimite(eq.Latitude, eq.Longitude, centroLat, centroLon, raioMaximoKm);
                    eq.Latitude = novaLat;
                    eq.Longitude = novaLon;

                    var dto = EquipamentoMapper.ParaMapaDto(eq);
                    await _hubContext.Clients.All.SendAsync(EventosHub.EquipamentoAtualizado, dto, stoppingToken);
                    houveMudanca = true;
                }

                foreach (var ag in agentes.Where(a => a.Status == StatusAgente.EmAtividade))
                {
                    var (novaLat, novaLon) = DeslocarComLimite(ag.Latitude, ag.Longitude, centroLat, centroLon, raioMaximoKm);
                    ag.Latitude = novaLat;
                    ag.Longitude = novaLon;
                    ag.UltimaPosicaoEm = agora;

                    var dto = new AgenteDto
                    {
                        Id = ag.Id,
                        Nome = ag.Nome,
                        Matricula = ag.Matricula,
                        Cargo = ag.Cargo,
                        Orgao = ag.Orgao,
                        Telefone = ag.Telefone,
                        Status = ag.Status,
                        Latitude = ag.Latitude,
                        Longitude = ag.Longitude,
                        UltimaPosicaoEm = ag.UltimaPosicaoEm,
                        RegiaoId = ag.RegiaoId,
                        EquipamentoVinculadoId = ag.EquipamentoVinculadoId
                    };
                    await _hubContext.Clients.All.SendAsync(EventosHub.AgenteAtualizado, dto, stoppingToken);
                    houveMudanca = true;
                }

                // 3. Falhas espontâneas (ignora equipamentos com SituacaoBase definida manualmente)
                foreach (var eq in equipamentos.Where(e => !e.SituacaoBase.HasValue))
                {
                    if (eq.Situacao == Situacao.Operacional)
                    {
                        // ~0.3% de chance de virar MauFuncionamento
                        if (_random.NextDouble() < 0.003)
                        {
                            eq.Situacao = Situacao.MauFuncionamento;
                            eq.AtualizadoEm = agora;
                            telemetriasParaInserir.Add(new Telemetria
                            {
                                EquipamentoId = eq.Id,
                                Timestamp = agora,
                                Tipo = "MudancaSituacao",
                                SituacaoNoMomento = Situacao.MauFuncionamento
                            });
                            houveMudanca = true;
                        }
                    }
                    else if (eq.Situacao == Situacao.MauFuncionamento)
                    {
                        // ~5% de chance de voltar a Operacional
                        if (_random.NextDouble() < 0.05)
                        {
                            eq.Situacao = Situacao.Operacional;
                            eq.AtualizadoEm = agora;
                            telemetriasParaInserir.Add(new Telemetria
                            {
                                EquipamentoId = eq.Id,
                                Timestamp = agora,
                                Tipo = "MudancaSituacao",
                                SituacaoNoMomento = Situacao.Operacional
                            });
                            houveMudanca = true;
                        }
                    }
                }

                // Gravação em lote das telemetrias e alterações
                if (telemetriasParaInserir.Count > 0)
                {
                    db.Telemetrias.AddRange(telemetriasParaInserir);
                }

                await db.SaveChangesAsync(stoppingToken);

                // 4. Alertas (Avaliação das regras para todos os equipamentos)
                foreach (var eq in equipamentos)
                {
                    await alertaService.AvaliarRegrasEquipamentoAsync(eq.Id);
                }

                // 5. Resumo Notificador (Solicita emissão com throttle se houve alterações)
                if (houveMudanca)
                {
                    _resumoNotificador.Solicitar();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no ciclo do SimuladorTelemetriaWorker.");
            }

            await Task.Delay(TimeSpan.FromSeconds(intervaloSegundos), stoppingToken);
        }
    }

    private (double Latitude, double Longitude) DeslocarComLimite(
        double latAtual,
        double lonAtual,
        double centroLat,
        double centroLon,
        double raioMaxKm)
    {
        // 0.0002 a 0.0006 graus correspondem a aprox. 20 a 60 metros
        double distanciaGraus = 0.0002 + (_random.NextDouble() * 0.0004);
        double angulo = _random.NextDouble() * 2 * Math.PI;

        double novaLat = Math.Round(latAtual + (distanciaGraus * Math.Cos(angulo)), 6);
        double novaLon = Math.Round(lonAtual + (distanciaGraus * Math.Sin(angulo)), 6);

        // Validação de raio limite (~7 km do centro)
        double dLat = (novaLat - centroLat) * 111.0;
        double dLon = (novaLon - centroLon) * 111.0 * Math.Cos(centroLat * Math.PI / 180.0);
        double distanciaDoCentroKm = Math.Sqrt(dLat * dLat + dLon * dLon);

        if (distanciaDoCentroKm > raioMaxKm)
        {
            // Se saiu do raio, inverte o sentido de movimento voltando para o centro
            novaLat = Math.Round(latAtual - (distanciaGraus * Math.Cos(angulo)), 6);
            novaLon = Math.Round(lonAtual - (distanciaGraus * Math.Sin(angulo)), 6);
        }

        return (novaLat, novaLon);
    }
}