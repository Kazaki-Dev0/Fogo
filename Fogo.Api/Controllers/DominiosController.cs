using Fogo.Api.Data;
using Fogo.Api.Dtos;
using Fogo.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DominiosController : ControllerBase
{
    private readonly AppDbContext _context;

    public DominiosController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<DominiosDto>> GetDominios()
    {
        var bairros = await _context.Equipamentos.AsNoTracking()
            .Where(e => !string.IsNullOrWhiteSpace(e.Bairro))
            .Select(e => e.Bairro)
            .Distinct()
            .OrderBy(b => b)
            .ToListAsync();

        var dto = new DominiosDto
        {
            Situacoes = new List<OpcaoDto>
            {
                new() { Valor = "Operacional", Rotulo = "Operacional", Cor = "#22C55E" },
                new() { Valor = "MauFuncionamento", Rotulo = "Mau funcionamento", Cor = "#F59E0B" },
                new() { Valor = "EmManutencao", Rotulo = "Em manutenção", Cor = "#3B82F6" },
                new() { Valor = "Desativado", Rotulo = "Desativado", Cor = "#6B7280" },
                new() { Valor = "Furtado", Rotulo = "Furtado", Cor = "#EF4444" },
                new() { Valor = "NaoInstalado", Rotulo = "Não instalado", Cor = "#94A3B8" }
            },
            Orgaos = new List<OpcaoDto>
            {
                new() { Valor = "Emdurb", Rotulo = "EMDURB" },
                new() { Valor = "GuardaMunicipal", Rotulo = "Guarda Municipal" },
                new() { Valor = "PoliciaMilitar", Rotulo = "Polícia Militar" },
                new() { Valor = "Prefeitura", Rotulo = "Prefeitura" },
                new() { Valor = "Terceirizado", Rotulo = "Terceirizado" }
            },
            Cargos = new List<OpcaoDto>
            {
                new() { Valor = "AgenteTransito", Rotulo = "Agente de trânsito" },
                new() { Valor = "GuardaMunicipal", Rotulo = "Guarda Municipal" },
                new() { Valor = "Policial", Rotulo = "Policial" }
            },
            StatusAgente = new List<OpcaoDto>
            {
                new() { Valor = "EmAtividade", Rotulo = "Em atividade" },
                new() { Valor = "Disponivel", Rotulo = "Disponível" },
                new() { Valor = "Offline", Rotulo = "Offline" }
            },
            Criticidades = new List<OpcaoDto>
            {
                new() { Valor = "Critico", Rotulo = "Crítico", Cor = "#EF4444" },
                new() { Valor = "Atencao", Rotulo = "Atenção", Cor = "#F59E0B" },
                new() { Valor = "Info", Rotulo = "Informativo", Cor = "#38BDF8" }
            },
            NecessidadesManutencao = new List<OpcaoDto>
            {
                new() { Valor = "Nenhuma", Rotulo = "Nenhuma" },
                new() { Valor = "Agendada", Rotulo = "Agendada" },
                new() { Valor = "Imediata", Rotulo = "Imediata" }
            },
            Bairros = bairros
        };

        return Ok(dto);
    }
}