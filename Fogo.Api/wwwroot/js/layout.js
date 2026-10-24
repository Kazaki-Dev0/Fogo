// ============================================================
// PROMETHEUS F.O.G.O. – layout.js
// Monta header/nav compartilhado e indicador de tempo real
// ============================================================
import { getUsuario, sair } from './auth.js';
import { escapeHtml } from './ui.js';

/**
 * Injeta o header e o container de toasts em qualquer página protegida.
 * Deve ser chamado antes de qualquer outra lógica de página.
 * @param {'centro'|'equipamentos'|'agentes'|'previsao'} paginaAtual
 */
export function montarLayout(paginaAtual) {
  // Injeta estrutura mínima se não existir
  _garantirToastContainer();
  _garantirModalConfirmar();
  _montarHeader(paginaAtual);
  _iniciarRelogio();
}

// ── Header ───────────────────────────────────────────────────
function _montarHeader(paginaAtual) {
  const header = document.getElementById('app-header');
  if (!header) return;

  const usuario = getUsuario();
  const nome = usuario?.nome || 'Usuário';
  const perfil = usuario?.perfil || '';

  const links = [
    { id: 'nav-centro',        href: '/index.html',        icone: '🗺️',  label: 'Centro de Operações', chave: 'centro' },
    { id: 'nav-equipamentos',  href: '/equipamentos.html', icone: '📦',  label: 'Inventário',          chave: 'equipamentos' },
    { id: 'nav-agentes',       href: '/agentes.html',      icone: '👮',  label: 'Agentes',             chave: 'agentes' },
    { id: 'nav-previsao',      href: '/previsao.html',     icone: '🧠',  label: 'Inteligência',        chave: 'previsao' }
  ];

  header.innerHTML = `
    <a href="/index.html" id="brand" style="text-decoration:none;" aria-label="PROMETHEUS F.O.G.O. – Início">
      <span class="brand-prometheus">PROMETHEUS</span>
      <span class="brand-fogo">F.O.G.O.</span>
      <span class="brand-cidade">Marília / SP</span>
    </a>

    <nav id="nav-principal" aria-label="Navegação principal">
      ${links.map(l => `
        <a id="${escapeHtml(l.id)}"
           href="${escapeHtml(l.href)}"
           ${paginaAtual === l.chave ? 'aria-current="page"' : ''}
        >
          <span aria-hidden="true">${l.icone}</span>
          <span>${escapeHtml(l.label)}</span>
        </a>
      `).join('')}
    </nav>

    <time id="relogio" aria-label="Hora atual" datetime=""></time>

    <div id="realtime-indicator" class="rt-offline" title="Estado da conexão em tempo real">
      <span class="rt-dot" aria-hidden="true"></span>
      <span class="rt-label">Offline</span>
    </div>

    <div class="header-user">
      <div id="user-nome" aria-label="Usuário logado">
        <span class="user-name">${escapeHtml(nome)}</span>
        <span class="user-perfil">${escapeHtml(perfil)}</span>
      </div>
      <button id="btn-logout" aria-label="Sair do sistema">
        <span aria-hidden="true">⎋</span> Sair
      </button>
    </div>
  `;

  document.getElementById('btn-logout')?.addEventListener('click', () => sair());
}

// ── Relógio ──────────────────────────────────────────────────
function _iniciarRelogio() {
  const el = document.getElementById('relogio');
  if (!el) return;

  function atualizar() {
    const agora = new Date();
    const str = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.textContent = str;
    el.setAttribute('datetime', agora.toISOString());
  }
  atualizar();
  setInterval(atualizar, 1000);
}

// ── Indicador de tempo real ──────────────────────────────────
/**
 * Atualiza o indicador de estado da conexão SignalR
 * @param {'ao-vivo'|'reconectando'|'offline'} estado
 */
export function atualizarIndicadorRealtime(estado) {
  const el = document.getElementById('realtime-indicator');
  if (!el) return;

  el.className = `rt-${estado}`;
  const label = el.querySelector('.rt-label');

  const estados = {
    'ao-vivo': { texto: 'Ao vivo', title: 'Conectado ao servidor em tempo real' },
    'reconectando': { texto: 'Reconectando…', title: 'Tentando reconectar ao servidor…' },
    'offline': { texto: 'Offline', title: 'Sem conexão com o servidor em tempo real' }
  };

  const cfg = estados[estado] || estados['offline'];
  if (label) label.textContent = cfg.texto;
  el.setAttribute('title', cfg.title);
}

// ── Toast container ──────────────────────────────────────────
function _garantirToastContainer() {
  if (!document.getElementById('toast-container')) {
    const div = document.createElement('div');
    div.id = 'toast-container';
    div.setAttribute('aria-live', 'polite');
    div.setAttribute('aria-atomic', 'false');
    document.body.appendChild(div);
  }
}

// ── Modal de confirmação global ──────────────────────────────
function _garantirModalConfirmar() {
  if (document.getElementById('modal-confirmar')) return;

  const overlay = document.createElement('div');
  overlay.id = 'modal-confirmar';
  overlay.className = 'fogo-modal-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'confirmar-titulo');

  overlay.innerHTML = `
    <div class="fogo-modal fogo-modal--sm">
      <div class="fogo-modal__header">
        <h2 class="fogo-modal__titulo" id="confirmar-titulo">Confirmação</h2>
      </div>
      <div class="fogo-modal__body">
        <p id="confirmar-mensagem" style="color: var(--texto-suave); margin-bottom: 0;"></p>
      </div>
      <div class="fogo-modal__rodape">
        <button id="btn-confirmar-nao" class="fogo-btn fogo-btn--fantasma">Cancelar</button>
        <button id="btn-confirmar-sim" class="fogo-btn fogo-btn--perigo">Confirmar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}
