// ============================================================
// PROMETHEUS F.O.G.O. – previsao.js
// 3. Inteligência Preditiva da Cidade
// ============================================================
import { exigirLogin } from './auth.js';
import { montarLayout } from './layout.js';
import { escapeHtml, mostrarToast, formatarNumero } from './ui.js';
import { criarMapa } from './map.js';
import {
  getPrevisaoRisco,
  getPrevisaoDemandaAgentes,
  getPrevisaoManutencao,
  getPrevisaoAnomalias,
  getPrevisaoRecomendacoes
} from './api.js';

// ── Inicialização ────────────────────────────────────────────
exigirLogin();
montarLayout('previsao');
iniciarPrevisao();

// ── Estado interno (instâncias reutilizáveis) ────────────────
let _mapaRisco = null;
let _circulosCamada = null;
let _graficoDemanda = null;
// Guarda referência dos círculos por regiaoId → circle Leaflet
const _circulosPorRegiao = new Map();
// Dados do risco para o select de faixas
let _dadosRisco = null;

// ── Constantes ────────────────────────────────────────────────
const COR_NIVEL = {
  Alto:  'var(--critico)',
  Medio: 'var(--atencao)',
  Baixo: 'var(--ok)'
};
const COR_NIVEL_HEX = {
  Alto:  '#EF4444',
  Medio: '#F59E0B',
  Baixo: '#22C55E'
};
const ICONE_CATEGORIA = {
  Reforco:    '👮',
  Manutencao: '🔧',
  Anomalia:   '⚠️',
  Operacao:   '🚦'
};

// ── Helpers ───────────────────────────────────────────────────
/** Calcula amanhã em formato yyyy-MM-dd (local) */
function amanha() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Formata hora local HH:mm a partir de ISO UTC */
function horaLocal(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/** Atualiza anel SVG dado valor percentual 0-100 */
function atualizarAnel(anel, pct) {
  if (!anel) return;
  const circunferencia = 201.06; // 2π × 32
  const offset = circunferencia - (Math.min(100, Math.max(0, pct)) / 100) * circunferencia;
  anel.style.strokeDashoffset = String(offset);
}

/** Mostra esqueleto genérico (linhas skeleton) num container */
function mostrarEsqueletoContainer(id, linhas = 3) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = Array.from({ length: linhas }, (_, i) =>
    `<div class="skeleton skeleton-linha" style="width:${90 - i * 10}%;margin-bottom:var(--space-2);"></div>`
  ).join('');
}

/** Mostra estado vazio num container */
function mostrarVazioContainer(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<div class="fogo-estado-vazio"><span class="icone">🔍</span><span>${escapeHtml(msg)}</span></div>`;
}

/** Mostra estado de erro num container, com botão de retry */
function mostrarErroContainer(id, msg, onRetry) {
  const el = document.getElementById(id);
  if (!el) return;
  const btnId = `retry-${id}`;
  el.innerHTML = `
    <div class="fogo-estado-erro">
      <span>⚠ ${escapeHtml(msg)}</span>
      <button id="${btnId}" class="fogo-btn fogo-btn--sm fogo-btn--secundario">Tentar novamente</button>
    </div>`;
  if (onRetry) {
    const btn = el.querySelector(`#${btnId}`);
    if (btn) btn.addEventListener('click', onRetry);
  }
}

// ── Iniciar ───────────────────────────────────────────────────
export function iniciarPrevisao() {
  // Define valor padrão do date-picker como amanhã
  const inputData = document.getElementById('prev-data');
  if (inputData) inputData.value = amanha();

  // Botão atualizar (forcar=true)
  const btnAtualizar = document.getElementById('prev-btn-atualizar');
  if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => carregarPrevisoes(true));
  }

  // Mudança de data: recarrega risco e fluxo
  if (inputData) {
    inputData.addEventListener('change', async () => {
      const data = inputData.value;
      _setEsqueletoRisco();
      _setEsqueletoFluxo();
      const [risco, fluxo] = await Promise.allSettled([
        getPrevisaoRisco({ data }),
        getPrevisaoDemandaAgentes({ data })
      ]);
      if (risco.status === 'fulfilled') renderizarRiscoMapa(risco.value);
      else mostrarErroContainer('prev-risco-lista', risco.reason?.message || 'Erro ao carregar risco.', () => inputData.dispatchEvent(new Event('change')));
      if (fluxo.status === 'fulfilled') renderizarFluxo(fluxo.value);
      else mostrarErroContainer('prev-demanda-resumo', fluxo.reason?.message || 'Erro ao carregar fluxo.', () => inputData.dispatchEvent(new Event('change')));
    });
  }

  // Select de faixas → recolore o mapa
  const selectFaixa = document.getElementById('prev-faixa-select');
  if (selectFaixa) {
    selectFaixa.addEventListener('change', () => {
      if (_dadosRisco) _aplicarFaixa(_dadosRisco, selectFaixa.value);
    });
  }

  // Botões "ℹ Como funciona"
  document.querySelectorAll('.prev-btn-info').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const bloco = document.getElementById(targetId);
      if (!bloco) return;
      const aberto = !bloco.hidden;
      bloco.hidden = aberto;
      bloco.setAttribute('aria-hidden', String(aberto));
      btn.setAttribute('aria-expanded', String(!aberto));
    });
  });

  // Carga inicial
  carregarPrevisoes(false);
}

// ── Carregar todas as previsões em paralelo ───────────────────
export async function carregarPrevisoes(forcar = false) {
  const data = document.getElementById('prev-data')?.value || amanha();
  const filtros = { data, ...(forcar ? { forcar: true } : {}) };

  // Spinner no botão atualizar
  const btnAtualizar = document.getElementById('prev-btn-atualizar');
  if (btnAtualizar) btnAtualizar.classList.add('carregando');

  // Mostrar esqueletos
  _setEsqueletoRisco();
  _setEsqueletoFluxo();
  mostrarEsqueletoContainer('prev-manutencao-lista');
  mostrarEsqueletoContainer('prev-anomalias-lista');
  mostrarEsqueletoContainer('prev-recomendacoes-lista');

  const [risco, fluxo, manutencao, anomalias, recomendacoes] = await Promise.allSettled([
    getPrevisaoRisco(filtros),
    getPrevisaoDemandaAgentes(filtros),
    getPrevisaoManutencao({ top: 20, ...(forcar ? { forcar: true } : {}) }),
    getPrevisaoAnomalias({ dias: 7, ...(forcar ? { forcar: true } : {}) }),
    getPrevisaoRecomendacoes(forcar ? { forcar: true } : {})
  ]);

  // Risco
  if (risco.status === 'fulfilled') {
    renderizarRiscoMapa(risco.value);
    renderizarKpisPrevisao({ risco: risco.value });
  } else {
    mostrarErroContainer('prev-risco-lista', risco.reason?.message || 'Erro ao carregar risco.', () => carregarPrevisoes(false));
  }

  // Fluxo / demanda
  if (fluxo.status === 'fulfilled') {
    renderizarFluxo(fluxo.value);
    renderizarKpisPrevisao({ fluxo: fluxo.value });
  } else {
    mostrarErroContainer('prev-demanda-resumo', fluxo.reason?.message || 'Erro ao carregar fluxo.', () => carregarPrevisoes(false));
  }

  // Manutenção
  if (manutencao.status === 'fulfilled') {
    renderizarManutencaoPreditiva(manutencao.value);
    renderizarKpisPrevisao({ manutencao: manutencao.value });
  } else {
    mostrarErroContainer('prev-manutencao-lista', manutencao.reason?.message || 'Erro ao carregar manutenção.', () => carregarPrevisoes(false));
  }

  // Anomalias
  if (anomalias.status === 'fulfilled') {
    renderizarAnomalias(anomalias.value);
    renderizarKpisPrevisao({ anomalias: anomalias.value });
  } else {
    mostrarErroContainer('prev-anomalias-lista', anomalias.reason?.message || 'Erro ao carregar anomalias.', () => carregarPrevisoes(false));
  }

  // Recomendações
  if (recomendacoes.status === 'fulfilled') {
    renderizarRecomendacoes(recomendacoes.value);
    renderizarKpisPrevisao({ recomendacoes: recomendacoes.value });
  } else {
    mostrarErroContainer('prev-recomendacoes-lista', recomendacoes.reason?.message || 'Erro ao carregar recomendações.', () => carregarPrevisoes(false));
  }

  // Atualiza timestamp
  const geradoEm = risco.value?.geradoEm || manutencao.value?.geradoEm;
  const geradoEl = document.getElementById('prev-gerado-em');
  if (geradoEl && geradoEm) geradoEl.textContent = `Atualizado às ${horaLocal(geradoEm)}`;

  // Remove spinner
  if (btnAtualizar) btnAtualizar.classList.remove('carregando');

  if (forcar) mostrarToast('Previsões recalculadas com sucesso.', 'ok', 4000);
}

// ── KPIs ──────────────────────────────────────────────────────
export function renderizarKpisPrevisao(dados = {}) {
  if (dados.risco) {
    const v = document.getElementById('prev-kpi-risco-alto-val');
    if (v) v.textContent = formatarNumero(dados.risco.totalAlto ?? 0);
  }
  if (dados.manutencao) {
    const pct = dados.manutencao.percentualEmRisco ?? 0;
    const v = document.getElementById('prev-kpi-equip-risco-val');
    if (v) v.textContent = `${pct.toFixed(1)}%`;
    const anel = document.getElementById('prev-kpi-equip-risco-anel');
    atualizarAnel(anel, pct);
  }
  if (dados.anomalias) {
    const v = document.getElementById('prev-kpi-anomalias-val');
    if (v) v.textContent = formatarNumero(dados.anomalias.total ?? 0);
  }
  if (dados.recomendacoes) {
    const v = document.getElementById('prev-kpi-recomendacoes-val');
    if (v) v.textContent = formatarNumero(dados.recomendacoes.total ?? 0);
  }
}

// ── Mapa de risco ─────────────────────────────────────────────
function _setEsqueletoRisco() {
  mostrarEsqueletoContainer('prev-risco-lista');
}

export function renderizarRiscoMapa(dados) {
  if (!dados) return;
  _dadosRisco = dados;
  const L = window.L;
  if (!L) return;

  // Cria o mapa se ainda não existir
  if (!_mapaRisco) {
    _mapaRisco = criarMapa('prev-risco-mapa', { zoom: 13, centro: [-22.2171, -49.9501] });
    _circulosCamada = L.layerGroup().addTo(_mapaRisco);
  } else {
    _circulosCamada.clearLayers();
  }
  _circulosPorRegiao.clear();

  // Preenche o select de faixas (apenas na primeira carga)
  const selectFaixa = document.getElementById('prev-faixa-select');
  if (selectFaixa && dados.faixas?.length > 0) {
    const options = ['<option value="pico">Pico (máximo do dia)</option>'];
    dados.faixas.forEach(f => {
      options.push(`<option value="${escapeHtml(String(f.indice))}">${escapeHtml(f.rotulo)}</option>`);
    });
    selectFaixa.innerHTML = options.join('');
  }

  // Desenha círculos por resumoRegioes (nível máximo por padrão)
  (dados.resumoRegioes || []).forEach(r => {
    if (!r.latitude || !r.longitude) return;
    const cor = COR_NIVEL_HEX[r.nivelMaximo] || '#6B7280';
    const circle = L.circle([r.latitude, r.longitude], {
      radius: 1400,
      color: cor,
      fillColor: cor,
      fillOpacity: 0.22,
      weight: 2,
      opacity: 0.8
    });

    // Popup com score e fatores
    const itemPico = (dados.itens || []).find(it => it.regiaoId === r.regiaoId && it.nivel === r.nivelMaximo);
    const fatores = itemPico?.fatores?.map(f => `<li>${escapeHtml(f)}</li>`).join('') || '';
    circle.bindPopup(`
      <div style="font-family:var(--fonte-texto);min-width:200px;">
        <strong style="font-family:var(--fonte-titulo);font-size:.9rem;letter-spacing:.06em;text-transform:uppercase;">${escapeHtml(r.regiaoNome)}</strong><br>
        <span style="color:${cor};font-weight:700;">Score máx: ${escapeHtml(String(r.scoreMaximo ?? '—'))}</span>
        &nbsp;·&nbsp;
        <span>Nível: ${escapeHtml(r.nivelMaximo || '—')}</span><br>
        <span style="font-size:.8rem;color:#93A9CC;">Faixa de pico: ${escapeHtml(r.faixaPico || '—')}</span>
        ${fatores ? `<ul style="margin:6px 0 0;padding-left:1rem;font-size:.78rem;color:#93A9CC;">${fatores}</ul>` : ''}
      </div>
    `);

    circle.addTo(_circulosCamada);
    _circulosPorRegiao.set(r.regiaoId, { circle, regiao: r });

    // Label
    const label = L.marker([r.latitude, r.longitude], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:rgba(4,10,24,.82);
          border:1px solid ${cor};
          color:${cor};
          font-family:Rajdhani,sans-serif;
          font-weight:700;
          font-size:11px;
          padding:2px 7px;
          border-radius:10px;
          white-space:nowrap;
          pointer-events:none;
        ">${escapeHtml(r.regiaoNome)} ${r.scoreMaximo ?? ''}</div>`,
        iconAnchor: [40, 12]
      }),
      interactive: false
    });
    label.addTo(_circulosCamada);
  });

  // Explicação
  renderizarExplicacao('prev-explicacao-risco', dados.explicacao);

  // Ranking top 5
  _renderizarRankingRisco(dados);
}

/** Aplica cores de uma faixa específica no mapa */
function _aplicarFaixa(dados, valorFaixa) {
  if (!dados || !_circulosPorRegiao.size) return;

  if (valorFaixa === 'pico') {
    // Volta ao scoreMaximo
    _circulosPorRegiao.forEach(({ circle, regiao }) => {
      const cor = COR_NIVEL_HEX[regiao.nivelMaximo] || '#6B7280';
      circle.setStyle({ color: cor, fillColor: cor });
    });
  } else {
    const faixaIdx = parseInt(valorFaixa, 10);
    // Agrupa itens por regiaoId e faixaIndice
    const mapaItens = new Map();
    (dados.itens || []).forEach(it => {
      if (it.faixaIndice === faixaIdx) mapaItens.set(it.regiaoId, it);
    });

    _circulosPorRegiao.forEach(({ circle, regiao }) => {
      const item = mapaItens.get(regiao.regiaoId);
      const nivel = item?.nivel || 'Baixo';
      const cor = COR_NIVEL_HEX[nivel] || '#6B7280';
      circle.setStyle({ color: cor, fillColor: cor });
    });
  }
}

/** Renderiza o ranking top 5 */
function _renderizarRankingRisco(dados) {
  const el = document.getElementById('prev-risco-lista');
  if (!el) return;
  const itens = (dados.itens || [])
    .slice()
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 5);

  if (!itens.length) {
    el.innerHTML = `<div class="fogo-estado-vazio" style="padding:var(--space-4);"><span>Sem dados de risco.</span></div>`;
    return;
  }

  el.innerHTML = itens.map((it, i) => `
    <div class="prev-risco-item" role="listitem">
      <span class="prev-risco-rank">${i + 1}</span>
      <div class="prev-risco-info">
        <span class="prev-risco-nome">${escapeHtml(it.regiaoNome)}</span>
        <span class="prev-risco-faixa">${escapeHtml(it.faixaRotulo || '')}</span>
      </div>
      <div class="prev-score-pill" style="background:${COR_NIVEL_HEX[it.nivel] || '#6B7280'}22;border-color:${COR_NIVEL_HEX[it.nivel] || '#6B7280'}55;color:${COR_NIVEL_HEX[it.nivel] || '#6B7280'};">
        ${escapeHtml(String(it.score ?? '—'))} · ${escapeHtml(it.nivel || '—')}
      </div>
    </div>
  `).join('');
}

// ── Fluxo previsto ────────────────────────────────────────────
function _setEsqueletoFluxo() {
  const wrapper = document.getElementById('prev-demanda-resumo');
  if (wrapper) wrapper.innerHTML = `<div class="skeleton skeleton-linha" style="width:80%;margin:0 auto;"></div>`;
}

export function renderizarFluxo(dados) {
  if (!dados) return;
  const canvas = document.getElementById('prev-grafico-fluxo');
  if (!canvas || !window.Chart) return;

  const horas = dados.horas || [];
  const labels = horas.map(h => `${String(h.hora).padStart(2, '0')}:00`);
  const serieHoje      = horas.map(h => h.hoje ?? null);
  const seriePrevisto  = horas.map(h => h.previsto ?? null);
  const serieSemana    = horas.map(h => h.mediaSemana ?? null);

  const corTexto   = '#5F7499';
  const corGrade   = 'rgba(56,189,248,.1)';

  const configBase = {
    responsive: true,
    maintainAspectRatio: false,
    spanGaps: false,
    plugins: {
      legend: { labels: { color: corTexto, font: { family: 'Inter', size: 11 } } },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { ticks: { color: corTexto, font: { size: 10 } }, grid: { color: corGrade } },
      y: { ticks: { color: corTexto, font: { size: 10 } }, grid: { color: corGrade }, beginAtZero: true }
    }
  };

  if (_graficoDemanda) {
    // Reutiliza instância
    _graficoDemanda.data.labels = labels;
    _graficoDemanda.data.datasets[0].data = serieHoje;
    _graficoDemanda.data.datasets[1].data = seriePrevisto;
    _graficoDemanda.data.datasets[2].data = serieSemana;
    _graficoDemanda.update();
  } else {
    _graficoDemanda = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Hoje',
            data: serieHoje,
            borderColor: '#38BDF8',
            backgroundColor: 'rgba(56,189,248,.08)',
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 3
          },
          {
            label: 'Amanhã (IA)',
            data: seriePrevisto,
            borderColor: '#22D3EE',
            backgroundColor: 'transparent',
            borderDash: [6, 4],
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 3
          },
          {
            label: 'Semana',
            data: serieSemana,
            borderColor: '#818CF8',
            backgroundColor: 'transparent',
            tension: 0.4,
            borderWidth: 1.5,
            borderDash: [3, 3],
            pointRadius: 2
          }
        ]
      },
      options: configBase
    });
  }

  // Resumo textual dos picos
  const resumo = document.getElementById('prev-demanda-resumo');
  if (resumo) {
    const picos = dados.picos || [];
    const agAtual = dados.agentesEmCampoAtual ?? '—';
    if (!picos.length) {
      resumo.innerHTML = `<p class="prev-demanda-texto">Sem picos identificados. Agentes em campo: <strong>${escapeHtml(String(agAtual))}</strong></p>`;
    } else {
      const picoHtml = picos.map(p =>
        `<span class="prev-pico-badge">🕐 ${escapeHtml(String(p.hora).padStart(2,'0'))}h — ${escapeHtml(String(p.agentesRecomendados))} agentes recomendados</span>`
      ).join('');
      resumo.innerHTML = `
        <div class="prev-demanda-texto">
          <strong>Picos previstos:</strong> ${picoHtml}
        </div>
        <div class="prev-demanda-texto" style="margin-top:var(--space-2);">
          Agentes em campo agora: <strong>${escapeHtml(String(agAtual))}</strong>
        </div>
      `;
    }
  }

  renderizarExplicacao('prev-explicacao-fluxo', dados.explicacao);
}

// ── Manutenção preditiva ──────────────────────────────────────
export function renderizarManutencaoPreditiva(dados) {
  if (!dados) return;

  // Anel de percentual
  const pct = dados.percentualEmRisco ?? 0;
  const valEl = document.getElementById('prev-manutencao-percentual');
  if (valEl) valEl.textContent = `${pct.toFixed(1)}%`;
  const anel = document.getElementById('prev-manutencao-percentual-anel');
  atualizarAnel(anel, pct);

  // Lista de itens
  const lista = document.getElementById('prev-manutencao-lista');
  if (!lista) return;

  const itens = dados.itens || [];
  if (!itens.length) {
    lista.innerHTML = `<div class="fogo-estado-vazio" style="padding:var(--space-4);"><span class="icone">✅</span><span>Nenhum equipamento em risco preditivo.</span></div>`;
  } else {
    lista.innerHTML = itens.map(it => `
      <div class="prev-manutencao-item" role="listitem">
        <div class="prev-manutencao-item-header">
          <span class="prev-manutencao-serie">${escapeHtml(it.numeroSerie || '—')}</span>
          <span class="prev-manutencao-tipo">${escapeHtml(it.tipoNome || it.tipoCodigo || '')}</span>
          <span class="prev-manutencao-marca">${escapeHtml(it.marca || '')} ${escapeHtml(it.modelo || '')}</span>
        </div>
        <div class="prev-score-barra-wrapper">
          <div class="prev-score-barra" style="width:${Math.min(100, it.score ?? 0)}%;background:${COR_NIVEL_HEX[it.nivel] || '#6B7280'};"></div>
          <span class="prev-score-valor" style="color:${COR_NIVEL_HEX[it.nivel] || '#6B7280'};">${escapeHtml(String(it.score ?? '—'))} · ${escapeHtml(it.nivel || '—')}</span>
        </div>
        ${(it.fatores || []).length ? `
          <ul class="prev-fatores-lista">
            ${it.fatores.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
          </ul>` : ''}
      </div>
    `).join('');
  }

  renderizarExplicacao('prev-explicacao-manutencao', dados.explicacao);
}

// ── Anomalias ─────────────────────────────────────────────────
export function renderizarAnomalias(dados) {
  if (!dados) return;
  const lista = document.getElementById('prev-anomalias-lista');
  if (!lista) return;

  const itens = dados.itens || [];
  if (!itens.length) {
    lista.innerHTML = `<div class="fogo-estado-vazio" style="padding:var(--space-4);"><span class="icone">✅</span><span>Nenhuma anomalia nos últimos ${escapeHtml(String(dados.dias ?? 7))} dias.</span></div>`;
  } else {
    lista.innerHTML = itens.map(it => `
      <div class="prev-anomalia-card" role="listitem">
        <div class="prev-anomalia-header">
          <span class="prev-anomalia-regiao">📍 ${escapeHtml(it.regiaoNome || '—')}</span>
          <span class="prev-anomalia-hora">${horaLocal(it.inicio)}</span>
        </div>
        <p class="prev-anomalia-msg">${escapeHtml(it.mensagem || '')}</p>
        <div class="prev-anomalia-stats">
          <span>Contagem: <strong>${escapeHtml(String(it.contagem ?? '—'))}</strong></span>
          <span>Esperado: <strong>${escapeHtml(typeof it.esperado === 'number' ? it.esperado.toFixed(1) : '—')}</strong></span>
          <span>Z: <strong>${escapeHtml(typeof it.z === 'number' ? it.z.toFixed(1) : '—')}</strong></span>
        </div>
      </div>
    `).join('');
  }

  renderizarExplicacao('prev-explicacao-anomalias', dados.explicacao);
}

// ── Recomendações ─────────────────────────────────────────────
export function renderizarRecomendacoes(dados) {
  if (!dados) return;
  const lista = document.getElementById('prev-recomendacoes-lista');
  if (!lista) return;

  const itens = dados.itens || [];
  if (!itens.length) {
    lista.innerHTML = `<div class="fogo-estado-vazio" style="padding:var(--space-4);"><span class="icone">💡</span><span>Sem recomendações no momento.</span></div>`;
  } else {
    lista.innerHTML = itens.map(it => {
      const prioridadeCor = it.prioridade === 'Alta' ? 'var(--critico)' : it.prioridade === 'Media' ? 'var(--atencao)' : 'var(--info)';
      const icone = ICONE_CATEGORIA[it.categoria] || '📌';
      const motivosHtml = (it.motivos || []).map(m => `<li>${escapeHtml(m)}</li>`).join('');
      return `
        <div class="prev-rec-card" role="listitem">
          <div class="prev-rec-header">
            <span class="prev-rec-icone" aria-hidden="true">${icone}</span>
            <span class="prev-rec-titulo">${escapeHtml(it.titulo || '')}</span>
            <span class="prev-rec-prioridade" style="border-color:${prioridadeCor};color:${prioridadeCor};">${escapeHtml(it.prioridade || '')}</span>
          </div>
          <p class="prev-rec-desc">${escapeHtml(it.descricao || '')}</p>
          ${motivosHtml ? `<ul class="prev-fatores-lista">${motivosHtml}</ul>` : ''}
        </div>
      `;
    }).join('');
  }

  renderizarExplicacao('prev-explicacao-recomendacoes', dados.explicacao);
}

// ── Explicação (ℹ Como funciona) ──────────────────────────────
export function renderizarExplicacao(idContainer, explicacao) {
  const el = document.getElementById(idContainer);
  if (!el || !explicacao) return;

  const oQuePreve = explicacao.oQuePreve || '';
  const dadosUsados = explicacao.dadosUsados || [];
  const comoAjuda = explicacao.comoAjuda || '';

  if (!oQuePreve && !dadosUsados.length && !comoAjuda) return;

  el.innerHTML = `
    <div class="prev-explicacao-corpo">
      ${oQuePreve ? `
        <div class="prev-explicacao-bloco">
          <span class="prev-explicacao-label">O que prevê</span>
          <p>${escapeHtml(oQuePreve)}</p>
        </div>` : ''}
      ${dadosUsados.length ? `
        <div class="prev-explicacao-bloco">
          <span class="prev-explicacao-label">Dados usados</span>
          <ul class="prev-explicacao-lista">
            ${dadosUsados.map(d => `<li>${escapeHtml(d)}</li>`).join('')}
          </ul>
        </div>` : ''}
      ${comoAjuda ? `
        <div class="prev-explicacao-bloco">
          <span class="prev-explicacao-label">Como ajuda a decidir</span>
          <p>${escapeHtml(comoAjuda)}</p>
        </div>` : ''}
    </div>
  `;
}
