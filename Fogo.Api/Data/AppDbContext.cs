using Fogo.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Fogo.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Usuario> Usuarios { get; set; } = null!;
    public DbSet<TipoEquipamento> TiposEquipamento { get; set; } = null!;
    public DbSet<Regiao> Regioes { get; set; } = null!;
    public DbSet<Equipamento> Equipamentos { get; set; } = null!;
    public DbSet<Manutencao> Manutencoes { get; set; } = null!;
    public DbSet<Agente> Agentes { get; set; } = null!;
    public DbSet<Telemetria> Telemetrias { get; set; } = null!;
    public DbSet<Alerta> Alertas { get; set; } = null!;
    public DbSet<Ocorrencia> Ocorrencias { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. Configurar conversão de todos os Enums para String
        modelBuilder.Entity<Usuario>()
            .Property(u => u.Perfil)
            .HasConversion<string>();

        modelBuilder.Entity<Equipamento>()
            .Property(e => e.Orgao)
            .HasConversion<string>();

        modelBuilder.Entity<Equipamento>()
            .Property(e => e.Situacao)
            .HasConversion<string>();

        modelBuilder.Entity<Equipamento>()
            .Property(e => e.NecessidadeManutencao)
            .HasConversion<string>();

        modelBuilder.Entity<Equipamento>()
            .Property(e => e.SituacaoBase)
            .HasConversion<string>();

        modelBuilder.Entity<Agente>()
            .Property(a => a.Cargo)
            .HasConversion<string>();

        modelBuilder.Entity<Agente>()
            .Property(a => a.Orgao)
            .HasConversion<string>();

        modelBuilder.Entity<Agente>()
            .Property(a => a.Status)
            .HasConversion<string>();

        modelBuilder.Entity<Telemetria>()
            .Property(t => t.SituacaoNoMomento)
            .HasConversion<string>();

        modelBuilder.Entity<Alerta>()
            .Property(a => a.Tipo)
            .HasConversion<string>();

        modelBuilder.Entity<Alerta>()
            .Property(a => a.Criticidade)
            .HasConversion<string>();

        modelBuilder.Entity<Alerta>()
            .Property(a => a.Status)
            .HasConversion<string>();

        modelBuilder.Entity<Ocorrencia>()
            .Property(o => o.Tipo)
            .HasConversion<string>();

        // 2. Precisão decimal(9,6) para campos de Latitude e Longitude
        modelBuilder.Entity<Telemetria>(entity =>
        {
            entity.Property(t => t.Valor).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Regiao>(entity =>
        {
            entity.Property(r => r.Latitude).HasPrecision(9, 6);
            entity.Property(r => r.Longitude).HasPrecision(9, 6);
        });

        modelBuilder.Entity<Equipamento>(entity =>
        {
            entity.Property(e => e.Latitude).HasPrecision(9, 6);
            entity.Property(e => e.Longitude).HasPrecision(9, 6);
        });

        modelBuilder.Entity<Agente>(entity =>
        {
            entity.Property(a => a.Latitude).HasPrecision(9, 6);
            entity.Property(a => a.Longitude).HasPrecision(9, 6);
        });

        modelBuilder.Entity<Alerta>(entity =>
        {
            entity.Property(a => a.Latitude).HasPrecision(9, 6);
            entity.Property(a => a.Longitude).HasPrecision(9, 6);
        });

        modelBuilder.Entity<Ocorrencia>(entity =>
        {
            entity.Property(o => o.Latitude).HasPrecision(9, 6);
            entity.Property(o => o.Longitude).HasPrecision(9, 6);
        });

        // 3. Índices Únicos
        modelBuilder.Entity<Usuario>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<Equipamento>()
            .HasIndex(e => e.NumeroSerie)
            .IsUnique();

        modelBuilder.Entity<Agente>()
            .HasIndex(a => a.Matricula)
            .IsUnique();

        modelBuilder.Entity<TipoEquipamento>()
            .HasIndex(t => t.Codigo)
            .IsUnique();

        // 4. Índices de Desempenho
        modelBuilder.Entity<Equipamento>()
            .HasIndex(e => e.Situacao);

        modelBuilder.Entity<Equipamento>()
            .HasIndex(e => e.TipoEquipamentoId);

        modelBuilder.Entity<Equipamento>()
            .HasIndex(e => e.RegiaoId);

        modelBuilder.Entity<Telemetria>()
            .HasIndex(t => new { t.EquipamentoId, t.Timestamp });

        modelBuilder.Entity<Ocorrencia>()
            .HasIndex(o => new { o.DataHora, o.RegiaoId });

        modelBuilder.Entity<Alerta>()
            .HasIndex(a => new { a.Status, a.Criticidade });

        // 5. Configurar DeleteBehavior.Restrict em todas as relações
        foreach (var foreignKey in modelBuilder.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
        {
            foreignKey.DeleteBehavior = DeleteBehavior.Restrict;
        }
    }
}