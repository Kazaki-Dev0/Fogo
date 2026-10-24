using Fogo.Api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Fogo.Api.Services;

public class RegiaoService : IRegiaoService
{
    private readonly AppDbContext _context;
    private readonly double _centroLat;
    private readonly double _centroLon;

    public RegiaoService(AppDbContext context, IConfiguration configuration)
    {
        _context = context;
        _centroLat = configuration.GetValue<double>("Cidade:CentroLatitude", -22.2171);
        _centroLon = configuration.GetValue<double>("Cidade:CentroLongitude", -49.9501);
    }

    public int ObterRegiaoId(double latitude, double longitude)
    {
        double dLat = latitude - _centroLat;
        double dLon = longitude - _centroLon;

        string codigoDesejado;

        if (Math.Abs(dLat) < 0.012 && Math.Abs(dLon) < 0.012)
        {
            codigoDesejado = "centro";
        }
        else if (Math.Abs(dLat) >= Math.Abs(dLon))
        {
            codigoDesejado = dLat > 0 ? "norte" : "sul";
        }
        else
        {
            codigoDesejado = dLon > 0 ? "leste" : "oeste";
        }

        var regiao = _context.Regioes.AsNoTracking().FirstOrDefault(r => r.Codigo.ToLower() == codigoDesejado);
        if (regiao != null) return regiao.Id;

        var primeiraRegiao = _context.Regioes.AsNoTracking().FirstOrDefault();
        return primeiraRegiao?.Id ?? 1;
    }
}