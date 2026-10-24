using System.Text.Json;
using Fogo.Api.Dtos;
using Fogo.Api.Models;

namespace Fogo.Api.Services;

public static class EquipamentoMapper
{
    public static EquipamentoMapaDto ParaMapaDto(Equipamento e)
    {
        return new EquipamentoMapaDto
        {
            Id = e.Id,
            TipoCodigo = e.TipoEquipamento?.Codigo ?? string.Empty,
            TipoNome = e.TipoEquipamento?.Nome ?? string.Empty,
            NumeroSerie = e.NumeroSerie,
            Marca = e.Marca,
            Modelo = e.Modelo,
            Latitude = e.Latitude,
            Longitude = e.Longitude,
            Situacao = e.Situacao,
            NecessidadeManutencao = e.NecessidadeManutencao,
            ProximaManutencao = e.ProximaManutencao,
            RegiaoId = e.RegiaoId,
            Bairro = e.Bairro,
            Orgao = e.Orgao,
            UltimoHeartbeat = e.UltimoHeartbeat
        };
    }

    public static EquipamentoDetalheDto ParaDetalheDto(Equipamento e)
    {
        object? caracObj = null;
        if (!string.IsNullOrWhiteSpace(e.CaracteristicasJson))
        {
            try
            {
                caracObj = JsonSerializer.Deserialize<object>(e.CaracteristicasJson);
            }
            catch
            {
                caracObj = null;
            }
        }

        return new EquipamentoDetalheDto
        {
            Id = e.Id,
            TipoCodigo = e.TipoEquipamento?.Codigo ?? string.Empty,
            TipoNome = e.TipoEquipamento?.Nome ?? string.Empty,
            NumeroSerie = e.NumeroSerie,
            Marca = e.Marca,
            Modelo = e.Modelo,
            Latitude = e.Latitude,
            Longitude = e.Longitude,
            Situacao = e.Situacao,
            NecessidadeManutencao = e.NecessidadeManutencao,
            ProximaManutencao = e.ProximaManutencao,
            RegiaoId = e.RegiaoId,
            Bairro = e.Bairro,
            Orgao = e.Orgao,
            UltimoHeartbeat = e.UltimoHeartbeat,
            Cep = e.Cep,
            Rua = e.Rua,
            Referencia = e.Referencia,
            Cidade = e.Cidade,
            Uf = e.Uf,
            RegiaoNome = e.Regiao?.Nome ?? string.Empty,
            Caracteristicas = caracObj,
            Manutencoes = e.Manutencoes?.Select(m => new ManutencaoItemDto
            {
                Id = m.Id,
                Tipo = m.Tipo,
                DataPrevista = m.DataPrevista,
                DataRealizada = m.DataRealizada,
                Observacao = m.Observacao
            }).ToList() ?? new List<ManutencaoItemDto>(),
            AlertasAtivos = e.Alertas?.Where(a => a.Status != StatusAlerta.Resolvido).Select(a => new AlertaDto
            {
                Id = a.Id,
                Tipo = a.Tipo,
                Criticidade = a.Criticidade,
                Titulo = a.Titulo,
                Descricao = a.Descricao,
                Status = a.Status,
                EquipamentoId = a.EquipamentoId,
                EquipamentoSerie = e.NumeroSerie,
                AgenteId = a.AgenteId,
                RegiaoId = a.RegiaoId,
                RegiaoNome = e.Regiao?.Nome,
                Latitude = a.Latitude,
                Longitude = a.Longitude,
                CriadoEm = a.CriadoEm,
                ReconhecidoEm = a.ReconhecidoEm,
                ResolvidoEm = a.ResolvidoEm
            }).ToList() ?? new List<AlertaDto>(),
            CriadoEm = e.CriadoEm,
            AtualizadoEm = e.AtualizadoEm
        };
    }
}