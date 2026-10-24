using System.Text.Json;
using Bogus;
using Fogo.Api.Data;
using Fogo.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Fogo.Api.Data.Seed;

public class SeedService
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHostEnvironment _env;
    private readonly HistoricoSeeder _historicoSeeder;

    public SeedService(
        AppDbContext context,
        IConfiguration configuration,
        IHostEnvironment env,
        HistoricoSeeder historicoSeeder)
    {
        _context = context;
        _configuration = configuration;
        _env = env;
        _historicoSeeder = historicoSeeder;
    }

    public async Task ExecutarAsync()
    {
        if (await _context.Equipamentos.AnyAsync())
        {
            return;
        }

        Randomizer.Seed = new Random(2026);
        var rand = Randomizer.Seed;

        double centroLat = _configuration.GetValue<double>("Cidade:CentroLatitude", -22.2171);
        double centroLon = _configuration.GetValue<double>("Cidade:CentroLongitude", -49.9501);

        // 1. Regiões
        if (!await _context.Regioes.AnyAsync())
        {
            var regioesNovas = new List<Regiao>
            {
                new() { Codigo = "centro", Nome = "Centro", Latitude = centroLat, Longitude = centroLon },
                new() { Codigo = "norte", Nome = "Zona Norte", Latitude = centroLat + 0.03, Longitude = centroLon },
                new() { Codigo = "sul", Nome = "Zona Sul", Latitude = centroLat - 0.03, Longitude = centroLon },
                new() { Codigo = "leste", Nome = "Zona Leste", Latitude = centroLat, Longitude = centroLon + 0.03 },
                new() { Codigo = "oeste", Nome = "Zona Oeste", Latitude = centroLat, Longitude = centroLon - 0.03 }
            };
            _context.Regioes.AddRange(regioesNovas);
            await _context.SaveChangesAsync();
        }

        // 2. Tipos de Equipamento
        if (!await _context.TiposEquipamento.AnyAsync())
        {
            var tiposNovos = ObterTiposComSchemas();
            _context.TiposEquipamento.AddRange(tiposNovos);
            await _context.SaveChangesAsync();
        }

        // 3. Usuário Admin
        if (!await _context.Usuarios.AnyAsync(u => u.Email == "admin@fogo.local"))
        {
            var admin = new Usuario
            {
                Nome = "Administrador",
                Email = "admin@fogo.local",
                SenhaHash = BCrypt.Net.BCrypt.HashPassword("Fogo@2026"),
                Perfil = Perfil.Admin,
                CriadoEm = DateTime.UtcNow
            };
            _context.Usuarios.Add(admin);
            await _context.SaveChangesAsync();
        }

        var mapaTipos = await _context.TiposEquipamento.AsNoTracking().ToDictionaryAsync(t => t.Codigo.ToLower(), t => t.Id);
        var mapaRegioes = await _context.Regioes.AsNoTracking().ToDictionaryAsync(r => r.Codigo.ToLower(), r => r.Id);
        int regiaoPadraoId = mapaRegioes.Values.First();

        // 4. Carregar Pontos e Bairros
        var (pontosOsm, bairrosOsm) = CarregarDadosOsm(centroLat, centroLon);

        // 5. Gerar Equipamentos
        var equipamentos = new List<Equipamento>();
        int pontoIdx = 0;
        int sequencialGlobal = 1000;

        var distribuicao = new (string Codigo, int Qtd)[]
        {
            ("radar", 30), ("camera", 60), ("balanca", 4),
            ("veiculo_fiscalizacao", 8), ("cancela", 12), ("taxi", 20),
            ("mototaxi", 10), ("escolar", 12), ("totem", 15),
            ("patinete", 40), ("moto_agente", 12), ("viatura_gm", 10),
            ("viatura_pm", 12)
        };

        foreach (var (codigoTipo, qtd) in distribuicao)
        {
            if (!mapaTipos.TryGetValue(codigoTipo.ToLower(), out int tipoId))
            {
                continue;
            }

            string prefixo = ObterPrefixoPorCodigo(codigoTipo);

            for (int i = 1; i <= qtd; i++)
            {
                var (latBase, lonBase) = pontosOsm[pontoIdx % pontosOsm.Count];
                pontoIdx++;
                sequencialGlobal++;

                double lat = Math.Round(latBase + (rand.NextDouble() - 0.5) * 0.004, 6);
                double lon = Math.Round(lonBase + (rand.NextDouble() - 0.5) * 0.004, 6);

                int regId = ObterRegiaoIdPorCoordenada(lat, lon, centroLat, centroLon, mapaRegioes, regiaoPadraoId);

                Situacao sit = rand.Next(100) switch
                {
                    < 82 => Situacao.Operacional,
                    < 88 => Situacao.MauFuncionamento,
                    < 92 => Situacao.EmManutencao,
                    < 95 => Situacao.Desativado,
                    < 96 => Situacao.Furtado,
                    _ => Situacao.NaoInstalado
                };

                if (codigoTipo == "radar" && i > 25) sit = Situacao.Desativado;

                NecessidadeManutencao necMan = NecessidadeManutencao.Nenhuma;
                DateOnly? proxMan = null;

                if (sit == Situacao.MauFuncionamento)
                {
                    necMan = NecessidadeManutencao.Imediata;
                    proxMan = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-rand.Next(1, 5)));
                }
                else if (rand.Next(100) < 15)
                {
                    necMan = NecessidadeManutencao.Agendada;
                    proxMan = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(rand.Next(1, 20)));
                }

                string bairro = bairrosOsm[rand.Next(bairrosOsm.Count)];
                if (bairro.Length > 80) bairro = bairro[..80];

                // Sequencial garantidamente único por equipamento
                string numSerie = $"{prefixo}-{sequencialGlobal}";

                var eq = new Equipamento
                {
                    TipoEquipamentoId = tipoId,
                    NumeroSerie = numSerie,
                    Marca = ObterMarcaPlausivel(codigoTipo, rand),
                    Modelo = $"Mod-{rand.Next(100, 999)}",
                    Cep = $"175{rand.Next(10, 26):D2}-{rand.Next(100, 999):D3}",
                    Rua = $"Rua de {bairro}",
                    Bairro = bairro,
                    Cidade = "Marília",
                    Uf = "SP",
                    Referencia = "Cruzamento principal",
                    Latitude = lat,
                    Longitude = lon,
                    RegiaoId = regId,
                    Orgao = ObterOrgaoPorTipo(codigoTipo),
                    Situacao = sit,
                    NecessidadeManutencao = necMan,
                    ProximaManutencao = proxMan,
                    UltimoHeartbeat = DateTime.UtcNow,
                    CaracteristicasJson = "{}",
                    CriadoEm = DateTime.UtcNow.AddDays(-90),
                    AtualizadoEm = DateTime.UtcNow
                };

                equipamentos.Add(eq);
            }
        }

        try
        {
            _context.Equipamentos.AddRange(equipamentos);
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateException ex)
        {
            var detalhe = ex.InnerException?.Message ?? ex.Message;
            throw new Exception($"Erro ao salvar Equipamentos no Seed: {detalhe}", ex);
        }

        // 6. Gerar Agentes
        var agentes = new List<Agente>();
        var cargos = Enum.GetValues<CargoAgente>();

        for (int i = 1; i <= 45; i++)
        {
            var (latBase, lonBase) = pontosOsm[pontoIdx % pontosOsm.Count];
            pontoIdx++;

            double lat = Math.Round(latBase + (rand.NextDouble() - 0.5) * 0.003, 6);
            double lon = Math.Round(lonBase + (rand.NextDouble() - 0.5) * 0.003, 6);

            int regId = ObterRegiaoIdPorCoordenada(lat, lon, centroLat, centroLon, mapaRegioes, regiaoPadraoId);
            var cargo = cargos[rand.Next(cargos.Length)];
            StatusAgente st = rand.Next(100) < 70 ? StatusAgente.EmAtividade : StatusAgente.Disponivel;

            var ag = new Agente
            {
                Nome = $"Agente {i}",
                Matricula = $"AGT-{i:D4}",
                Cargo = cargo,
                Orgao = cargo == CargoAgente.GuardaMunicipal ? Orgao.GuardaMunicipal : (cargo == CargoAgente.Policial ? Orgao.PoliciaMilitar : Orgao.Emdurb),
                Telefone = $"(14) 99888-{i:D4}",
                Status = st,
                Latitude = lat,
                Longitude = lon,
                UltimaPosicaoEm = DateTime.UtcNow,
                RegiaoId = regId
            };
            agentes.Add(ag);
        }

        _context.Agentes.AddRange(agentes);
        await _context.SaveChangesAsync();

        // 7. Executar Seeder Histórico
        await _historicoSeeder.ExecutarAsync();
    }

    private (List<(double Lat, double Lon)> Pontos, List<string> Bairros) CarregarDadosOsm(double cLat, double cLon)
    {
        var pontos = new List<(double, double)>();
        var bairros = new List<string>();

        string path = Path.Combine(AppContext.BaseDirectory, "Data", "Seed", "osm-marilia.json");

        if (File.Exists(path))
        {
            try
            {
                string json = File.ReadAllText(path);
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("elements", out var elements))
                {
                    foreach (var elem in elements.EnumerateArray())
                    {
                        if (elem.TryGetProperty("lat", out var latProp) && elem.TryGetProperty("lon", out var lonProp))
                        {
                            pontos.Add((latProp.GetDouble(), lonProp.GetDouble()));
                        }

                        if (elem.TryGetProperty("tags", out var tags) && tags.TryGetProperty("name", out var nameProp))
                        {
                            string nome = nameProp.GetString() ?? "";
                            if (!string.IsNullOrWhiteSpace(nome) && !bairros.Contains(nome))
                            {
                                bairros.Add(nome);
                            }
                        }
                    }
                }
            }
            catch { }
        }

        if (pontos.Count == 0)
        {
            var rand = Randomizer.Seed;
            for (int i = 0; i < 300; i++)
            {
                pontos.Add((cLat + (rand.NextDouble() - 0.5) * 0.12, cLon + (rand.NextDouble() - 0.5) * 0.12));
            }
        }

        if (bairros.Count == 0)
        {
            bairros.AddRange(new[] { "Centro", "Fragata", "Palmital", "Nova Marília", "Marília Shopping", "Banzato", "Altaneira" });
        }

        return (pontos, bairros);
    }

    private static int ObterRegiaoIdPorCoordenada(double lat, double lon, double cLat, double cLon, Dictionary<string, int> mapaRegioes, int padraoId)
    {
        double dLat = lat - cLat;
        double dLon = lon - cLon;

        string cod = (Math.Abs(dLat) < 0.012 && Math.Abs(dLon) < 0.012)
            ? "centro"
            : (Math.Abs(dLat) >= Math.Abs(dLon) ? (dLat > 0 ? "norte" : "sul") : (dLon > 0 ? "leste" : "oeste"));

        return mapaRegioes.TryGetValue(cod, out int id) ? id : padraoId;
    }

    private static List<TipoEquipamento> ObterTiposComSchemas()
    {
        return new List<TipoEquipamento>
        {
            new() { Codigo = "radar", Nome = "Radar de trânsito", PrefixoSerie = "RAD", Icone = "📡", Cor = "#38BDF8", Movel = false, CamposSchemaJson = "[]" },
            new() { Codigo = "camera", Nome = "Câmera de videomonitoramento", PrefixoSerie = "CAM", Icone = "📹", Cor = "#22D3EE", Movel = false, CamposSchemaJson = "[]" },
            new() { Codigo = "balanca", Nome = "Balança de caminhão", PrefixoSerie = "BAL", Icone = "⚖️", Cor = "#A78BFA", Movel = false, CamposSchemaJson = "[]" },
            new() { Codigo = "veiculo_fiscalizacao", Nome = "Veículo autônomo de fiscalização", PrefixoSerie = "FIS", Icone = "🚙", Cor = "#60A5FA", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "cancela", Nome = "Cancela / portão automatizado", PrefixoSerie = "CAN", Icone = "🚧", Cor = "#FBBF24", Movel = false, CamposSchemaJson = "[]" },
            new() { Codigo = "taxi", Nome = "Táxi", PrefixoSerie = "TAX", Icone = "🚕", Cor = "#FACC15", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "mototaxi", Nome = "Mototáxi", PrefixoSerie = "MOT", Icone = "🛵", Cor = "#FB923C", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "escolar", Nome = "Transporte escolar", PrefixoSerie = "ESC", Icone = "🚌", Cor = "#F59E0B", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "totem", Nome = "Totem de estacionamento rotativo", PrefixoSerie = "TOT", Icone = "🅿️", Cor = "#2DD4BF", Movel = false, CamposSchemaJson = "[]" },
            new() { Codigo = "patinete", Nome = "Patinete elétrico compartilhado", PrefixoSerie = "PAT", Icone = "🛴", Cor = "#4ADE80", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "moto_agente", Nome = "Moto de agente de trânsito", PrefixoSerie = "MAG", Icone = "🏍️", Cor = "#818CF8", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "viatura_gm", Nome = "Viatura da Guarda Municipal", PrefixoSerie = "GCM", Icone = "🚔", Cor = "#3B82F6", Movel = true, CamposSchemaJson = "[]" },
            new() { Codigo = "viatura_pm", Nome = "Viatura da Polícia Militar", PrefixoSerie = "VPM", Icone = "🏎️", Cor = "#6366F1", Movel = true, CamposSchemaJson = "[]" }
        };
    }

    private static string ObterPrefixoPorCodigo(string codigo) => codigo switch
    {
        "radar" => "RAD",
        "camera" => "CAM",
        "balanca" => "BAL",
        "veiculo_fiscalizacao" => "FIS",
        "cancela" => "CAN",
        "taxi" => "TAX",
        "mototaxi" => "MOT",
        "escolar" => "ESC",
        "totem" => "TOT",
        "patinete" => "PAT",
        "moto_agente" => "MAG",
        "viatura_gm" => "GCM",
        "viatura_pm" => "VPM",
        _ => "EQP"
    };

    private static string ObterMarcaPlausivel(string codigo, Random r) => codigo switch
    {
        "radar" => r.Next(2) == 0 ? "Perkons" : "Kapsch",
        "camera" => r.Next(2) == 0 ? "Hikvision" : "Intelbras",
        "balanca" => "Toledo",
        _ => "Genérica"
    };

    private static Orgao ObterOrgaoPorTipo(string codigo) => codigo switch
    {
        "viatura_gm" => Orgao.GuardaMunicipal,
        "viatura_pm" => Orgao.PoliciaMilitar,
        _ => Orgao.Emdurb
    };
}