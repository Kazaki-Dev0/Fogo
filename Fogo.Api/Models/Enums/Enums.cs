namespace Fogo.Api.Models;

public enum Situacao
{
    NaoInstalado,
    Operacional,
    MauFuncionamento,
    EmManutencao,
    Desativado,
    Furtado
}

public enum NecessidadeManutencao
{
    Nenhuma,
    Agendada,
    Imediata
}

public enum Orgao
{
    Emdurb,
    GuardaMunicipal,
    PoliciaMilitar,
    Prefeitura,
    Terceirizado
}

public enum CargoAgente
{
    AgenteTransito,
    GuardaMunicipal,
    Policial
}

public enum StatusAgente
{
    EmAtividade,
    Disponivel,
    Offline
}

public enum Criticidade
{
    Critico,
    Atencao,
    Info
}

public enum StatusAlerta
{
    Ativo,
    Reconhecido,
    Resolvido
}

public enum TipoAlerta
{
    Furtado,
    MauFuncionamento,
    Offline,
    ManutencaoVencida,
    ManutencaoProxima,
    Anomalia
}

public enum NivelRegiao
{
    Normal,
    Atencao,
    Critico
}

public enum Perfil
{
    Admin,
    Gestor
}

public enum TipoOcorrencia
{
    Acidente,
    Congestionamento,
    InfracaoVelocidade,
    VeiculoRoubado,
    Pane,
    Outro
}

public enum NivelRisco
{
    Baixo,
    Medio,
    Alto
}