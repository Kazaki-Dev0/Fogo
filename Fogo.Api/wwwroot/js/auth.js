// ============================================================
// PROMETHEUS F.O.G.O. – Auth
// ============================================================
import { CHAVE_TOKEN, CHAVE_USUARIO } from './config.js';

/**
 * Salva token e usuário vindos de LoginResposta
 * @param {{ token: string, usuario: object }} loginResposta
 */
export function salvarSessao(loginResposta) {
  localStorage.setItem(CHAVE_TOKEN, loginResposta.token);
  localStorage.setItem(CHAVE_USUARIO, JSON.stringify(loginResposta.usuario));
}

/** Retorna o JWT ou null */
export function getToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

/** Retorna o objeto usuário ou null */
export function getUsuario() {
  const raw = localStorage.getItem(CHAVE_USUARIO);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** true se há token */
export function estaLogado() {
  return !!getToken();
}

/**
 * Redireciona para login.html se não houver sessão.
 * Deve ser chamado no topo de toda página protegida.
 */
export function exigirLogin() {
  if (!estaLogado()) {
    window.location.href = '/login.html';
  }
}

/** Limpa a sessão e redireciona para login */
export function sair() {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_USUARIO);
  window.location.href = '/login.html';
}
