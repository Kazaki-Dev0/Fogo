// ============================================================
// PROMETHEUS F.O.G.O. – api.js
// Cliente HTTP + todas as funções do contrato (seção 5)
// ============================================================
import { USE_MOCK } from './config.js';
import { getToken, sair } from './auth.js';
import * as Mock from './mock-data.js';

// ── Cache em memória (por sessão) para dados estáticos ──────
const _cache = new Map();

/** Classe de erro da API */
export class ApiError extends Error {
  constructor({ status, titulo, detalhe, erros }) {
    super(titulo || detalhe || `Erro ${status}`);
    this.status = status;
    this.titulo = titulo;
    this.detalhe = detalhe;
    this.erros = erros || {};
  }
}

// ── Função interna de requisição ────────────────────────────
/**
 * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} metodo
 * @param {string} caminho  ex.: /api/equipamentos
 * @param {{ corpo?: any, query?: object, signal?: AbortSignal }} [opts]
 */
async function request(metodo, caminho, { corpo, query, signal } = {}) {
  if (USE_MOCK) {
    throw new Error('USE_MOCK está ativo, mas request() foi chamado diretamente. Use as funções exportadas.');
  }

  // Monta query string ignorando valores vazios
  let url = caminho;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== null && v !== undefined && v !== '') {
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    if (qs) url += (url.includes('?') ? '&' : '?') + qs;
  }

  const headers = { 'Accept': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(url, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      signal
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError({ status: 0, titulo: 'Não foi possível falar com o servidor.', detalhe: err.message, erros: {} });
  }

  // 401 → limpa sessão e redireciona
  if (res.status === 401) {
    sair();
    throw new ApiError({ status: 401, titulo: 'Sessão expirada.', detalhe: '', erros: {} });
  }

  // 204 No Content
  if (res.status === 204) return null;

  let json;
  try { json = await res.json(); } catch { json = null; }

  if (!res.ok) {
    throw new ApiError({
      status: res.status,
      titulo: json?.title || json?.titulo || `Erro ${res.status}`,
      detalhe: json?.detail || json?.detalhe || '',
      erros: json?.errors || json?.erros || {}
    });
  }

  return json;
}

// ── Helpers de mock ─────────────────────────────────────────
function mockDelay(ms = 180) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Health ──────────────────────────────────────────────────
/** GET /api/health – Público */
export async function getHealth() {
  if (USE_MOCK) {
    await mockDelay(100);
    return { status: 'ok', versao: '1.0.0-mock', horaServidor: new Date().toISOString() };
  }
  return request('GET', '/api/health');
}

// ── Auth ────────────────────────────────────────────────────
/** POST /api/auth/login */
export async function login(email, senha) {
  if (USE_MOCK) {
    await mockDelay(400);
    if (email === 'admin@fogo.local' && senha === 'Fogo@2026') {
      return { token: 'mock-jwt-token', expiraEm: new Date(Date.now() + 8 * 3600000).toISOString(), usuario: { id: 1, nome: 'Administrador', email: 'admin@fogo.local', perfil: 'Admin' } };
    }
    throw new ApiError({ status: 401, titulo: 'E-mail ou senha incorretos.', detalhe: '', erros: {} });
  }
  return request('POST', '/api/auth/login', { corpo: { email, senha } });
}

/** POST /api/auth/registrar */
export async function registrar(dados) {
  if (USE_MOCK) {
    await mockDelay(600);
    return { token: 'mock-jwt-token', expiraEm: new Date(Date.now() + 8 * 3600000).toISOString(), usuario: { id: 2, nome: dados.nome, email: dados.email, perfil: 'Gestor' } };
  }
  return request('POST', '/api/auth/registrar', { corpo: dados });
}

/** GET /api/auth/me */
export async function getMe() {
  if (USE_MOCK) {
    await mockDelay(100);
    return { id: 1, nome: 'Administrador', email: 'admin@fogo.local', perfil: 'Admin' };
  }
  return request('GET', '/api/auth/me');
}

// ── Tipos (com cache) ────────────────────────────────────────
/** GET /api/tipos – cacheia em memória */
export async function getTipos() {
  if (_cache.has('tipos')) return _cache.get('tipos');
  let result;
  if (USE_MOCK) {
    await mockDelay(150);
    result = Mock.MOCK_TIPOS;
  } else {
    result = await request('GET', '/api/tipos');
  }
  _cache.set('tipos', result);
  return result;
}

// ── Regiões (com cache) ──────────────────────────────────────
/** GET /api/regioes – cacheia em memória */
export async function getRegioes() {
  if (_cache.has('regioes')) return _cache.get('regioes');
  let result;
  if (USE_MOCK) {
    await mockDelay(100);
    result = Mock.MOCK_REGIOES;
  } else {
    result = await request('GET', '/api/regioes');
  }
  _cache.set('regioes', result);
  return result;
}

// ── Domínios (com cache) ─────────────────────────────────────
/** GET /api/dominios – cacheia em memória */
export async function getDominios() {
  if (_cache.has('dominios')) return _cache.get('dominios');
  let result;
  if (USE_MOCK) {
    await mockDelay(100);
    result = Mock.MOCK_DOMINIOS;
  } else {
    result = await request('GET', '/api/dominios');
  }
  _cache.set('dominios', result);
  return result;
}

// ── Equipamentos ─────────────────────────────────────────────
/**
 * GET /api/equipamentos – paginado
 * @param {{ tipo?, situacao?, regiaoId?, bairro?, orgao?, busca?, manutencao?, pagina?, tamanho? }} filtros
 */
export async function getEquipamentos(filtros = {}) {
  if (USE_MOCK) {
    await mockDelay(250);
    let itens = Mock.MOCK_EQUIPAMENTOS_MAPA.map(e => ({ ...e }));
    if (filtros.tipo) itens = itens.filter(e => e.tipoCodigo === filtros.tipo);
    if (filtros.situacao) itens = itens.filter(e => e.situacao === filtros.situacao);
    if (filtros.regiaoId) itens = itens.filter(e => e.regiaoId === Number(filtros.regiaoId));
    if (filtros.busca) { const b = filtros.busca.toLowerCase(); itens = itens.filter(e => e.numeroSerie.toLowerCase().includes(b) || e.marca?.toLowerCase().includes(b) || e.modelo?.toLowerCase().includes(b)); }
    const pagina = filtros.pagina || 1;
    const tamanho = filtros.tamanho || 20;
    const total = itens.length;
    itens = itens.slice((pagina - 1) * tamanho, pagina * tamanho);
    return { itens, total, pagina, tamanho };
  }
  return request('GET', '/api/equipamentos', { query: filtros });
}

/**
 * GET /api/equipamentos/mapa – sem paginação
 * @param {object} filtros
 * @param {AbortSignal} [signal]
 */
export async function getEquipamentosMapa(filtros = {}, signal) {
  if (USE_MOCK) {
    await mockDelay(200);
    let itens = Mock.MOCK_EQUIPAMENTOS_MAPA.map(e => ({ ...e }));
    if (filtros.tipo) itens = itens.filter(e => e.tipoCodigo === filtros.tipo);
    if (filtros.situacao) itens = itens.filter(e => e.situacao === filtros.situacao);
    if (filtros.regiaoId) itens = itens.filter(e => e.regiaoId === Number(filtros.regiaoId));
    if (filtros.busca) { const b = filtros.busca.toLowerCase(); itens = itens.filter(e => e.numeroSerie.toLowerCase().includes(b) || (e.marca || '').toLowerCase().includes(b)); }
    if (filtros.manutencao === 'imediata') itens = itens.filter(e => e.necessidadeManutencao === 'Imediata');
    return itens;
  }
  return request('GET', '/api/equipamentos/mapa', { query: filtros, signal });
}

/** GET /api/equipamentos/{id} */
export async function getEquipamento(id) {
  if (USE_MOCK) {
    await mockDelay(200);
    const eq = Mock.MOCK_EQUIPAMENTOS_MAPA.find(e => e.id === Number(id));
    if (!eq) throw new ApiError({ status: 404, titulo: 'Equipamento não encontrado.', detalhe: '', erros: {} });
    return { ...eq, cep: '17500-000', rua: 'Av. Sampaio Vidal', referencia: 'oposto ao número 181', cidade: 'Marília', uf: 'SP', regiaoNome: 'Centro', caracteristicas: {}, manutencoes: [], alertasAtivos: [], criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() };
  }
  return request('GET', `/api/equipamentos/${id}`);
}

/** POST /api/equipamentos */
export async function criarEquipamento(dados) {
  if (USE_MOCK) {
    await mockDelay(400);
    const novo = { ...dados, id: Date.now(), regiaoId: 1, bairro: dados.bairro || 'Centro', ultimoHeartbeat: null };
    Mock.MOCK_EQUIPAMENTOS_MAPA.push(novo);
    return novo;
  }
  return request('POST', '/api/equipamentos', { corpo: dados });
}

/** PUT /api/equipamentos/{id} */
export async function atualizarEquipamento(id, dados) {
  if (USE_MOCK) {
    await mockDelay(350);
    const idx = Mock.MOCK_EQUIPAMENTOS_MAPA.findIndex(e => e.id === Number(id));
    if (idx >= 0) Object.assign(Mock.MOCK_EQUIPAMENTOS_MAPA[idx], dados);
    return Mock.MOCK_EQUIPAMENTOS_MAPA[idx];
  }
  return request('PUT', `/api/equipamentos/${id}`, { corpo: dados });
}

/** DELETE /api/equipamentos/{id} */
export async function excluirEquipamento(id) {
  if (USE_MOCK) {
    await mockDelay(300);
    const idx = Mock.MOCK_EQUIPAMENTOS_MAPA.findIndex(e => e.id === Number(id));
    if (idx >= 0) Mock.MOCK_EQUIPAMENTOS_MAPA.splice(idx, 1);
    return null;
  }
  return request('DELETE', `/api/equipamentos/${id}`);
}

/** PATCH /api/equipamentos/{id}/situacao */
export async function alterarSituacaoEquipamento(id, situacao, observacao) {
  if (USE_MOCK) {
    await mockDelay(200);
    const eq = Mock.MOCK_EQUIPAMENTOS_MAPA.find(e => e.id === Number(id));
    if (eq) eq.situacao = situacao;
    return eq;
  }
  return request('PATCH', `/api/equipamentos/${id}/situacao`, { corpo: { situacao, observacao } });
}

// ── Agentes ──────────────────────────────────────────────────
/** GET /api/agentes */
export async function getAgentes(filtros = {}) {
  if (USE_MOCK) {
    await mockDelay(200);
    let itens = Mock.MOCK_AGENTES.map(a => ({ ...a }));
    if (filtros.cargo) itens = itens.filter(a => a.cargo === filtros.cargo);
    if (filtros.status) itens = itens.filter(a => a.status === filtros.status);
    if (filtros.regiaoId) itens = itens.filter(a => a.regiaoId === Number(filtros.regiaoId));
    if (filtros.busca) { const b = filtros.busca.toLowerCase(); itens = itens.filter(a => a.nome.toLowerCase().includes(b) || a.matricula.toLowerCase().includes(b)); }
    return itens;
  }
  return request('GET', '/api/agentes', { query: filtros });
}

/** GET /api/agentes/{id} */
export async function getAgente(id) {
  if (USE_MOCK) {
    await mockDelay(150);
    const ag = Mock.MOCK_AGENTES.find(a => a.id === Number(id));
    if (!ag) throw new ApiError({ status: 404, titulo: 'Agente não encontrado.', detalhe: '', erros: {} });
    return { ...ag };
  }
  return request('GET', `/api/agentes/${id}`);
}

/** POST /api/agentes */
export async function criarAgente(dados) {
  if (USE_MOCK) {
    await mockDelay(400);
    const novo = { ...dados, id: Date.now(), ultimaPosicaoEm: new Date().toISOString(), regiaoId: 1, regiaoNome: 'Centro', equipamentoVinculadoId: null };
    Mock.MOCK_AGENTES.push(novo);
    return novo;
  }
  return request('POST', '/api/agentes', { corpo: dados });
}

/** PUT /api/agentes/{id} */
export async function atualizarAgente(id, dados) {
  if (USE_MOCK) {
    await mockDelay(350);
    const idx = Mock.MOCK_AGENTES.findIndex(a => a.id === Number(id));
    if (idx >= 0) Object.assign(Mock.MOCK_AGENTES[idx], dados);
    return Mock.MOCK_AGENTES[idx];
  }
  return request('PUT', `/api/agentes/${id}`, { corpo: dados });
}

/** DELETE /api/agentes/{id} */
export async function excluirAgente(id) {
  if (USE_MOCK) {
    await mockDelay(300);
    const idx = Mock.MOCK_AGENTES.findIndex(a => a.id === Number(id));
    if (idx >= 0) Mock.MOCK_AGENTES.splice(idx, 1);
    return null;
  }
  return request('DELETE', `/api/agentes/${id}`);
}

/** PATCH /api/agentes/{id}/status */
export async function alterarStatusAgente(id, status) {
  if (USE_MOCK) {
    await mockDelay(200);
    const ag = Mock.MOCK_AGENTES.find(a => a.id === Number(id));
    if (ag) ag.status = status;
    return ag;
  }
  return request('PATCH', `/api/agentes/${id}/status`, { corpo: { status } });
}

// ── Dashboard ────────────────────────────────────────────────
/** GET /api/dashboard/resumo */
export async function getResumo() {
  if (USE_MOCK) {
    await mockDelay(150);
    return { ...Mock.MOCK_RESUMO, geradoEm: new Date().toISOString() };
  }
  return request('GET', '/api/dashboard/resumo');
}

/** GET /api/dashboard/manutencoes?dias=7 */
export async function getManutencoes(dias = 7) {
  if (USE_MOCK) {
    await mockDelay(150);
    return Mock.MOCK_MANUTENCOES.map(m => ({ ...m }));
  }
  return request('GET', '/api/dashboard/manutencoes', { query: { dias } });
}

// ── Alertas ──────────────────────────────────────────────────
/**
 * GET /api/alertas
 * @param {{ status?, criticidade?, regiaoId?, limite? }} filtros
 */
export async function getAlertas(filtros = {}) {
  if (USE_MOCK) {
    await mockDelay(200);
    let itens = Mock.MOCK_ALERTAS.map(a => ({ ...a }));
    if (filtros.status) itens = itens.filter(a => a.status === filtros.status);
    else itens = itens.filter(a => a.status === 'Ativo');
    if (filtros.criticidade) itens = itens.filter(a => a.criticidade === filtros.criticidade);
    return itens;
  }
  const q = { status: filtros.status || 'Ativo', ...filtros };
  return request('GET', '/api/alertas', { query: q });
}

/** PATCH /api/alertas/{id}/reconhecer */
export async function reconhecerAlerta(id) {
  if (USE_MOCK) {
    await mockDelay(200);
    const al = Mock.MOCK_ALERTAS.find(a => a.id === Number(id));
    if (al) { al.status = 'Reconhecido'; al.reconhecidoEm = new Date().toISOString(); }
    return al;
  }
  return request('PATCH', `/api/alertas/${id}/reconhecer`);
}

/** PATCH /api/alertas/{id}/resolver */
export async function resolverAlerta(id) {
  if (USE_MOCK) {
    await mockDelay(200);
    const al = Mock.MOCK_ALERTAS.find(a => a.id === Number(id));
    if (al) { al.status = 'Resolvido'; al.resolvidoEm = new Date().toISOString(); }
    return al;
  }
  return request('PATCH', `/api/alertas/${id}/resolver`);
}

// ── Simulação ────────────────────────────────────────────────
/**
 * POST /api/simulacao/falha
 * @param {'MauFuncionamento'|'Furtado'|'Offline'} tipo
 * @param {number} [equipamentoId]
 */
export async function simularFalha(tipo, equipamentoId) {
  if (USE_MOCK) {
    await mockDelay(300);
    const operacionais = Mock.MOCK_EQUIPAMENTOS_MAPA.filter(e => e.situacao === 'Operacional');
    const alvo = equipamentoId
      ? Mock.MOCK_EQUIPAMENTOS_MAPA.find(e => e.id === Number(equipamentoId))
      : operacionais[Math.floor(Math.random() * operacionais.length)];
    if (!alvo) throw new ApiError({ status: 404, titulo: 'Nenhum equipamento operacional disponível.', detalhe: '', erros: {} });
    alvo.situacao = tipo === 'Offline' ? 'MauFuncionamento' : tipo;
    alvo._simulado = true;
    return { ...alvo, cep: '17500-000', rua: 'Av. Simulada', referencia: '', cidade: 'Marília', uf: 'SP', regiaoNome: 'Centro', caracteristicas: {}, manutencoes: [], alertasAtivos: [], criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString() };
  }
  return request('POST', '/api/simulacao/falha', { corpo: { equipamentoId, tipo } });
}

/**
 * POST /api/simulacao/restaurar
 * @param {number} equipamentoId
 */
export async function restaurarEquipamento(equipamentoId) {
  if (USE_MOCK) {
    await mockDelay(250);
    const eq = Mock.MOCK_EQUIPAMENTOS_MAPA.find(e => e.id === Number(equipamentoId));
    if (eq) { eq.situacao = 'Operacional'; delete eq._simulado; }
    return eq;
  }
  return request('POST', '/api/simulacao/restaurar', { corpo: { equipamentoId } });
}

/** POST /api/simulacao/resetar */
export async function resetarSimulacao() {
  if (USE_MOCK) {
    await mockDelay(400);
    let n = 0;
    Mock.MOCK_EQUIPAMENTOS_MAPA.forEach(e => { if (e._simulado) { e.situacao = 'Operacional'; delete e._simulado; n++; } });
    return { restaurados: n };
  }
  return request('POST', '/api/simulacao/resetar');
}

// ── Histórico (Parte 3) ──────────────────────────────────────
/** GET /api/historico/telemetria */
export async function getHistoricoTelemetria(filtros = {}) {
  // TODO(contrato): Parte 3 – não implementado no front ainda
  if (USE_MOCK) return [];
  return request('GET', '/api/historico/telemetria', { query: filtros });
}

/** GET /api/historico/ocorrencias */
export async function getHistoricoOcorrencias(filtros = {}) {
  // TODO(contrato): Parte 3 – não implementado no front ainda
  if (USE_MOCK) return [];
  return request('GET', '/api/historico/ocorrencias', { query: filtros });
}

/** GET /api/historico/serie */
export async function getHistoricoSerie(filtros = {}) {
  // TODO(contrato): Parte 3 – não implementado no front ainda
  if (USE_MOCK) return [];
  return request('GET', '/api/historico/serie', { query: filtros });
}
