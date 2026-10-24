// ============================================================
// PROMETHEUS F.O.G.O. – dashboard.js
// ============================================================
import { exigirLogin } from './auth.js';
import { montarLayout, atualizarIndicadorRealtime } from './layout.js';
import {
  getResumo, getEquipamentosMapa, getAgentes, getAlertas,
  getManutencoes, getTipos, getRegioes, getDominios,
  getEquipamento, getAgente,
  reconhecerAlerta, resolverAlerta,
  simularFalha, resetarSimulacao
} from './api.js';
import {
  mostrarToast, formatarData, formatarDataSimples,
  formatarTempoRelativo, formatarNumero,
  badgeSituacao, badgeCriticidade, badgeStatusAgente,
  escapeHtml, debounce, confirmar, abrirModal, fecharModal
} from './ui.js';
import {
  criarMapa, criarIconeEquipamento, criarIconeAgente,
  criarCamadaCluster, criarCamadaCalor,
  centralizarEm, renderizarCirculosRegiao
} from './map.js';
import { iniciarTempoReal } from './realtime.js';
import {
  USE_MOCK, DEBOUNCE_FILTROS_MS, FEED_MAX_EVENTOS,
  MANUTENCAO_DIAS, MAPA_CENTRO, MAPA_ZOOM_INICIAL,
  INTERVALO_FALLBACK_MS
} from './config.js';

// ── Proteção ─────────────────────────────────────────────────
exigirLogin();
montarLayout('centro');

// ── Estado global ────────────────────────────────────────────
const estado = {
  filtros: { tipo: '', situacao: '', regiaoId: '', bairro: '', orgao: '', busca: '', manutencao: '' },
  equipamentos: new Map(),  // id → EquipamentoMapa
  agentes: new Map(),       // id → Agente
  alertas: [],
  resumo: null,
  tipos: [],
  regioes: [],
  dominios: null,
  detalheAberto: null,  // { tipo: 'equipamento'|'agente', id }
  filtroAlertaCriticidade: null,
  tipoFiltroAtivo: ''
};

// ── Mapa e camadas ────────────────────────────────────────────
let mapa = null;
const marcadoresEq = new Map();  // id → Leaflet marker
const marcadoresAg = new Map();  // id → Leaflet marker
let camadaCluster = null;
let camadaAgentes = null;
let camadaCalor = null;
let camadaRegioes = null;

// ── Gráficos ──────────────────────────────────────────────────
let graficoPizza = null;
let graficoBarras = null;

// ── Abortar requisição de mapa ────────────────────────────────
let abortMapa = null;

// ── Intervalo de fallback ─────────────────────────────────────
let intervalFallback = null;

// ============================================================
// INICIALIZAÇÃO
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  _iniciarMapa();
  _configurarControles();
  await iniciarDashboard();
  _configurarModoDemo();
  _configurarDrawer();
});

export async function iniciarDashboard() {
  try {
    [estado.tipos, estado.regioes, estado.dominios] = await Promise.all([
      getTipos(), getRegioes(), getDominios()
    ]);
    _preencherFiltros();
  } catch (err) {
    mostrarToast('Erro ao carregar dados de configuração.', 'atencao');
  }

  await Promise.all([
    carregarResumo(),
    carregarEquipamentosMapa(),
    carregarAgentes(),
    carregarAlertas(),
    carregarManutencoes()
  ]);

  // Tempo real
  if (!USE_MOCK) {
    await iniciarTempoReal({
      onEquipamentoAtualizado,
      onAgenteAtualizado,
      onAlertaCriado,
      onAlertaAtualizado,
      onResumoAtualizado,
      onEventoOperacional,
      onEstadoConexao: (estado) => {
        atualizarIndicadorRealtime(estado);
        if (estado === 'offline' || estado === 'reconectando') {
          _iniciarFallback();
        } else {
          _pararFallback();
        }
      }
    });
  }
}

// ============================================================
// CARREGAR DADOS
// ============================================================
export async function carregarResumo() {
  try {
    const resumo = await getResumo();
    estado.resumo = resumo;
    renderizarKpis(resumo);
    renderizarPainelTipos(resumo);
    renderizarRegioes(resumo);
    renderizarGraficos(resumo);
  } catch (err) {
    mostrarToast('Erro ao carregar resumo do dashboard.', 'atencao');
  }
}

export async function carregarEquipamentosMapa() {
  if (abortMapa) abortMapa.abort();
  abortMapa = new AbortController();
  try {
    const eqs = await getEquipamentosMapa(estado.filtros, abortMapa.signal);
    estado.equipamentos.clear();
    eqs.forEach(eq => estado.equipamentos.set(eq.id, eq));
    renderizarMarcadoresEquipamentos();
    _atualizarContadorMapa(eqs.length);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    mostrarToast('Erro ao carregar equipamentos no mapa.', 'atencao');
  }
}

export async function carregarAgentes() {
  try {
    const ags = await getAgentes();
    estado.agentes.clear();
    ags.forEach(ag => estado.agentes.set(ag.id, ag));
    renderizarMarcadoresAgentes();
  } catch (err) {
    mostrarToast('Erro ao carregar agentes.', 'atencao');
  }
}

export async function carregarAlertas() {
  try {
    const alertas = await getAlertas({ status: 'Ativo', limite: 50 });
    estado.alertas = alertas;
    renderizarAlertas();
  } catch (err) {
    mostrarToast('Erro ao carregar alertas.', 'atencao');
  }
}

export async function carregarManutencoes() {
  try {
    const mts = await getManutencoes(MANUTENCAO_DIAS);
    renderizarManutencoes(mts);
  } catch (err) {
    mostrarToast('Erro ao carregar manutenções.', 'atencao');
  }
}

// ============================================================
// MAPA
// ============================================================
function _iniciarMapa() {
  mapa = criarMapa('mapa', { centro: MAPA_CENTRO, zoom: MAPA_ZOOM_INICIAL });
  camadaCluster = criarCamadaCluster();
  camadaAgentes = window.L?.layerGroup() || null;
  camadaCluster?.addTo(mapa);
  camadaAgentes?.addTo(mapa);
}

export function renderizarMarcadoresEquipamentos() {
  if (!mapa || !camadaCluster) return;
  // Remove marcadores que não existem mais
  for (const [id, marker] of marcadoresEq) {
    if (!estado.equipamentos.has(id)) {
      camadaCluster.removeLayer(marker);
      marcadoresEq.delete(id);
    }
  }

  const tiposMap = new Map(estado.tipos.map(t => [t.codigo, t]));

  for (const [id, eq] of estado.equipamentos) {
    const tipo = tiposMap.get(eq.tipoCodigo) || {};
    const critico = eq.situacao === 'Furtado';
    const icone = criarIconeEquipamento(tipo, eq.situacao, critico);

    if (marcadoresEq.has(id)) {
      // Atualiza ícone e posição
      const m = marcadoresEq.get(id);
      m.setIcon(icone);
      if (eq.latitude && eq.longitude) m.setLatLng([eq.latitude, eq.longitude]);
    } else {
      // Cria novo marcador
      if (!eq.latitude || !eq.longitude) continue;
      const m = window.L.marker([eq.latitude, eq.longitude], { icon: icone });
      m.on('click', () => abrirDetalheEquipamento(id));
      m.bindTooltip(`${tipo.icone || '📦'} ${escapeHtml(eq.numeroSerie)}<br>${escapeHtml(eq.situacao)}`, { direction: 'top' });
      camadaCluster.addLayer(m);
      marcadoresEq.set(id, m);
    }
  }

  // Atualizar heatmap se ligado
  _atualizarHeatmapSeAtivo();
}

export function renderizarMarcadoresAgentes() {
  if (!mapa || !camadaAgentes) return;
  for (const [id, marker] of marcadoresAg) {
    if (!estado.agentes.has(id)) {
      camadaAgentes.removeLayer(marker);
      marcadoresAg.delete(id);
    }
  }

  for (const [id, ag] of estado.agentes) {
    const icone = criarIconeAgente(ag.status);
    if (marcadoresAg.has(id)) {
      const m = marcadoresAg.get(id);
      m.setIcon(icone);
      if (ag.latitude && ag.longitude) m.setLatLng([ag.latitude, ag.longitude]);
    } else {
      if (!ag.latitude || !ag.longitude) continue;
      const m = window.L.marker([ag.latitude, ag.longitude], { icon: icone });
      m.on('click', () => abrirDetalheAgente(id));
      m.bindTooltip(`👮 ${escapeHtml(ag.nome)}<br>${escapeHtml(ag.status)}`, { direction: 'top' });
      camadaAgentes.addLayer(m);
      marcadoresAg.set(id, m);
    }
  }
}

function _atualizarHeatmapSeAtivo() {
  const toggle = document.getElementById('toggle-heatmap');
  if (!toggle?.checked) return;
  _ligarHeatmap();
}

function _ligarHeatmap() {
  if (camadaCalor) { mapa.removeLayer(camadaCalor); camadaCalor = null; }
  const pontos = [];
  for (const [, eq] of estado.equipamentos) {
    if (!eq.latitude || !eq.longitude) continue;
    if (eq.situacao !== 'Operacional') {
      const peso = eq.situacao === 'Furtado' ? 1.0 : 0.6;
      pontos.push([eq.latitude, eq.longitude, peso]);
    }
  }
  // Alertas críticos com peso maior
  estado.alertas.forEach(al => {
    if (al.latitude && al.longitude && al.criticidade === 'Critico') {
      pontos.push([al.latitude, al.longitude, 1.0]);
    }
  });
  camadaCalor = criarCamadaCalor(pontos);
  camadaCalor.addTo(mapa);
}

// ============================================================
// KPIs
// ============================================================
export function renderizarKpis(resumo) {
  if (!resumo) return;
  requestAnimationFrame(() => {
    _setKpi('kpi-agentes-campo', formatarNumero(resumo.agentesEmCampo));
    _setKpi('kpi-alertas-ativos', formatarNumero(resumo.alertasAtivos));
    _setKpi('kpi-ocorrencias-hoje', formatarNumero(resumo.ocorrenciasHoje));
    _setKpi('kpi-total-equipamentos', formatarNumero(resumo.totalEquipamentos));
    _setKpi('kpi-operacionais', formatarNumero(resumo.operacionais));
    _setKpi('kpi-indisponiveis', formatarNumero(resumo.indisponiveis));
    _setKpi('kpi-manutencao-imediata', formatarNumero(resumo.manutencaoImediata));

    // Anel
    const pct = resumo.percentualDisponibilidade || 0;
    const el = document.getElementById('kpi-disponibilidade-pct');
    if (el) el.textContent = formatarNumero(pct, 1) + '%';
    const anel = document.getElementById('kpi-anel-progresso');
    if (anel) {
      const circ = 2 * Math.PI * 32;
      const offset = circ - (pct / 100) * circ;
      anel.style.strokeDashoffset = offset.toFixed(2);
      anel.style.stroke = pct >= 90 ? '#22C55E' : pct >= 75 ? '#F59E0B' : '#EF4444';
    }
  });
}

function _setKpi(id, valor) {
  const el = document.getElementById(id);
  if (el && el.textContent !== String(valor)) {
    el.style.animation = 'none';
    el.offsetHeight;
    el.textContent = valor;
    el.style.animation = '';
  }
}

// ============================================================
// PAINEL DE TIPOS
// ============================================================
export function renderizarPainelTipos(resumo) {
  const lista = document.getElementById('lista-tipos');
  if (!lista || !resumo) return;

  const porTipoMap = new Map((resumo.porTipo || []).map(t => [t.tipoCodigo, t]));

  let html = `
    <div class="fogo-tipo-item ${!estado.tipoFiltroAtivo ? 'ativo' : ''}"
         data-tipo=""
         role="listitem"
         tabindex="0"
         aria-pressed="${!estado.tipoFiltroAtivo}">
      <span class="fogo-tipo-item__icone">📋</span>
      <div class="fogo-tipo-item__info">
        <div class="fogo-tipo-item__nome">TODOS</div>
      </div>
      <span class="fogo-tipo-item__total">${formatarNumero(resumo.totalEquipamentos)}</span>
    </div>
  `;

  (resumo.porTipo || []).forEach(t => {
    const pct = t.total > 0 ? (t.operacionais / t.total) * 100 : 0;
    html += `
      <div class="fogo-tipo-item ${estado.tipoFiltroAtivo === t.tipoCodigo ? 'ativo' : ''}"
           data-tipo="${escapeHtml(t.tipoCodigo)}"
           role="listitem"
           tabindex="0"
           aria-pressed="${estado.tipoFiltroAtivo === t.tipoCodigo}">
        <span class="fogo-tipo-item__icone">${escapeHtml(t.icone)}</span>
        <div class="fogo-tipo-item__info">
          <div class="fogo-tipo-item__nome">${escapeHtml(t.tipoNome)}</div>
          <div class="fogo-tipo-item__barra">
            <div class="fogo-tipo-item__barra-fill" style="width:${pct.toFixed(0)}%;background:${escapeHtml(t.cor || '#22C55E')}"></div>
          </div>
        </div>
        <span class="fogo-tipo-item__total">${formatarNumero(t.total)}</span>
      </div>
    `;
  });

  lista.innerHTML = html;

  lista.querySelectorAll('.fogo-tipo-item').forEach(el => {
    const handler = () => {
      const tipo = el.dataset.tipo;
      estado.tipoFiltroAtivo = tipo;
      estado.filtros.tipo = tipo;
      // Sincroniza select
      const sel = document.getElementById('filtro-tipo');
      if (sel) sel.value = tipo;
      aplicarFiltros();
      // Visual
      lista.querySelectorAll('.fogo-tipo-item').forEach(i => {
        const ativo = i.dataset.tipo === tipo;
        i.classList.toggle('ativo', ativo);
        i.setAttribute('aria-pressed', ativo);
      });
    };
    el.addEventListener('click', handler);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
}

// ============================================================
// REGIÕES
// ============================================================
export function renderizarRegioes(resumo) {
  const grid = document.getElementById('grid-regioes');
  if (!grid || !resumo) return;

  grid.innerHTML = (resumo.porRegiao || []).map(r => `
    <div class="fogo-regiao-card fogo-regiao-card--${escapeHtml(r.nivel)}"
         data-regiao-id="${r.regiaoId}"
         role="listitem"
         tabindex="0"
         aria-label="${escapeHtml(r.nome)}: disponibilidade ${r.percentualDisponibilidade?.toFixed(1)}%, nível ${escapeHtml(r.nivel)}">
      <div class="fogo-regiao-card__nome">${escapeHtml(r.nome)}</div>
      <div class="fogo-regiao-card__pct">${r.percentualDisponibilidade?.toFixed(1)}%</div>
      <div class="fogo-regiao-card__alertas">${r.alertasAtivos} alertas · ${r.total} equipamentos</div>
    </div>
  `).join('');

  grid.querySelectorAll('.fogo-regiao-card').forEach(card => {
    const clickHandler = () => {
      const regiaoId = card.dataset.regiaoId;
      estado.filtros.regiaoId = regiaoId;
      const sel = document.getElementById('filtro-regiao');
      if (sel) sel.value = regiaoId;
      aplicarFiltros();
    };
    card.addEventListener('click', clickHandler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(); } });
  });

  // Camada de regiões no mapa se ligada
  if (document.getElementById('toggle-regioes')?.checked && mapa) {
    if (camadaRegioes) mapa.removeLayer(camadaRegioes);
    camadaRegioes = renderizarCirculosRegiao(mapa, resumo.porRegiao || []);
    camadaRegioes.addTo(mapa);
  }
}

// ============================================================
// ALERTAS
// ============================================================
export function renderizarAlertas() {
  const lista = document.getElementById('lista-alertas');
  if (!lista) return;

  const crit = estado.filtroAlertaCriticidade;
  const itens = crit ? estado.alertas.filter(a => a.criticidade === crit) : estado.alertas;

  if (itens.length === 0) {
    lista.innerHTML = '<div class="fogo-estado-vazio"><span class="icone">✅</span><span>Nenhum alerta ativo</span></div>';
    return;
  }

  const coresCrit = { Critico: '#EF4444', Atencao: '#F59E0B', Info: '#38BDF8' };

  lista.innerHTML = itens.map(al => `
    <div class="fogo-alerta-card" data-id="${al.id}" role="listitem"
         aria-label="Alerta: ${escapeHtml(al.titulo)}, criticidade ${escapeHtml(al.criticidade)}">
      <div class="fogo-alerta-card__barra" style="background:${coresCrit[al.criticidade] || '#6B7280'}"></div>
      <div class="fogo-alerta-card__corpo">
        <div class="fogo-alerta-card__titulo">${escapeHtml(al.titulo)}</div>
        <div class="fogo-alerta-card__meta">
          <span>${escapeHtml(al.regiaoNome || '')}</span>
          <span>${formatarTempoRelativo(al.criadoEm)}</span>
          ${badgeCriticidade(al.criticidade)}
        </div>
      </div>
      <div class="fogo-alerta-card__acoes">
        <button class="fogo-btn fogo-btn--sm btn-reconhecer" data-id="${al.id}"
                aria-label="Reconhecer alerta ${al.id}" title="Reconhecer"
                ${al.status !== 'Ativo' ? 'disabled' : ''}>✓</button>
        <button class="fogo-btn fogo-btn--sm fogo-btn--perigo btn-resolver" data-id="${al.id}"
                aria-label="Resolver alerta ${al.id}" title="Resolver"
                ${al.status === 'Resolvido' ? 'disabled' : ''}>✗</button>
      </div>
    </div>
  `).join('');

  // Clicar no card centraliza no mapa e abre drawer
  lista.querySelectorAll('.fogo-alerta-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const id = Number(card.dataset.id);
      const al = estado.alertas.find(a => a.id === id);
      if (al?.latitude && al?.longitude) centralizarEm(mapa, al.latitude, al.longitude);
      if (al?.equipamentoId) abrirDetalheEquipamento(al.equipamentoId);
    });
  });

  lista.querySelectorAll('.btn-reconhecer').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      try {
        await reconhecerAlerta(id);
        mostrarToast('Alerta reconhecido.', 'ok');
        await carregarAlertas();
      } catch { mostrarToast('Erro ao reconhecer alerta.', 'atencao'); }
    });
  });

  lista.querySelectorAll('.btn-resolver').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      try {
        await resolverAlerta(id);
        mostrarToast('Alerta resolvido.', 'ok');
        await carregarAlertas();
      } catch { mostrarToast('Erro ao resolver alerta.', 'atencao'); }
    });
  });
}

// ============================================================
// MANUTENÇÃO
// ============================================================
export function renderizarManutencoes(mts) {
  const lista = document.getElementById('lista-manutencao');
  if (!lista) return;

  if (!mts || mts.length === 0) {
    lista.innerHTML = '<div class="fogo-estado-vazio" style="padding:16px;"><span>✅ Nenhuma manutenção urgente</span></div>';
    return;
  }

  lista.innerHTML = mts.map(m => {
    let urgClass = 'urgencia-proxima';
    let urgLabel = m.diasRestantes !== null ? `em ${m.diasRestantes} dia${m.diasRestantes !== 1 ? 's' : ''}` : 'Agendada';
    if (m.necessidadeManutencao === 'Imediata' || (m.diasRestantes !== null && m.diasRestantes < 0)) {
      urgClass = m.diasRestantes !== null && m.diasRestantes < 0 ? 'urgencia-vencida' : 'urgencia-imediata';
      urgLabel = m.diasRestantes !== null && m.diasRestantes < 0 ? 'VENCIDA' : 'IMEDIATA';
    }
    return `
      <div class="fogo-manutencao-item" role="listitem"
           data-eq-id="${m.equipamentoId}"
           tabindex="0"
           aria-label="${escapeHtml(m.numeroSerie)} – ${urgLabel}">
        <span class="fogo-manutencao-item__urgencia ${urgClass}">${urgLabel}</span>
        <span class="fogo-manutencao-item__serie">${escapeHtml(m.numeroSerie)}</span>
        <span class="fogo-manutencao-item__data">${formatarDataSimples(m.proximaManutencao)}</span>
      </div>
    `;
  }).join('');

  lista.querySelectorAll('.fogo-manutencao-item').forEach(item => {
    const handler = () => abrirDetalheEquipamento(Number(item.dataset.eqId));
    item.addEventListener('click', handler);
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });
}

// ============================================================
// GRÁFICOS
// ============================================================
export function renderizarGraficos(resumo) {
  if (!resumo || !window.Chart) return;
  requestAnimationFrame(() => {
    _renderizarGraficoPizza(resumo);
    _renderizarGraficoBarras(resumo);
  });
}

function _renderizarGraficoPizza(resumo) {
  const ctx = document.getElementById('grafico-situacao')?.getContext('2d');
  if (!ctx) return;

  const dados = resumo.porSituacao || [];
  const cores = {
    Operacional: '#22C55E', MauFuncionamento: '#F59E0B',
    EmManutencao: '#3B82F6', Desativado: '#6B7280',
    Furtado: '#EF4444', NaoInstalado: '#94A3B8'
  };
  const rotulos = {
    Operacional: 'Operacional', MauFuncionamento: 'Mau func.',
    EmManutencao: 'Em manutenção', Desativado: 'Desativado',
    Furtado: 'Furtado', NaoInstalado: 'Não instalado'
  };

  const labels = dados.map(d => rotulos[d.situacao] || d.situacao);
  const values = dados.map(d => d.total);
  const bgs = dados.map(d => cores[d.situacao] || '#6B7280');

  if (graficoPizza) {
    graficoPizza.data.labels = labels;
    graficoPizza.data.datasets[0].data = values;
    graficoPizza.data.datasets[0].backgroundColor = bgs;
    graficoPizza.update();
    return;
  }

  graficoPizza = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: bgs, borderColor: 'rgba(4,10,24,0.8)', borderWidth: 2, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#93A9CC', font: { family: 'Inter', size: 10 }, boxWidth: 10, padding: 8 }
        },
        tooltip: {
          backgroundColor: 'rgba(8,18,43,0.95)',
          titleColor: '#E6F0FF', bodyColor: '#93A9CC', borderColor: 'rgba(56,189,248,0.3)', borderWidth: 1
        }
      }
    }
  });
}

function _renderizarGraficoBarras(resumo) {
  const ctx = document.getElementById('grafico-tipos')?.getContext('2d');
  if (!ctx) return;

  const dados = (resumo.porTipo || []).slice(0, 8);
  const labels = dados.map(d => d.tipoNome.length > 16 ? d.tipoNome.substring(0, 14) + '…' : d.tipoNome);
  const operacionais = dados.map(d => d.operacionais);
  const indisponiveis = dados.map(d => d.indisponiveis);

  if (graficoBarras) {
    graficoBarras.data.labels = labels;
    graficoBarras.data.datasets[0].data = operacionais;
    graficoBarras.data.datasets[1].data = indisponiveis;
    graficoBarras.update();
    return;
  }

  graficoBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Operacionais', data: operacionais, backgroundColor: 'rgba(34,197,94,0.6)', borderColor: '#22C55E', borderWidth: 1 },
        { label: 'Indisponíveis', data: indisponiveis, backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#EF4444', borderWidth: 1 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#93A9CC', font: { size: 10 }, boxWidth: 10, padding: 6 } },
        tooltip: { backgroundColor: 'rgba(8,18,43,0.95)', titleColor: '#E6F0FF', bodyColor: '#93A9CC', borderColor: 'rgba(56,189,248,0.3)', borderWidth: 1 }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#5F7499', font: { size: 9 } }, grid: { color: 'rgba(56,189,248,0.06)' } },
        y: { stacked: true, ticks: { color: '#93A9CC', font: { size: 9 } }, grid: { display: false } }
      }
    }
  });
}

// ============================================================
// FILTROS
// ============================================================
function _preencherFiltros() {
  const selTipo = document.getElementById('filtro-tipo');
  if (selTipo && estado.tipos.length) {
    estado.tipos.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.codigo;
      opt.textContent = `${t.icone} ${t.nome}`;
      selTipo.appendChild(opt);
    });
  }

  const selSit = document.getElementById('filtro-situacao');
  if (selSit && estado.dominios?.situacoes) {
    estado.dominios.situacoes.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.valor;
      opt.textContent = s.rotulo;
      selSit.appendChild(opt);
    });
  }

  const selReg = document.getElementById('filtro-regiao');
  if (selReg && estado.regioes.length) {
    estado.regioes.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id;
      opt.textContent = r.nome;
      selReg.appendChild(opt);
    });
  }

  const selBairro = document.getElementById('filtro-bairro');
  if (selBairro && estado.dominios?.bairros) {
    estado.dominios.bairros.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      selBairro.appendChild(opt);
    });
  }

  const selOrgao = document.getElementById('filtro-orgao');
  if (selOrgao && estado.dominios?.orgaos) {
    estado.dominios.orgaos.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.valor;
      opt.textContent = o.rotulo;
      selOrgao.appendChild(opt);
    });
  }
}

function _configurarControles() {
  const debouncedFiltrar = debounce(aplicarFiltros, DEBOUNCE_FILTROS_MS);

  ['filtro-tipo', 'filtro-situacao', 'filtro-regiao', 'filtro-bairro', 'filtro-orgao', 'filtro-manutencao'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      const campo = id.replace('filtro-', '');
      if (campo === 'regiao') estado.filtros.regiaoId = e.target.value;
      else estado.filtros[campo] = e.target.value;
      if (id === 'filtro-tipo') estado.tipoFiltroAtivo = e.target.value;
      aplicarFiltros();
    });
  });

  document.getElementById('filtro-busca')?.addEventListener('input', e => {
    estado.filtros.busca = e.target.value;
    debouncedFiltrar();
  });

  document.getElementById('btn-limpar-filtros')?.addEventListener('click', limparFiltros);

  // Camadas
  document.getElementById('toggle-equipamentos')?.addEventListener('change', e => {
    e.target.checked ? camadaCluster?.addTo(mapa) : mapa?.removeLayer(camadaCluster);
  });

  document.getElementById('toggle-agentes')?.addEventListener('change', e => {
    e.target.checked ? camadaAgentes?.addTo(mapa) : mapa?.removeLayer(camadaAgentes);
  });

  document.getElementById('toggle-cluster')?.addEventListener('change', e => {
    // Recriar camada cluster ou usar layerGroup simples
    if (e.target.checked) {
      if (!camadaCluster || !camadaCluster.addLayer) {
        camadaCluster = criarCamadaCluster();
      }
    }
    renderizarMarcadoresEquipamentos();
  });

  document.getElementById('toggle-heatmap')?.addEventListener('change', e => {
    if (e.target.checked) _ligarHeatmap();
    else if (camadaCalor) { mapa?.removeLayer(camadaCalor); camadaCalor = null; }
  });

  document.getElementById('toggle-regioes')?.addEventListener('change', e => {
    if (e.target.checked && estado.resumo) {
      if (camadaRegioes) mapa?.removeLayer(camadaRegioes);
      camadaRegioes = renderizarCirculosRegiao(mapa, estado.resumo.porRegiao || []);
      camadaRegioes.addTo(mapa);
    } else if (camadaRegioes) {
      mapa?.removeLayer(camadaRegioes);
    }
  });

  // Abas de alertas
  ['aba-alertas-todos', 'aba-alertas-critico', 'aba-alertas-atencao'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      document.querySelectorAll('.fogo-abas .fogo-aba').forEach(b => b.classList.remove('ativa'));
      document.getElementById(id)?.classList.add('ativa');
      if (id === 'aba-alertas-todos') estado.filtroAlertaCriticidade = null;
      else if (id === 'aba-alertas-critico') estado.filtroAlertaCriticidade = 'Critico';
      else estado.filtroAlertaCriticidade = 'Atencao';
      renderizarAlertas();
    });
  });
}

export function aplicarFiltros() {
  carregarEquipamentosMapa();
}

export function limparFiltros() {
  estado.filtros = { tipo: '', situacao: '', regiaoId: '', bairro: '', orgao: '', busca: '', manutencao: '' };
  estado.tipoFiltroAtivo = '';
  ['filtro-tipo', 'filtro-situacao', 'filtro-regiao', 'filtro-bairro', 'filtro-orgao', 'filtro-manutencao'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const busca = document.getElementById('filtro-busca');
  if (busca) busca.value = '';
  aplicarFiltros();
  // Resetar painel de tipos
  document.querySelectorAll('.fogo-tipo-item').forEach(i => {
    const ativo = i.dataset.tipo === '';
    i.classList.toggle('ativo', ativo);
    i.setAttribute('aria-pressed', ativo);
  });
}

function _atualizarContadorMapa(n) {
  const el = document.getElementById('contador-mapa');
  if (el) el.textContent = `${formatarNumero(n)} equipamento${n !== 1 ? 's' : ''} no mapa`;
}

// ============================================================
// DRAWER
// ============================================================
function _configurarDrawer() {
  const drawer = document.getElementById('drawer-detalhe');
  document.getElementById('btn-fechar-detalhe')?.addEventListener('click', fecharDetalhe);
  drawer?.addEventListener('keydown', e => { if (e.key === 'Escape') fecharDetalhe(); });
}

export async function abrirDetalheEquipamento(id) {
  const drawer = document.getElementById('drawer-detalhe');
  const conteudo = document.getElementById('detalhe-conteudo');
  if (!drawer || !conteudo) return;

  estado.detalheAberto = { tipo: 'equipamento', id };
  drawer.classList.add('aberto');
  drawer.setAttribute('aria-hidden', 'false');
  document.getElementById('btn-ver-inventario').href = `/equipamentos.html?id=${id}`;
  document.getElementById('btn-centralizar').onclick = () => {
    const eq = estado.equipamentos.get(id);
    if (eq?.latitude && eq?.longitude) centralizarEm(mapa, eq.latitude, eq.longitude);
  };

  conteudo.innerHTML = '<div class="fogo-loading"><div class="fogo-spinner"></div><span>Carregando detalhes…</span></div>';

  try {
    const eq = await getEquipamento(id);
    _renderizarDetalheEquipamento(conteudo, eq);
  } catch {
    conteudo.innerHTML = '<div class="fogo-estado-erro">Erro ao carregar detalhes do equipamento.</div>';
  }
}

export async function abrirDetalheAgente(id) {
  const drawer = document.getElementById('drawer-detalhe');
  const conteudo = document.getElementById('detalhe-conteudo');
  if (!drawer || !conteudo) return;

  estado.detalheAberto = { tipo: 'agente', id };
  drawer.classList.add('aberto');
  drawer.setAttribute('aria-hidden', 'false');
  document.getElementById('btn-ver-inventario').href = `/agentes.html?id=${id}`;
  document.getElementById('btn-centralizar').onclick = () => {
    const ag = estado.agentes.get(id);
    if (ag?.latitude && ag?.longitude) centralizarEm(mapa, ag.latitude, ag.longitude);
  };

  conteudo.innerHTML = '<div class="fogo-loading"><div class="fogo-spinner"></div><span>Carregando detalhes…</span></div>';

  try {
    const ag = await getAgente(id);
    _renderizarDetalheAgente(conteudo, ag);
  } catch {
    conteudo.innerHTML = '<div class="fogo-estado-erro">Erro ao carregar detalhes do agente.</div>';
  }
}

export function fecharDetalhe() {
  const drawer = document.getElementById('drawer-detalhe');
  drawer?.classList.remove('aberto');
  drawer?.setAttribute('aria-hidden', 'true');
  estado.detalheAberto = null;
}

function _renderizarDetalheEquipamento(conteudo, eq) {
  const tiposMap = new Map(estado.tipos.map(t => [t.codigo, t]));
  const tipo = tiposMap.get(eq.tipoCodigo) || {};

  // Campos dinâmicos (características)
  let camposHtml = '';
  if (eq.caracteristicas && tipo.camposSchema) {
    camposHtml = tipo.camposSchema.map(campo => {
      const val = eq.caracteristicas[campo.chave];
      if (val === undefined || val === null) return '';
      let valStr = String(val);
      if (campo.tipo === 'booleano') valStr = val ? 'Sim' : 'Não';
      if (campo.unidade) valStr += ` ${campo.unidade}`;
      return `<div class="detalhe-item">
        <span class="detalhe-item__rotulo">${escapeHtml(campo.rotulo)}</span>
        <span class="detalhe-item__valor">${escapeHtml(valStr)}</span>
      </div>`;
    }).join('');
  }

  // Alertas ativos
  const alertasHtml = (eq.alertasAtivos || []).map(al => `
    <div style="display:flex; gap:8px; align-items:center; padding: 4px 0;">
      ${badgeCriticidade(al.criticidade)}
      <span style="font-size:0.78rem; color:var(--texto-suave);">${escapeHtml(al.titulo)}</span>
    </div>
  `).join('') || '<span style="color:var(--texto-mudo); font-size:0.78rem;">Nenhum alerta ativo</span>';

  // Histórico de manutenções
  const manuHtml = (eq.manutencoes || []).slice(0, 3).map(m => `
    <div class="detalhe-item">
      <span class="detalhe-item__rotulo">${escapeHtml(m.tipo || 'Manutenção')}</span>
      <span class="detalhe-item__valor">${formatarDataSimples(m.dataPrevista)}${m.dataRealizada ? ` → ${formatarDataSimples(m.dataRealizada)}` : ''}</span>
    </div>
  `).join('') || '<span style="color:var(--texto-mudo); font-size:0.78rem;">Sem histórico</span>';

  conteudo.innerHTML = `
    <div class="detalhe-icone-tipo">
      <span class="detalhe-emoji">${escapeHtml(tipo.icone || '📦')}</span>
      <div>
        <div class="detalhe-nome-tipo">${escapeHtml(tipo.nome || eq.tipoCodigo)}</div>
        <div class="detalhe-serie">${escapeHtml(eq.numeroSerie)}</div>
      </div>
    </div>

    <div>${badgeSituacao(eq.situacao)}</div>

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Identificação</div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Marca</span><span class="detalhe-item__valor">${escapeHtml(eq.marca || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Modelo</span><span class="detalhe-item__valor">${escapeHtml(eq.modelo || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Órgão</span><span class="detalhe-item__valor">${escapeHtml(eq.orgao || '—')}</span></div>
    </div>

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Localização</div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Rua</span><span class="detalhe-item__valor">${escapeHtml(eq.rua || '—')}</span></div>
      ${eq.referencia ? `<div class="detalhe-item"><span class="detalhe-item__rotulo">Referência</span><span class="detalhe-item__valor">${escapeHtml(eq.referencia)}</span></div>` : ''}
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Bairro</span><span class="detalhe-item__valor">${escapeHtml(eq.bairro || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">CEP</span><span class="detalhe-item__valor">${escapeHtml(eq.cep || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Cidade/UF</span><span class="detalhe-item__valor">${escapeHtml((eq.cidade || '') + '/' + (eq.uf || ''))}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Coordenadas</span><span class="detalhe-item__valor">${eq.latitude?.toFixed(6)}, ${eq.longitude?.toFixed(6)}</span></div>
    </div>

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Manutenção</div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Necessidade</span><span class="detalhe-item__valor">${escapeHtml(eq.necessidadeManutencao || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Próxima</span><span class="detalhe-item__valor">${formatarDataSimples(eq.proximaManutencao)}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Último heartbeat</span><span class="detalhe-heartbeat">${formatarTempoRelativo(eq.ultimoHeartbeat)}</span></div>
    </div>

    ${camposHtml ? `<div class="detalhe-grupo"><div class="detalhe-grupo__titulo">Características</div>${camposHtml}</div>` : ''}

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Alertas ativos</div>
      ${alertasHtml}
    </div>

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Histórico de manutenção</div>
      ${manuHtml}
    </div>
  `;
}

function _renderizarDetalheAgente(conteudo, ag) {
  conteudo.innerHTML = `
    <div class="detalhe-icone-tipo">
      <span class="detalhe-emoji">👮</span>
      <div>
        <div class="detalhe-nome-tipo">${escapeHtml(ag.cargo || 'Agente')}</div>
        <div class="detalhe-serie">${escapeHtml(ag.nome)}</div>
      </div>
    </div>

    <div>${badgeStatusAgente(ag.status)}</div>

    <div class="detalhe-grupo">
      <div class="detalhe-grupo__titulo">Dados do agente</div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Matrícula</span><span class="detalhe-item__valor">${escapeHtml(ag.matricula || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Órgão</span><span class="detalhe-item__valor">${escapeHtml(ag.orgao || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Telefone</span><span class="detalhe-item__valor">${escapeHtml(ag.telefone || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Região</span><span class="detalhe-item__valor">${escapeHtml(ag.regiaoNome || '—')}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Última posição</span><span class="detalhe-item__valor">${formatarTempoRelativo(ag.ultimaPosicaoEm)}</span></div>
      <div class="detalhe-item"><span class="detalhe-item__rotulo">Coordenadas</span><span class="detalhe-item__valor">${ag.latitude?.toFixed(6)}, ${ag.longitude?.toFixed(6)}</span></div>
    </div>
  `;
}

// ============================================================
// MODO DEMONSTRAÇÃO
// ============================================================
function _configurarModoDemo() {
  const btnDemo = document.getElementById('btn-modo-demo');
  const painel = document.getElementById('painel-demo');

  btnDemo?.addEventListener('click', () => {
    const aberto = painel.classList.toggle('aberto');
    btnDemo.setAttribute('aria-expanded', aberto);
  });

  document.getElementById('btn-simular-furto')?.addEventListener('click', () => _simular('Furtado'));
  document.getElementById('btn-simular-falha')?.addEventListener('click', () => _simular('MauFuncionamento'));
  document.getElementById('btn-simular-offline')?.addEventListener('click', () => _simular('Offline'));

  document.getElementById('btn-restaurar-todos')?.addEventListener('click', async () => {
    try {
      const r = await resetarSimulacao();
      mostrarToast(`${r.restaurados} equipamento(s) restaurado(s).`, 'ok');
      await Promise.all([carregarResumo(), carregarEquipamentosMapa(), carregarAlertas()]);
    } catch (err) {
      mostrarToast('Erro ao restaurar simulação.', 'atencao');
    }
  });
}

async function _simular(tipo) {
  try {
    const eq = await simularFalha(tipo);
    mostrarToast(`Simulação: ${escapeHtml(eq.numeroSerie)} → ${escapeHtml(tipo)}`, 'atencao', 6000);
    // Atualiza estado local e re-renderiza marcador
    if (eq.latitude && eq.longitude) {
      estado.equipamentos.set(eq.id, eq);
      renderizarMarcadoresEquipamentos();
      centralizarEm(mapa, eq.latitude, eq.longitude, 16);
    }
    await Promise.all([carregarResumo(), carregarAlertas()]);
    // Abre drawer com detalhes
    setTimeout(() => abrirDetalheEquipamento(eq.id), 400);
  } catch (err) {
    mostrarToast(err.titulo || 'Erro na simulação.', 'critico');
  }
}

// ============================================================
// HANDLERS SIGNALR
// ============================================================
export function onEquipamentoAtualizado(dto) {
  estado.equipamentos.set(dto.id, dto);
  // Atualiza marcador individualmente
  const tiposMap = new Map(estado.tipos.map(t => [t.codigo, t]));
  const tipo = tiposMap.get(dto.tipoCodigo) || {};
  const critico = dto.situacao === 'Furtado';
  const icone = criarIconeEquipamento(tipo, dto.situacao, critico);

  if (marcadoresEq.has(dto.id)) {
    const m = marcadoresEq.get(dto.id);
    m.setIcon(icone);
    if (dto.latitude && dto.longitude) m.setLatLng([dto.latitude, dto.longitude]);
    // Pulso temporário
    const iconEl = m.getElement();
    if (iconEl) {
      iconEl.style.transition = 'transform 0.3s';
      iconEl.style.transform = 'scale(1.4)';
      setTimeout(() => { iconEl.style.transform = 'scale(1)'; }, 300);
    }
  } else {
    renderizarMarcadoresEquipamentos();
  }

  // Atualiza drawer se aberto para este equipamento
  if (estado.detalheAberto?.tipo === 'equipamento' && estado.detalheAberto?.id === dto.id) {
    abrirDetalheEquipamento(dto.id);
  }
}

export function onAgenteAtualizado(dto) {
  estado.agentes.set(dto.id, dto);
  if (marcadoresAg.has(dto.id)) {
    const m = marcadoresAg.get(dto.id);
    m.setIcon(criarIconeAgente(dto.status));
    if (dto.latitude && dto.longitude) m.setLatLng([dto.latitude, dto.longitude]);
  } else {
    renderizarMarcadoresAgentes();
  }
}

export function onAlertaCriado(dto) {
  // Adiciona no topo
  estado.alertas.unshift(dto);
  if (estado.alertas.length > 50) estado.alertas.pop();
  renderizarAlertas();
  // Toast
  const tipos = { Critico: 'critico', Atencao: 'atencao', Info: 'info' };
  mostrarToast(`🚨 Novo alerta: ${dto.titulo}`, tipos[dto.criticidade] || 'atencao', 8000);
  // Destaque visual
  setTimeout(() => {
    const card = document.querySelector(`.fogo-alerta-card[data-id="${dto.id}"]`);
    if (card) card.classList.add('novo');
  }, 100);
}

export function onAlertaAtualizado(dto) {
  const idx = estado.alertas.findIndex(a => a.id === dto.id);
  if (idx >= 0) estado.alertas[idx] = dto;
  if (dto.status !== 'Ativo') estado.alertas.splice(idx, 1);
  renderizarAlertas();
}

export function onResumoAtualizado(resumo) {
  estado.resumo = resumo;
  requestAnimationFrame(() => {
    renderizarKpis(resumo);
    renderizarPainelTipos(resumo);
    renderizarRegioes(resumo);
    renderizarGraficos(resumo);
  });
}

export function onEventoOperacional(evento) {
  const feed = document.getElementById('feed-eventos');
  if (!feed) return;

  const coresCrit = { Critico: '#EF4444', Atencao: '#F59E0B', Info: '#38BDF8' };
  const hora = evento.timestamp ? new Date(evento.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  const item = document.createElement('div');
  item.className = 'fogo-feed-item';
  item.innerHTML = `
    <span class="fogo-feed-item__dot" style="background:${coresCrit[evento.criticidade] || '#6B7280'}" aria-hidden="true"></span>
    <span class="fogo-feed-item__hora">${escapeHtml(hora)}</span>
    <span class="fogo-feed-item__msg">${escapeHtml(evento.mensagem)}</span>
  `;

  feed.insertBefore(item, feed.firstChild);

  // Limita a 30 eventos
  while (feed.children.length > FEED_MAX_EVENTOS) {
    feed.removeChild(feed.lastChild);
  }
}

// ============================================================
// FALLBACK POLLING
// ============================================================
function _iniciarFallback() {
  if (intervalFallback) return;
  intervalFallback = setInterval(() => {
    carregarResumo();
    carregarAlertas();
  }, INTERVALO_FALLBACK_MS);
}

function _pararFallback() {
  if (intervalFallback) {
    clearInterval(intervalFallback);
    intervalFallback = null;
  }
}
