using Fogo.Api.Models;

namespace Fogo.Api.Services;

public interface IJwtService
{
    string GerarToken(Usuario usuario, out DateTime expiraEm);
}