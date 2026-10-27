# PROMETHEUS F.O.G.O. – Front-end

> **Ferramenta Onisciente de Gestão e Operações** – Cidade de Marília / SP
> Versão front-end estática (HTML + CSS + JS puros, ES Modules).

---

## Estrutura de pastas

```
fogo-front/                       ← raiz → copiar para wwwroot/
├── login.html                    Tela de acesso (login + criar conta)
├── index.html                    2. Centro de Operações (dashboard principal)
├── equipamentos.html             1. Inventário Inteligente
├── agentes.html                  Gestão de agentes
├── previsao.html                 3. Inteligência Preditiva (placeholder)
├── 00-CONTRATO-API.md            Contrato da API (fonte única da verdade)
├── css/
│   ├── tokens.css                Variáveis de design (cores, espaçamentos)
│   ├── base.css                  Reset, tipografia, layout, header
│   ├── components.css            Painéis, botões, inputs, tabelas, modais, badges, drawer
│   └── pages.css                 Estilos específicos por página
└── js/
    ├── config.js                 Constantes globais (USE_MOCK, intervalos, chaves)
    ├── mock-data.js              Dados fictícios para USE_MOCK = true
    ├── api.js                    Cliente HTTP + todas as funções do contrato
    ├── auth.js                   Sessão: token JWT, login, logout, guard
    ├── ui.js                     Toast, modais, formatadores, debounce, badges, escape
    ├── layout.js                 Header/nav compartilhado + indicador de tempo real
    ├── realtime.js               Conexão SignalR + registro de handlers
    ├── map.js                    Fábrica do mapa Leaflet: marcadores, cluster, heatmap
    ├── login.js                  Lógica de login.html
    ├── dashboard.js              Lógica de index.html (dashboard + mapa)
    ├── equipamentos.js           Lógica de equipamentos.html
    ├── agentes.js                Lógica de agentes.html
    └── previsao.js               Esqueleto de previsao.html (só exige login)
```

---

## Como rodar

### Com o back-end ASP.NET Core (modo normal)

1. Copie **todo o conteúdo** desta pasta para `<projeto-api>/wwwroot/`.
2. Inicie o back-end (`dotnet run` ou F5 no Visual Studio).
3. Acesse `https://localhost:<porta>/login.html`.

O front-end usa URLs **relativas** (`/api/...`, `/hubs/operacoes`) — mesmo domínio, sem CORS.

### Credenciais de demonstração

| Campo  | Valor               |
|--------|---------------------|
| E-mail | `admin@fogo.local`  |
| Senha  | `Fogo@2026`         |

---

## Como ligar o modo mock (sem back-end)

Edite `js/config.js` e mude:

```js
// Antes:
export const USE_MOCK = false;

// Depois:
export const USE_MOCK = true;
```

Com `USE_MOCK = true`:
- Todos os dados vêm de `js/mock-data.js` (10 equipamentos, 5 agentes, 3 alertas, 1 resumo, 13 tipos, 5 regiões).
- O SignalR é desligado automaticamente.
- A autenticação aceita apenas `admin@fogo.local / Fogo@2026`.
- **Não** copie para produção com `USE_MOCK = true`.

---

## Principais IDs por página

### login.html

| ID                     | Descrição                              |
|------------------------|----------------------------------------|
| `#login-card`          | Cartão central                         |
| `#login-status-api`    | Indicador de saúde do servidor         |
| `#bloco-instrucoes`    | Bloco de instruções de acesso          |
| `#tab-entrar`          | Aba "Entrar"                           |
| `#tab-criar-conta`     | Aba "Criar conta"                      |
| `#btn-preencher-demo`  | Preenche credenciais de demo           |
| `#form-login`          | Formulário de login                    |
| `#login-email`         | Campo de e-mail                        |
| `#login-senha`         | Campo de senha                         |
| `#login-toggle-senha`  | Botão mostrar/ocultar senha            |
| `#login-submit`        | Botão de login                         |
| `#login-erro`          | Mensagem de erro de login              |
| `#form-registro`       | Formulário de registro                 |
| `#registro-nome`       | Campo nome                             |
| `#registro-email`      | Campo e-mail                           |
| `#registro-senha`      | Campo senha                            |
| `#registro-senha2`     | Campo confirmação de senha             |
| `#registro-forca`      | Indicador de força da senha            |
| `#registro-submit`     | Botão criar conta                      |
| `#registro-erro`       | Mensagem de erro de registro           |

### index.html (dashboard)

| ID                         | Descrição                              |
|----------------------------|----------------------------------------|
| `#app-header`              | Header compartilhado (montado por JS)  |
| `#nav-centro`              | Link nav – Centro de Operações         |
| `#painel-kpis`             | Faixa de KPIs                          |
| `#kpi-disponibilidade`     | KPI: % disponibilidade (anel SVG)      |
| `#kpi-agentes-campo`       | KPI: Agentes em campo                  |
| `#kpi-alertas-ativos`      | KPI: Alertas ativos                    |
| `#kpi-ocorrencias-hoje`    | KPI: Ocorrências hoje                  |
| `#kpi-total-equipamentos`  | KPI: Total equipamentos                |
| `#kpi-operacionais`        | KPI: Operacionais                      |
| `#kpi-indisponiveis`       | KPI: Indisponíveis                     |
| `#kpi-manutencao-imediata` | KPI: Manutenção imediata               |
| `#painel-tipos`            | Coluna esquerda com filtro por tipo    |
| `#lista-tipos`             | Lista de tipos clicáveis               |
| `#barra-filtros`           | Barra de filtros do mapa               |
| `#filtro-tipo`             | Select filtro tipo                     |
| `#filtro-situacao`         | Select filtro situação                 |
| `#filtro-regiao`           | Select filtro região                   |
| `#filtro-bairro`           | Select filtro bairro                   |
| `#filtro-orgao`            | Select filtro órgão                    |
| `#filtro-busca`            | Input de busca                         |
| `#filtro-manutencao`       | Select filtro manutenção               |
| `#btn-limpar-filtros`      | Limpar filtros                         |
| `#contador-mapa`           | Contador "N equipamentos no mapa"      |
| `#toggle-equipamentos`     | Camada equipamentos                    |
| `#toggle-agentes`          | Camada agentes                         |
| `#toggle-cluster`          | Camada cluster                         |
| `#toggle-heatmap`          | Camada heatmap                         |
| `#toggle-regioes`          | Camada regiões                         |
| `#mapa`                    | Container do mapa Leaflet              |
| `#drawer-detalhe`          | Drawer lateral de detalhes             |
| `#btn-fechar-detalhe`      | Fechar drawer                          |
| `#detalhe-conteudo`        | Conteúdo do drawer                     |
| `#btn-ver-inventario`      | Link para inventário no drawer         |
| `#btn-centralizar`         | Centralizar no mapa (drawer)           |
| `#painel-alertas`          | Painel de alertas                      |
| `#aba-alertas-todos`       | Aba todos os alertas                   |
| `#aba-alertas-critico`     | Aba alertas críticos                   |
| `#aba-alertas-atencao`     | Aba alertas de atenção                 |
| `#lista-alertas`           | Lista de alertas                       |
| `#painel-manutencao`       | Painel de manutenção urgente           |
| `#lista-manutencao`        | Lista de manutenções                   |
| `#painel-regioes`          | Painel de regiões                      |
| `#grid-regioes`            | Grade de cards de regiões              |
| `#grafico-situacao`        | Canvas: rosca por situação             |
| `#grafico-tipos`           | Canvas: barras por tipo                |
| `#feed-eventos`            | Feed de eventos ao vivo                |
| `#btn-modo-demo`           | Botão flutuante modo demo              |
| `#painel-demo`             | Painel do modo demo                    |
| `#btn-simular-furto`       | Simular furto                          |
| `#btn-simular-falha`       | Simular mau funcionamento              |
| `#btn-simular-offline`     | Simular offline                        |
| `#btn-restaurar-todos`     | Restaurar todos os simulados           |
| `#realtime-indicator`      | Indicador de conexão (Ao vivo/Reconectando/Offline) |
| `#relogio`                 | Relógio em tempo real                  |
| `#user-nome`               | Nome e perfil do usuário               |
| `#btn-logout`              | Sair do sistema                        |
| `#toast-container`         | Container de notificações              |

### equipamentos.html

| ID                         | Descrição                              |
|----------------------------|----------------------------------------|
| `#nav-equipamentos`        | Link nav ativo                         |
| `#btn-novo-equipamento`    | Abrir modal de cadastro                |
| `#grid-tipos-resumo`       | Cards de total por tipo                |
| `#eq-filtro-tipo`          | Filtro tipo                            |
| `#eq-filtro-situacao`      | Filtro situação                        |
| `#eq-filtro-regiao`        | Filtro região                          |
| `#eq-filtro-orgao`         | Filtro órgão                           |
| `#eq-filtro-manutencao`    | Filtro manutenção                      |
| `#eq-busca`                | Busca livre                            |
| `#eq-btn-limpar`           | Limpar filtros                         |
| `#tabela-equipamentos`     | Tabela                                 |
| `#tbody-equipamentos`      | Corpo da tabela                        |
| `#eq-paginacao`            | Container de paginação                 |
| `#eq-pagina-anterior`      | Btn página anterior                    |
| `#eq-pagina-proxima`       | Btn próxima página                     |
| `#eq-info-pagina`          | Texto "Página X de Y · N equipamentos" |
| `#eq-tamanho`              | Select tamanho da página               |
| `#modal-equipamento`       | Overlay do modal de cadastro/edição    |
| `#form-equipamento`        | Formulário                             |
| `#eq-tipo`                 | Select tipoCodigo                      |
| `#eq-numero-serie`         | Input numeroSerie                      |
| `#eq-marca`                | Input marca                            |
| `#eq-modelo`               | Input modelo                           |
| `#eq-cep`                  | Input CEP (consulta ViaCEP ao blur)    |
| `#eq-rua`                  | Input rua                              |
| `#eq-bairro`               | Input bairro                           |
| `#eq-cidade`               | Input cidade                           |
| `#eq-uf`                   | Input UF                               |
| `#eq-referencia`           | Input referência                       |
| `#eq-latitude`             | Input latitude                         |
| `#eq-longitude`            | Input longitude                        |
| `#eq-mapa-picker`          | Mini mapa picker                       |
| `#btn-geocodificar`        | Buscar coordenadas (Nominatim)         |
| `#eq-orgao`                | Select orgao                           |
| `#eq-situacao`             | Select situacao                        |
| `#eq-necessidade-manutencao` | Select necessidadeManutencao         |
| `#eq-proxima-manutencao`   | Input proximaManutencao (date)         |
| `#eq-campos-dinamicos`     | Container de campos gerados por tipo   |
| `#eq-form-erro`            | Erro geral do form                     |
| `#btn-salvar-equipamento`  | Salvar                                 |
| `#btn-cancelar-equipamento`| Cancelar / fechar                      |
| `#modal-confirmar`         | Modal de confirmação de exclusão       |
| `#btn-confirmar-sim`       | Confirmar exclusão                     |
| `#btn-confirmar-nao`       | Cancelar exclusão                      |

### agentes.html

| ID                      | Descrição                              |
|-------------------------|----------------------------------------|
| `#nav-agentes`          | Link nav ativo                         |
| `#btn-novo-agente`      | Abrir modal de cadastro                |
| `#agentes-resumo`       | Cards de resumo rápido                 |
| `#ag-filtro-cargo`      | Filtro cargo                           |
| `#ag-filtro-status`     | Filtro status                          |
| `#ag-filtro-regiao`     | Filtro região                          |
| `#ag-busca`             | Busca por nome / matrícula             |
| `#ag-btn-limpar`        | Limpar filtros                         |
| `#tabela-agentes`       | Tabela de agentes                      |
| `#tbody-agentes`        | Corpo da tabela                        |
| `#modal-agente`         | Overlay do modal                       |
| `#form-agente`          | Formulário                             |
| `#ag-nome`              | Input nome                             |
| `#ag-matricula`         | Input matrícula                        |
| `#ag-cargo`             | Select cargo                           |
| `#ag-orgao`             | Select orgao                           |
| `#ag-telefone`          | Input telefone (com máscara)           |
| `#ag-status`            | Select status                          |
| `#ag-latitude`          | Input latitude                         |
| `#ag-longitude`         | Input longitude                        |
| `#ag-mapa-picker`       | Mini mapa picker                       |
| `#ag-form-erro`         | Erro geral do form                     |
| `#btn-salvar-agente`    | Salvar                                 |
| `#btn-cancelar-agente`  | Cancelar                               |

### previsao.html (IDs reservados para Parte 3)

| ID                      | Descrição                              |
|-------------------------|----------------------------------------|
| `#nav-previsao`         | Link nav ativo                         |
| `#prev-risco-mapa`      | Container: mapa de risco (IA)          |
| `#prev-grafico-fluxo`   | Container: gráfico de fluxo previsto   |
| `#prev-manutencao`      | Container: manutenção preditiva        |
| `#prev-anomalias`       | Container: detecção de anomalias       |
| `#prev-recomendacoes`   | Container: recomendações da IA         |

---

## TODOs pendentes

| Arquivo        | Comentário                                         |
|----------------|----------------------------------------------------|
| `api.js`       | `// TODO(contrato): Parte 3 – getHistoricoTelemetria` |
| `api.js`       | `// TODO(contrato): Parte 3 – getHistoricoOcorrencias` |
| `api.js`       | `// TODO(contrato): Parte 3 – getHistoricoSerie`   |
| `previsao.js`  | `// TODO(contrato): Parte 3 – implementar chamadas a /api/previsao/*` |

---

## Declaração de uso de IA

Este front-end foi gerado com auxílio de **Claude Sonnet (Anthropic)** via IDE Antigravity,
seguindo rigorosamente o `00-CONTRATO-API.md` como fonte única da verdade.
Toda a revisão, integração e validação final são de responsabilidade da equipe do projeto.

---

*PROMETHEUS F.O.G.O. · Marília / SP · 2026*
