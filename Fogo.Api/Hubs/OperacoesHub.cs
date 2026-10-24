using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace Fogo.Api.Hubs;

[Authorize]
public class OperacoesHub : Hub
{
}