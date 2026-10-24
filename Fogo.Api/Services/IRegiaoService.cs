namespace Fogo.Api.Services;

public interface IRegiaoService
{
    int ObterRegiaoId(double latitude, double longitude);
}