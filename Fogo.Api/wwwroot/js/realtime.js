// ============================================================
// PROMETHEUS F.O.G.O. – realtime.js
// Conexão SignalR e registro de handlers
// ============================================================
import { getToken } from './auth.js';
import { atualizarIndicadorRealtime } from './layout.js';
import { USE_MOCK, HUB_URL } from './config.js';

let _connection = null;

/**
 * Inicia a conexão SignalR e registra os handlers de eventos.
 * @param {{
 *   onEquipamentoAtualizado: (dto: object) => void,
 *   onAgenteAtualizado: (dto: object) => void,
 *   onAlertaCriado: (dto: object) => void,
 *   onAlertaAtualizado: (dto: object) => void,
 *   onResumoAtualizado: (resumo: object) => void,
 *   onEventoOperacional: (evento: object) => void,
 *   onEstadoConexao?: (estado: string) => void
 * }} handlers
 */
export async function iniciarTempoReal(handlers) {
  if (USE_MOCK) {
    atualizarIndicadorRealtime('offline');
    return;
  }

  // Evita múltiplas conexões
  if (_connection) await pararTempoReal();

  const signalR = window.signalR;
  if (!signalR) {
    console.warn('[realtime] SignalR não carregado – modo offline.');
    atualizarIndicadorRealtime('offline');
    return;
  }

  _connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => getToken()
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // Registra handlers dos eventos servidor → cliente (nomes exatos do contrato)
  _connection.on('EquipamentoAtualizado', (dto) => {
    handlers.onEquipamentoAtualizado?.(dto);
  });

  _connection.on('AgenteAtualizado', (dto) => {
    handlers.onAgenteAtualizado?.(dto);
  });

  _connection.on('AlertaCriado', (dto) => {
    handlers.onAlertaCriado?.(dto);
  });

  _connection.on('AlertaAtualizado', (dto) => {
    handlers.onAlertaAtualizado?.(dto);
  });

  _connection.on('ResumoAtualizado', (resumo) => {
    handlers.onResumoAtualizado?.(resumo);
  });

  _connection.on('EventoOperacional', (evento) => {
    handlers.onEventoOperacional?.(evento);
  });

  // Estado da conexão
  _connection.onreconnecting(() => {
    atualizarIndicadorRealtime('reconectando');
    handlers.onEstadoConexao?.('reconectando');
  });

  _connection.onreconnected(() => {
    atualizarIndicadorRealtime('ao-vivo');
    handlers.onEstadoConexao?.('ao-vivo');
  });

  _connection.onclose(() => {
    atualizarIndicadorRealtime('offline');
    handlers.onEstadoConexao?.('offline');
  });

  try {
    await _connection.start();
    atualizarIndicadorRealtime('ao-vivo');
    handlers.onEstadoConexao?.('ao-vivo');
  } catch (err) {
    console.error('[realtime] Falha ao conectar:', err);
    atualizarIndicadorRealtime('offline');
    handlers.onEstadoConexao?.('offline');
  }
}

/** Para a conexão SignalR se estiver ativa */
export async function pararTempoReal() {
  if (_connection) {
    try { await _connection.stop(); } catch { /* ignora */ }
    _connection = null;
  }
}

/** Retorna o estado atual da conexão */
export function getEstadoConexao() {
  if (!_connection) return 'offline';
  const estados = { 0: 'ao-vivo', 1: 'reconectando', 2: 'offline', 3: 'offline', 4: 'offline' };
  return estados[_connection.state] || 'offline';
}
