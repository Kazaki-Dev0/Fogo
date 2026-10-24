using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Models;
using Fogo.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IJwtService _jwtService;

    public AuthController(AppDbContext context, IJwtService jwtService)
    {
        _context = context;
        _jwtService = jwtService;
    }

    [HttpPost("registrar")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginRespostaDto>> Registrar([FromBody] RegistrarDto dto)
    {
        if (await _context.Usuarios.AnyAsync(u => u.Email.ToLower() == dto.Email.ToLower()))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflito de e-mail",
                Status = 409,
                Detail = "Já existe um usuário cadastrado com este e-mail."
            });
        }

        var usuario = new Usuario
        {
            Nome = dto.Nome,
            Email = dto.Email,
            SenhaHash = BCrypt.Net.BCrypt.HashPassword(dto.Senha),
            Perfil = Perfil.Gestor,
            CriadoEm = DateTime.UtcNow
        };

        _context.Usuarios.Add(usuario);
        await _context.SaveChangesAsync();

        var token = _jwtService.GerarToken(usuario, out var expiraEm);

        return StatusCode(201, new LoginRespostaDto
        {
            Token = token,
            ExpiraEm = expiraEm,
            Usuario = new UsuarioDto
            {
                Id = usuario.Id,
                Nome = usuario.Nome,
                Email = usuario.Email,
                Perfil = usuario.Perfil
            }
        });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginRespostaDto>> Login([FromBody] LoginDto dto)
    {
        var usuario = await _context.Usuarios.FirstOrDefaultAsync(u => u.Email.ToLower() == dto.Email.ToLower());

        if (usuario == null || !BCrypt.Net.BCrypt.Verify(dto.Senha, usuario.SenhaHash))
        {
            return Unauthorized(new ProblemDetails
            {
                Title = "Não autorizado",
                Status = 401,
                Detail = "Credenciais inválidas."
            });
        }

        var token = _jwtService.GerarToken(usuario, out var expiraEm);

        return Ok(new LoginRespostaDto
        {
            Token = token,
            ExpiraEm = expiraEm,
            Usuario = new UsuarioDto
            {
                Id = usuario.Id,
                Nome = usuario.Nome,
                Email = usuario.Email,
                Perfil = usuario.Perfil
            }
        });
    }

    [HttpGet("me")]
    public async Task<ActionResult<UsuarioDto>> GetMe()
    {
        var email = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var usuario = await _context.Usuarios.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        if (usuario == null)
        {
            return NotFound(new ProblemDetails
            {
                Title = "Usuário não encontrado",
                Status = 404,
                Detail = "Usuário autenticado não existe na base."
            });
        }

        return Ok(new UsuarioDto
        {
            Id = usuario.Id,
            Nome = usuario.Nome,
            Email = usuario.Email,
            Perfil = usuario.Perfil
        });
    }
}