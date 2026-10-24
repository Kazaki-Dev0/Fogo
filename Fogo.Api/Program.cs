using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Fogo.Api.Data;
using Fogo.Api.Data.Seed;
using Fogo.Api.Hubs;
using Fogo.Api.Services;
using Fogo.Api.Workers;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1) Controllers: JSON em camelCase e enums como texto
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// 2) Banco de dados
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// 3) Autenticação JWT (o hub lê o token pela query string ?access_token=)
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(o =>
    {
        o.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
        o.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.HttpContext.Request.Path.StartsWithSegments("/hubs"))
                {
                    ctx.Token = token;
                }
                return Task.CompletedTask;
            }
        };
    });
builder.Services.AddAuthorization();

// 4) SignalR (também em camelCase e enums como texto)
builder.Services.AddSignalR().AddJsonProtocol(o =>
{
    o.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// 5) Nossos serviços
builder.Services.AddMemoryCache();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IRegiaoService, RegiaoService>();
builder.Services.AddScoped<IAlertaService, AlertaService>();
builder.Services.AddScoped<IDashboardService, DashboardService>();
builder.Services.AddSingleton<ResumoNotificador>();
builder.Services.AddScoped<SeedService>();
builder.Services.AddScoped<HistoricoSeeder>();

if (builder.Configuration.GetValue<bool>("Simulacao:Habilitada"))
{
    builder.Services.AddHostedService<SimuladorTelemetriaWorker>();
}

// 6) Swagger (com botão Authorize para o token)
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "F.O.G.O. API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Cole somente o token (sem a palavra Bearer)."
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// 7) Cria/atualiza o banco e popula os dados iniciais (só se estiver vazio)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await scope.ServiceProvider.GetRequiredService<SeedService>().ExecutarAsync();
}

// 8) Pipeline (a ORDEM importa)
app.UseSwagger();
app.UseSwaggerUI();
app.UseDefaultFiles();   // precisa vir ANTES do UseStaticFiles
app.UseStaticFiles();
app.UseAuthentication(); // precisa vir ANTES do UseAuthorization
app.UseAuthorization();
app.MapControllers();
app.MapHub<OperacoesHub>("/hubs/operacoes");

app.Run();