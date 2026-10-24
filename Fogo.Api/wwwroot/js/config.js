// ============================================================
// PROMETHEUS F.O.G.O. – Configuração global
// ============================================================

/** Define true para usar dados fictícios sem back-end */
export const USE_MOCK = false;

/** Chaves do localStorage (só token e usuário permitidos) */
export const CHAVE_TOKEN = 'fogo.token';
export const CHAVE_USUARIO = 'fogo.usuario';

/** Intervalo de polling de fallback quando SignalR cai (ms) */
export const INTERVALO_FALLBACK_MS = 15_000;

/** Debounce padrão para buscas/filtros (ms) */
export const DEBOUNCE_FILTROS_MS = 300;

/** Zoom inicial do mapa */
export const MAPA_ZOOM_INICIAL = 13;

/** Centro de Marília/SP */
export const MAPA_CENTRO = [-22.2171, -49.9501];

/** Max de eventos no feed ao vivo */
export const FEED_MAX_EVENTOS = 30;

/** Dias para painel de manutenção */
export const MANUTENCAO_DIAS = 7;

/** Tamanho padrão de página */
export const PAGINA_TAMANHO_PADRAO = 20;

/** URL do hub SignalR */
export const HUB_URL = '/hubs/operacoes';

/** Credenciais de demonstração */
export const DEMO_EMAIL = 'admin@fogo.local';
export const DEMO_SENHA = 'Fogo@2026';
