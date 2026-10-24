using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public IActionResult GetHealth()
    {
        return Ok(new
        {
            status = "ok",
            versao = "1.0.0",
            horaServidor = DateTime.UtcNow
        });
    }
}