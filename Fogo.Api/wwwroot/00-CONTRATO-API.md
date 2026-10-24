# F.O.G.O. – Contrato da API (fonte única da verdade)

> Este arquivo é lido **tanto pela IA que gera o back-end quanto pela que gera o front-end**.
> Nenhum nome de campo, rota, enum ou evento pode ser alterado sem atualizar este arquivo.
> Back-end: ASP.NET Core Web API + SQL Server + SignalR. Front-end: HTML/CSS/JS servido pela própria API (`wwwroot`).

---

## 1. Convenções gerais

| Item | Regra |
|---|---|
| Origem | Front e API na **mesma origem**. O front usa URLs relativas (`/api/...`, `/hubs/operacoes`). Sem CORS em produção. |
| JSON | `camelCase`. Enums trafegam como **string** com os valores exatos da seção 2. |
| Datas | ISO-8601 UTC (`2026-10-24T15:30:00Z`). Campos só de data: `yyyy-MM-dd`. |
| Autenticação | Header `Authorization: Bearer <jwt>`. Todas as rotas exigem token, **exceto** `POST /api/auth/login`, `POST /api/auth/registrar` e `GET /api/health`. |
| Armazenamento no front | `localStorage["fogo.token"]` (string JWT) e `localStorage["fogo.usuario"]` (JSON do usuário). |
| Erros | `ProblemDetails`: `{ "title": "...", "status": 400, "detail": "...", "errors": { "campo": ["mensagem"] } }`. `401` → front limpa a sessão e vai para `/login.html`. `409` = conflito (serial/e-mail duplicado). |
| Paginação | Envelope `{ "itens": [], "total": 0, "pagina": 1, "tamanho": 20 }`. `tamanho` padrão 20, máximo 200. |
| Idioma | Nomes de rotas, campos e enums em português, sem acento. |

---

## 2. Enums (valores exatos)

| Enum | Valores | Observações |
|---|---|---|
| `Situacao` | `NaoInstalado`, `Operacional`, `MauFuncionamento`, `EmManutencao`, `Desativado`, `Furtado` | Rótulos: Não instalado, Operacional, Mau funcionamento, Em manutenção, Desativado, Furtado |
| `NecessidadeManutencao` | `Nenhuma`, `Agendada`, `Imediata` | |
| `Orgao` | `Emdurb`, `GuardaMunicipal`, `PoliciaMilitar`, `Prefeitura`, `Terceirizado` | |
| `CargoAgente` | `AgenteTransito`, `GuardaMunicipal`, `Policial` | |
| `StatusAgente` | `EmAtividade`, `Disponivel`, `Offline` | "Em campo" = `EmAtividade` + `Disponivel` |
| `Criticidade` | `Critico`, `Atencao`, `Info` | |
| `StatusAlerta` | `Ativo`, `Reconhecido`, `Resolvido` | |
| `TipoAlerta` | `Furtado`, `MauFuncionamento`, `Offline`, `ManutencaoVencida`, `ManutencaoProxima`, `Anomalia` | `Anomalia` é reservado para a Parte 3 |
| `NivelRegiao` | `Normal`, `Atencao`, `Critico` | |
| `Perfil` | `Admin`, `Gestor` | Informativo. Todos os usuários autenticados podem tudo. |
| `TipoOcorrencia` | `Acidente`, `Congestionamento`, `InfracaoVelocidade`, `VeiculoRoubado`, `Pane`, `Outro` | |
| `NivelRisco` | `Baixo`, `Medio`, `Alto` | Reservado para a Parte 3 |

**Cálculos oficiais**
- `indisponiveis` = equipamentos em `MauFuncionamento`, `EmManutencao`, `Desativado` ou `Furtado`.
- `percentualDisponibilidade` = `operacionais / (total − naoInstalados) × 100`, 1 casa decimal.
- `manutencaoImediata` = `necessidadeManutencao == Imediata`.
- `manutencaoProxima` = `proximaManutencao` entre hoje e hoje + 7 dias.
- `NivelRegiao`: `Critico` se disponibilidade < 80 % **ou** ≥ 3 alertas críticos ativos; `Atencao` se disponibilidade < 92 % **ou** ≥ 1 alerta crítico ativo; senão `Normal`.

---

## 3. Tipos de equipamento (códigos fixos)

O back devolve esta tabela em `GET /api/tipos`. **O front não deve fixar ícones nem cores**: usa o que a API devolve.

| `codigo` | `nome` | `prefixoSerie` | `icone` | `cor` | `movel` |
|---|---|---|---|---|---|
| `radar` | Radar de trânsito | RAD | 📡 | `#38BDF8` | não |
| `camera` | Câmera de videomonitoramento | CAM | 📹 | `#22D3EE` | não |
| `balanca` | Balança de caminhão | BAL | ⚖️ | `#A78BFA` | não |
| `veiculo_fiscalizacao` | Veículo autônomo de fiscalização | FIS | 🚙 | `#60A5FA` | sim |
| `cancela` | Cancela / portão automatizado | CAN | 🚧 | `#FBBF24` | não |
| `taxi` | Táxi | TAX | 🚕 | `#FACC15` | sim |
| `mototaxi` | Mototáxi | MOT | 🛵 | `#FB923C` | sim |
| `escolar` | Transporte escolar | ESC | 🚌 | `#F59E0B` | sim |
| `totem` | Totem de estacionamento rotativo | TOT | 🅿️ | `#2DD4BF` | não |
| `patinete` | Patinete elétrico compartilhado | PAT | 🛴 | `#4ADE80` | sim |
| `moto_agente` | Moto de agente de trânsito | MAG | 🏍️ | `#818CF8` | sim |
| `viatura_gm` | Viatura da Guarda Municipal | GCM | 🚔 | `#3B82F6` | sim |
| `viatura_pm` | Viatura da Polícia Militar | VPM | 🚓 | `#6366F1` | sim |

Agentes usam o ícone 👮 e a cor `#E2E8F0`.

### 3.1 `camposSchema` (características específicas por tipo)

Cada tipo traz uma lista de campos: `{ "chave", "rotulo", "tipo", "opcoes"?, "unidade"?, "obrigatorio"? }`.
`tipo` pode ser `texto`, `numero`, `booleano`, `selecao` ou `data`. O front **monta o formulário dinamicamente** a partir dessa lista e envia os valores em `caracteristicas` (objeto chave → valor).

| Tipo | Campos (`chave`: tipo, opções) |
|---|---|
| `radar` | `tipoFiscalizacao`: selecao (`Velocidade`, `Semaforo`, `ConversaoProibida`, `RetornoProibido`, `FaixaExclusiva`); `velocidadeMaximaKmh`: numero (km/h); `faixasMonitoradas`: numero; `aferidoAte`: data |
| `camera` | `visaoNoturna`: booleano; `resolucao`: selecao (`HD`, `FullHD`, `2K`, `4K`); `colorida`: booleano; `conectividade`: selecao (`Fibra`, `4G`, `5G`, `Radio`); `ptz`: booleano |
| `balanca` | `capacidadeToneladas`: numero; `tipoBalanca`: selecao (`Estatica`, `Dinamica`) |
| `veiculo_fiscalizacao` | `placa`: texto; `autonomo`: booleano; `autonomiaKm`: numero |
| `cancela` | `tipoAcesso`: selecao (`Veicular`, `Pedestre`); `leituraPlaca`: booleano |
| `taxi` | `placa`: texto; `alvara`: texto; `acessivel`: booleano |
| `mototaxi` | `placa`: texto; `alvara`: texto |
| `escolar` | `placa`: texto; `capacidadePassageiros`: numero; `escolaRota`: texto |
| `totem` | `vagasAtendidas`: numero; `pagamento`: selecao (`Cartao`, `Pix`, `Ambos`); `tarifaHora`: numero (R$) |
| `patinete` | `bateriaPercentual`: numero (%); `operadora`: texto |
| `moto_agente` | `placa`: texto; `cilindradas`: numero |
| `viatura_gm` | `placa`: texto; `prefixoViatura`: texto |
| `viatura_pm` | `placa`: texto; `prefixoViatura`: texto |

---

## 4. Modelos (DTOs)

### 4.1 `EquipamentoMapa` (leve, usado no mapa e nos eventos em tempo real)
```json
{
  "id": 17,
  "tipoCodigo": "camera",
  "tipoNome": "Câmera de videomonitoramento",
  "numeroSerie": "CAM-1093",
  "marca": "Hikvision",
  "modelo": "DS-2CD2746G2",
  "latitude": -22.2139,
  "longitude": -49.9458,
  "situacao": "Operacional",
  "necessidadeManutencao": "Nenhuma",
  "proximaManutencao": "2026-12-01",
  "regiaoId": 1,
  "bairro": "Centro",
  "orgao": "Emdurb",
  "ultimoHeartbeat": "2026-10-24T15:30:00Z"
}
```

### 4.2 `EquipamentoDetalhe` (resposta de `GET /{id}`, `POST`, `PUT`)
Todos os campos de `EquipamentoMapa` mais:
```json
{
  "cep": "17500-000",
  "rua": "Av. Sampaio Vidal",
  "referencia": "oposto ao número 181",
  "cidade": "Marília",
  "uf": "SP",
  "regiaoNome": "Centro",
  "caracteristicas": { "visaoNoturna": true, "resolucao": "4K", "colorida": true, "conectividade": "Fibra", "ptz": false },
  "manutencoes": [ { "id": 1, "tipo": "Periodica", "dataPrevista": "2026-12-01", "dataRealizada": null, "observacao": "" } ],
  "alertasAtivos": [ /* lista de Alerta */ ],
  "criadoEm": "2026-10-01T10:00:00Z",
  "atualizadoEm": "2026-10-24T15:30:00Z"
}
```

### 4.3 Corpo de `POST /api/equipamentos` e `PUT /api/equipamentos/{id}`
```json
{
  "tipoCodigo": "camera",
  "numeroSerie": "CAM-1093",
  "marca": "Hikvision",
  "modelo": "DS-2CD2746G2",
  "cep": "17500-000",
  "rua": "Av. Sampaio Vidal",
  "bairro": "Centro",
  "cidade": "Marília",
  "uf": "SP",
  "referencia": "oposto ao número 181",
  "latitude": -22.2139,
  "longitude": -49.9458,
  "orgao": "Emdurb",
  "situacao": "Operacional",
  "necessidadeManutencao": "Nenhuma",
  "proximaManutencao": "2026-12-01",
  "caracteristicas": { "visaoNoturna": true, "resolucao": "4K" }
}
```
Regras: `numeroSerie` único (409 se repetido); `latitude` e `longitude` obrigatórias e válidas; `regiaoId` **não** é enviado, o back calcula pela posição.

### 4.4 `Agente`
```json
{
  "id": 5,
  "nome": "Carlos Souza",
  "matricula": "AGT-0156",
  "cargo": "AgenteTransito",
  "orgao": "Emdurb",
  "telefone": "(14) 99999-0000",
  "status": "EmAtividade",
  "latitude": -22.2171,
  "longitude": -49.9501,
  "ultimaPosicaoEm": "2026-10-24T15:30:00Z",
  "regiaoId": 1,
  "regiaoNome": "Centro",
  "equipamentoVinculadoId": 42
}
```
Corpo de `POST`/`PUT` de agente: os mesmos campos, **sem** `id`, `ultimaPosicaoEm`, `regiaoId`, `regiaoNome`.

### 4.5 `Alerta`
```json
{
  "id": 9,
  "tipo": "MauFuncionamento",
  "criticidade": "Critico",
  "titulo": "Radar RAD-7842 com mau funcionamento",
  "descricao": "Sem leituras válidas nos últimos 10 minutos.",
  "status": "Ativo",
  "equipamentoId": 3,
  "equipamentoSerie": "RAD-7842",
  "agenteId": null,
  "regiaoId": 2,
  "regiaoNome": "Norte",
  "latitude": -22.19,
  "longitude": -49.95,
  "criadoEm": "2026-10-24T15:30:00Z",
  "reconhecidoEm": null,
  "resolvidoEm": null
}
```

### 4.6 `Resumo` (dashboard, sempre global, sem filtros)
```json
{
  "geradoEm": "2026-10-24T15:30:00Z",
  "totalEquipamentos": 245,
  "naoInstalados": 9,
  "operacionais": 196,
  "indisponiveis": 40,
  "percentualDisponibilidade": 83.1,
  "manutencaoImediata": 7,
  "manutencaoProxima": 12,
  "totalAgentes": 45,
  "agentesEmCampo": 31,
  "alertasAtivos": 27,
  "alertasCriticos": 5,
  "ocorrenciasHoje": 34,
  "porTipo": [ { "tipoCodigo": "camera", "tipoNome": "Câmera de videomonitoramento", "icone": "📹", "cor": "#22D3EE", "total": 60, "operacionais": 55, "indisponiveis": 5 } ],
  "porSituacao": [ { "situacao": "Operacional", "total": 196 } ],
  "porRegiao": [
    { "regiaoId": 1, "nome": "Centro", "latitude": -22.2171, "longitude": -49.9501,
      "total": 70, "operacionais": 66, "percentualDisponibilidade": 94.3,
      "alertasAtivos": 4, "alertasCriticos": 1, "nivel": "Atencao" }
  ]
}
```

### 4.7 `Manutencao` (lista do painel de manutenção)
```json
{ "equipamentoId": 3, "numeroSerie": "RAD-7842", "tipoCodigo": "radar", "tipoNome": "Radar de trânsito",
  "situacao": "MauFuncionamento", "necessidadeManutencao": "Imediata", "proximaManutencao": "2026-10-26",
  "diasRestantes": 2, "latitude": -22.19, "longitude": -49.95, "bairro": "Centro" }
```

---

## 5. Endpoints

| Controller | Método e rota | Descrição | Função em `api.js` |
|---|---|---|---|
| `HealthController` | `GET /api/health` | Público. Retorna `{ "status": "ok", "versao": "1.0.0", "horaServidor": "..." }` | `getHealth()` |
| `AuthController` | `POST /api/auth/registrar` | Corpo `{ nome, email, senha }`. Cria usuário com perfil `Gestor`. Retorna **201** com `LoginResposta` (já logado). | `registrar(dados)` |
| | `POST /api/auth/login` | Corpo `{ email, senha }`. Retorna `LoginResposta`. 401 se inválido. | `login(email, senha)` |
| | `GET /api/auth/me` | Retorna o usuário do token. | `getMe()` |
| `TiposController` | `GET /api/tipos` | Lista de tipos com `camposSchema` (seção 3) | `getTipos()` |
| `RegioesController` | `GET /api/regioes` | `[{ id, codigo, nome, latitude, longitude }]` | `getRegioes()` |
| `DominiosController` | `GET /api/dominios` | Listas para selects (seção 5.2) | `getDominios()` |
| `EquipamentosController` | `GET /api/equipamentos` | Paginado. Filtros na seção 5.1. Retorna `EquipamentoDetalhe` resumido (sem `manutencoes` e `alertasAtivos`). | `getEquipamentos(filtros)` |
| | `GET /api/equipamentos/mapa` | Sem paginação. Mesmos filtros. Retorna `EquipamentoMapa[]`. | `getEquipamentosMapa(filtros)` |
| | `GET /api/equipamentos/{id}` | `EquipamentoDetalhe` | `getEquipamento(id)` |
| | `POST /api/equipamentos` | Cria. 201 + `EquipamentoDetalhe`. | `criarEquipamento(dados)` |
| | `PUT /api/equipamentos/{id}` | Atualiza. 200 + `EquipamentoDetalhe`. | `atualizarEquipamento(id, dados)` |
| | `DELETE /api/equipamentos/{id}` | 204 | `excluirEquipamento(id)` |
| | `PATCH /api/equipamentos/{id}/situacao` | Corpo `{ situacao, observacao? }` | `alterarSituacaoEquipamento(id, situacao, observacao)` |
| `AgentesController` | `GET /api/agentes` | Lista sem paginação. Filtros: `cargo`, `status`, `regiaoId`, `busca`. Retorna `Agente[]`. | `getAgentes(filtros)` |
| | `GET /api/agentes/{id}` | `Agente` | `getAgente(id)` |
| | `POST /api/agentes` | 201 + `Agente` | `criarAgente(dados)` |
| | `PUT /api/agentes/{id}` | 200 + `Agente` | `atualizarAgente(id, dados)` |
| | `DELETE /api/agentes/{id}` | 204 | `excluirAgente(id)` |
| | `PATCH /api/agentes/{id}/status` | Corpo `{ status }` | `alterarStatusAgente(id, status)` |
| `DashboardController` | `GET /api/dashboard/resumo` | `Resumo` | `getResumo()` |
| | `GET /api/dashboard/manutencoes?dias=7` | `Manutencao[]`: imediatas + vencidas + próximas, ordenadas por urgência | `getManutencoes(dias)` |
| `AlertasController` | `GET /api/alertas` | Filtros: `status` (padrão `Ativo`), `criticidade`, `regiaoId`, `limite` (padrão 50). Ordem: criticidade, depois mais recente. | `getAlertas(filtros)` |
| | `PATCH /api/alertas/{id}/reconhecer` | Retorna `Alerta` | `reconhecerAlerta(id)` |
| | `PATCH /api/alertas/{id}/resolver` | Retorna `Alerta` | `resolverAlerta(id)` |
| `SimulacaoController` | `POST /api/simulacao/falha` | Corpo `{ equipamentoId?: number, tipo: "MauFuncionamento" \| "Furtado" \| "Offline" }`. Sem `equipamentoId`, sorteia um equipamento `Operacional`. Retorna `EquipamentoDetalhe`. Cria o alerta **na hora**. | `simularFalha(tipo, equipamentoId)` |
| | `POST /api/simulacao/restaurar` | Corpo `{ equipamentoId }`. Volta ao estado anterior à simulação. | `restaurarEquipamento(equipamentoId)` |
| | `POST /api/simulacao/resetar` | Restaura todos os equipamentos alterados por simulação. Retorna `{ restaurados: n }`. | `resetarSimulacao()` |
| `HistoricoController` | `GET /api/historico/telemetria` | **Parte 3.** Filtros: `equipamentoId`, `regiaoId`, `de`, `ate`. Máx. 5000 linhas. | `getHistoricoTelemetria(filtros)` |
| | `GET /api/historico/ocorrencias` | **Parte 3.** Filtros: `regiaoId`, `tipo`, `de`, `ate`. Máx. 5000 linhas. | `getHistoricoOcorrencias(filtros)` |
| | `GET /api/historico/serie` | **Parte 3.** `metrica=ocorrencias\|falhas`, `agrupar=hora\|dia`, `regiaoId?`, `de`, `ate`. Retorna `[{ periodo, regiaoId, valor }]`. | `getHistoricoSerie(filtros)` |

`LoginResposta`:
```json
{ "token": "eyJ...", "expiraEm": "2026-10-24T23:30:00Z",
  "usuario": { "id": 1, "nome": "Administrador", "email": "admin@fogo.local", "perfil": "Admin" } }
```

### 5.1 Filtros de `/api/equipamentos` e `/api/equipamentos/mapa`
`tipo` (código), `situacao`, `regiaoId`, `bairro`, `orgao`, `busca` (serial, marca, modelo ou rua), `manutencao` (`imediata` \| `proxima`), `pagina`, `tamanho`.
Filtros vazios são ignorados. Filtros combinam com **E**.

### 5.2 Resposta de `GET /api/dominios`
```json
{
  "situacoes": [ { "valor": "Operacional", "rotulo": "Operacional", "cor": "#22C55E" } ],
  "orgaos": [ { "valor": "GuardaMunicipal", "rotulo": "Guarda Municipal" } ],
  "cargos": [ { "valor": "AgenteTransito", "rotulo": "Agente de trânsito" } ],
  "statusAgente": [ { "valor": "EmAtividade", "rotulo": "Em atividade" } ],
  "criticidades": [ { "valor": "Critico", "rotulo": "Crítico", "cor": "#EF4444" } ],
  "necessidadesManutencao": [ { "valor": "Imediata", "rotulo": "Imediata" } ],
  "bairros": [ "Centro", "Fragata" ]
}
```
Cores das situações: Operacional `#22C55E`, MauFuncionamento `#F59E0B`, EmManutencao `#3B82F6`, Desativado `#6B7280`, Furtado `#EF4444`, NaoInstalado `#94A3B8`.
Cores das criticidades: Critico `#EF4444`, Atencao `#F59E0B`, Info `#38BDF8`.

---

## 6. Tempo real (SignalR)

- Hub: **`/hubs/operacoes`**. O token JWT vai em `?access_token=` (o cliente usa `accessTokenFactory`).
- Eventos **servidor → cliente** (nomes exatos):

| Evento | Payload | Quando |
|---|---|---|
| `EquipamentoAtualizado` | `EquipamentoMapa` | Mudança de situação, posição (veículos) ou heartbeat relevante |
| `AgenteAtualizado` | `Agente` | Mudança de posição ou status |
| `AlertaCriado` | `Alerta` | Novo alerta |
| `AlertaAtualizado` | `Alerta` | Reconhecido ou resolvido |
| `ResumoAtualizado` | `Resumo` | No máximo 1 vez a cada 2 s, após qualquer mudança |
| `EventoOperacional` | `{ "id": "guid", "timestamp": "...", "mensagem": "Radar RAD-7842 entrou em mau funcionamento", "criticidade": "Atencao" }` | Alimenta o feed "ao vivo" |

Não há métodos cliente → servidor. Toda ação passa pela API REST.

---

## 7. Credenciais de demonstração

| Campo | Valor |
|---|---|
| E-mail | `admin@fogo.local` |
| Senha | `Fogo@2026` |
| Perfil | `Admin` |

Regras de senha no cadastro: mínimo 8 caracteres, com pelo menos uma letra e um número.

---

## 8. Parte 3 (reservado)

Prefixo `/api/previsao/*` e DTOs com `explicacao`. Veja o guia em `03-RESUMO-EQUIPE-E-GUIA-PARTE-3.md`.
