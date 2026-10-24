// ============================================================
// PROMETHEUS F.O.G.O. – ui.js
// Toast, modais, formatadores, debounce, escape, badges
// ============================================================

// ── Toast ────────────────────────────────────────────────────
const TOAST_ICONES = { info: 'ℹ️', ok: '✅', atencao: '⚠️', critico: '🚨' };

/**
 * Exibe um toast na tela
 * @param {string} mensagem
 * @param {'info'|'ok'|'atencao'|'critico'} tipo
 * @param {number} duracao ms (0 = não auto-fecha)
 */
export function mostrarToast(mensagem, tipo = 'info', duracao = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `fogo-toast fogo-toast--${tipo}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <span class="fogo-toast__icone">${TOAST_ICONES[tipo] || 'ℹ️'}</span>
    <span class="fogo-toast__mensagem">${escapeHtml(mensagem)}</span>
    <button class="fogo-toast__fechar" aria-label="Fechar notificação">×</button>
  `;

  const fechar = toast.querySelector('.fogo-toast__fechar');
  const remover = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  };
  fechar.addEventListener('click', remover);
  if (duracao > 0) setTimeout(remover, duracao);

  container.appendChild(toast);
}

// ── Modais ───────────────────────────────────────────────────
/**
 * Abre um modal pelo ID do overlay
 * @param {string} id – ID do elemento .fogo-modal-overlay
 */
export function abrirModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('aberto');
  overlay.setAttribute('aria-hidden', 'false');

  // Foco preso dentro do modal
  const modal = overlay.querySelector('.fogo-modal');
  if (modal) {
    const focaveis = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focaveis.length > 0) focaveis[0].focus();

    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];

    const armadilha = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
      } else {
        if (document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
      }
    };
    modal.__armadilha = armadilha;
    modal.addEventListener('keydown', armadilha);
  }

  // Fechar com Esc
  overlay.__escHandler = (e) => { if (e.key === 'Escape') fecharModal(id); };
  document.addEventListener('keydown', overlay.__escHandler);

  // Fechar ao clicar fora
  overlay.__clickHandler = (e) => { if (e.target === overlay) fecharModal(id); };
  overlay.addEventListener('click', overlay.__clickHandler);
}

/**
 * Fecha um modal pelo ID
 * @param {string} id
 */
export function fecharModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('aberto');
  overlay.setAttribute('aria-hidden', 'true');

  const modal = overlay.querySelector('.fogo-modal');
  if (modal?.__armadilha) {
    modal.removeEventListener('keydown', modal.__armadilha);
    delete modal.__armadilha;
  }
  if (overlay.__escHandler) {
    document.removeEventListener('keydown', overlay.__escHandler);
    delete overlay.__escHandler;
  }
  if (overlay.__clickHandler) {
    overlay.removeEventListener('click', overlay.__clickHandler);
    delete overlay.__clickHandler;
  }
}

/**
 * Exibe um diálogo de confirmação
 * @param {string} mensagem
 * @returns {Promise<boolean>}
 */
export function confirmar(mensagem) {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-confirmar');
    if (!overlay) { resolve(window.confirm(mensagem)); return; }

    const textoEl = overlay.querySelector('#confirmar-mensagem');
    if (textoEl) textoEl.textContent = mensagem;

    const btnSim = overlay.querySelector('#btn-confirmar-sim');
    const btnNao = overlay.querySelector('#btn-confirmar-nao');

    const responder = (r) => {
      fecharModal('modal-confirmar');
      btnSim.removeEventListener('click', simHandler);
      btnNao.removeEventListener('click', naoHandler);
      resolve(r);
    };

    const simHandler = () => responder(true);
    const naoHandler = () => responder(false);

    btnSim.addEventListener('click', simHandler);
    btnNao.addEventListener('click', naoHandler);

    abrirModal('modal-confirmar');
  });
}

// ── Formatadores ─────────────────────────────────────────────
/**
 * Formata data ISO para dd/MM/yyyy HH:mm
 * @param {string|null} iso
 */
export function formatarData(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

/**
 * Formata data ISO apenas como data (dd/MM/yyyy)
 * @param {string|null} iso
 */
export function formatarDataSimples(iso) {
  if (!iso) return '—';
  try {
    // Pode ser yyyy-MM-dd (sem hora)
    const d = iso.includes('T') ? new Date(iso) : new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('pt-BR');
  } catch { return iso; }
}

/**
 * Formata tempo relativo (ex.: "há 12 s", "há 3 min", "há 2 h")
 * @param {string|null} iso
 */
export function formatarTempoRelativo(iso) {
  if (!iso) return '—';
  try {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 5) return 'agora';
    if (diff < 60) return `há ${Math.floor(diff)} s`;
    if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
    return `há ${Math.floor(diff / 86400)} d`;
  } catch { return iso; }
}

/**
 * Formata número com separadores pt-BR
 * @param {number} n
 * @param {number} casas decimais (padrão 0)
 */
export function formatarNumero(n, casas = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// ── Debounce ─────────────────────────────────────────────────
/**
 * Retorna uma versão debounced da função
 * @param {Function} fn
 * @param {number} ms
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ── Escape HTML ──────────────────────────────────────────────
/** Escapa texto para uso em innerHTML – SEMPRE use para dados da API */
export function escapeHtml(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── Badges ───────────────────────────────────────────────────
const ROTULOS_SITUACAO = {
  Operacional: 'Operacional',
  MauFuncionamento: 'Mau funcionamento',
  EmManutencao: 'Em manutenção',
  Desativado: 'Desativado',
  Furtado: 'Furtado',
  NaoInstalado: 'Não instalado'
};

const ROTULOS_CRITICIDADE = {
  Critico: 'Crítico',
  Atencao: 'Atenção',
  Info: 'Info'
};

const ROTULOS_STATUS_AGENTE = {
  EmAtividade: 'Em atividade',
  Disponivel: 'Disponível',
  Offline: 'Offline'
};

/**
 * Retorna o HTML de um badge de situação de equipamento
 * @param {string} situacao
 */
export function badgeSituacao(situacao) {
  const rotulo = ROTULOS_SITUACAO[situacao] || situacao;
  return `<span class="fogo-badge fogo-badge--${escapeHtml(situacao)}"><span class="fogo-badge__dot"></span>${escapeHtml(rotulo)}</span>`;
}

/**
 * Retorna o HTML de um badge de criticidade de alerta
 * @param {string} criticidade
 */
export function badgeCriticidade(criticidade) {
  const rotulo = ROTULOS_CRITICIDADE[criticidade] || criticidade;
  return `<span class="fogo-badge fogo-badge--${escapeHtml(criticidade)}">${escapeHtml(rotulo)}</span>`;
}

/**
 * Retorna o HTML de um badge de status de agente
 * @param {string} status
 */
export function badgeStatusAgente(status) {
  const rotulo = ROTULOS_STATUS_AGENTE[status] || status;
  return `<span class="fogo-badge fogo-badge--${escapeHtml(status)}"><span class="fogo-badge__dot"></span>${escapeHtml(rotulo)}</span>`;
}

// ── Utilitários DOM ──────────────────────────────────────────
/** Define texto em um elemento de forma segura */
export function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor ?? '';
}

/** Anima a mudança de valor de um KPI (breve fade) */
export function animarKpi(id, valor) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.textContent = typeof valor === 'number' ? formatarNumero(valor) : (valor ?? '');
  el.style.animation = '';
}

/** Mostra estado de carregamento com skeleton lines numa tbody */
export function mostrarEsqueleto(tbodyId, colunas = 6, linhas = 5) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: linhas }, () => `
    <tr>${Array.from({ length: colunas }, () => `<td><span class="skeleton skeleton-linha"></span></td>`).join('')}</tr>
  `).join('');
}

/** Mostra estado vazio numa tabela */
export function mostrarVazio(tbodyId, colunas, mensagem = 'Nenhum resultado encontrado.') {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="${colunas}" style="text-align:center; padding: 48px; color: var(--texto-mudo);">${escapeHtml(mensagem)}</td></tr>`;
}

/** Mostra estado de erro numa tabela */
export function mostrarErroTabela(tbodyId, colunas, mensagem = 'Erro ao carregar dados.', onRetry) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const btnId = `retry-${tbodyId}`;
  tbody.innerHTML = `<tr><td colspan="${colunas}" style="text-align:center; padding: 48px; color: #FCA5A5;">${escapeHtml(mensagem)} <button id="${btnId}" class="fogo-btn fogo-btn--sm fogo-btn--secundario" style="margin-left: 8px;">Tentar novamente</button></td></tr>`;
  if (onRetry) {
    const btn = tbody.querySelector(`#${btnId}`);
    if (btn) btn.addEventListener('click', onRetry);
  }
}
