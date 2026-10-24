using Bogus;
using Fogo.Api.Data;
using Fogo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Data.Seed;

public class HistoricoSeeder
{
    private readonly AppDbContext _context;

    public HistoricoSeeder(AppDbContext context)
    {
        _context = context;
    }

    public async Task ExecutarAsync()
    {
        if (await _context.Ocorrencias.AnyAsync()) return;

        var rand = Randomizer.Seed;
        var regioes = await _context.Regioes.ToListAsync();
        var equipamentos = await _context.Equipamentos.Include(e => e.TipoEquipamento).ToListAsync();

        if (regioes.Count == 0 || equipamentos.Count == 0) return;

        var regCentro = regioes.FirstOrDefault(r => r.Codigo == "centro") ?? regioes.First();
        var regSul = regioes.FirstOrDefault(r => r.Codigo == "sul") ?? regioes.First();

        var ocorrencias = new List<Ocorrencia>();
        var telemetrias = new List<Telemetria>();

        var dataInicio = DateTime.UtcNow.AddDays(-90);
        var dataHoje = DateTime.UtcNow;

        var tiposOcorrencia = Enum.GetValues<TipoOcorrencia>();

        // Identificar modelo de radar para falha 3x maior
        var radarProblematico = equipamentos.FirstOrDefault(e => e.TipoEquipamento.Codigo == "radar" && e.Modelo.Contains("100"));

        for (var data = dataInicio.Date; data <= dataHoje.Date; data = data.AddDays(1))
        {
            int qtdOcorrenciasDia = rand.Next(8, 16);

            // Dias atípicos (3x ocorrências normais em 2 ou 3 dias do mês)
            if (data.Day == 10 || data.Day == 20) qtdOcorrenciasDia *= 3;

            for (int i = 0; i < qtdOcorrenciasDia; i++)
            {
                int hora;
                if (rand.NextDouble() < 0.65)
                {
                    // Pico 7h-9h e 17h-19h
                    hora = rand.Next(2) == 0 ? rand.Next(7, 10) : rand.Next(17, 20);
                }
                else
                {
                    hora = rand.Next(0, 24);
                }

                // Sexta-feira à noite com pico de velocidade e acidente
                TipoOcorrencia tipoOc = tiposOcorrencia[rand.Next(tiposOcorrencia.Length)];
                if (data.DayOfWeek == DayOfWeek.Friday && hora >= 18)
                {
                    tipoOc = rand.Next(2) == 0 ? TipoOcorrencia.InfracaoVelocidade : TipoOcorrencia.Acidente;
                }

                // Domingo com volume menor
                if (data.DayOfWeek == DayOfWeek.Sunday && rand.NextDouble() < 0.4) continue;

                // Mais ocorrências no Centro e na Zona Sul
                Regiao reg = (rand.NextDouble() < 0.6)
                    ? (rand.Next(2) == 0 ? regCentro : regSul)
                    : regioes[rand.Next(regioes.Count)];

                var dataHora = new DateTime(data.Year, data.Month, data.Day, hora, rand.Next(0, 60), rand.Next(0, 60), DateTimeKind.Utc);

                var oc = new Ocorrencia
                {
                    Tipo = tipoOc,
                    Gravidade = rand.Next(1, 4),
                    RegiaoId = reg.Id,
                    Latitude = reg.Latitude + (rand.NextDouble() - 0.5) * 0.02,
                    Longitude = reg.Longitude + (rand.NextDouble() - 0.5) * 0.02,
                    DataHora = dataHora
                };
                ocorrencias.Add(oc);
            }

            // Telemetria diária por equipamento (1 Heartbeat por dia)
            foreach (var eq in equipamentos)
            {
                telemetrias.Add(new Telemetria
                {
                    EquipamentoId = eq.Id,
                    Timestamp = new DateTime(data.Year, data.Month, data.Day, 12, 0, 0, DateTimeKind.Utc),
                    Tipo = "Heartbeat",
                    SituacaoNoMomento = eq.Situacao,
                    Valor = null
                });

                // Registrar Mudança de Situação para equipamentos com falhas registradas
                double chanceFalha = 0.01;
                if (radarProblematico != null && eq.Modelo == radarProblematico.Modelo) chanceFalha *= 3;
                if (eq.NecessidadeManutencao == NecessidadeManutencao.Imediata) chanceFalha *= 2;

                if (rand.NextDouble() < chanceFalha)
                {
                    telemetrias.Add(new Telemetria
                    {
                        EquipamentoId = eq.Id,
                        Timestamp = new DateTime(data.Year, data.Month, data.Day, rand.Next(1, 23), rand.Next(0, 60), 0, DateTimeKind.Utc),
                        Tipo = "MudancaSituacao",
                        SituacaoNoMomento = Situacao.MauFuncionamento,
                        Valor = null
                    });
                }
            }
        }

        // Inserções em Lotes de 1000
        for (int i = 0; i < ocorrencias.Count; i += 1000)
        {
            _context.Ocorrencias.AddRange(ocorrencias.Skip(i).Take(1000));
            await _context.SaveChangesAsync();
        }

        for (int i = 0; i < telemetrias.Count; i += 1000)
        {
            _context.Telemetrias.AddRange(telemetrias.Skip(i).Take(1000));
            await _context.SaveChangesAsync();
        }
    }
}