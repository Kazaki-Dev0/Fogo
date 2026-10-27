// ============================================================
// PROMETHEUS F.O.G.O. – login.js (Versão Corrigida)
// ============================================================

import { estaLogado, salvarSessao } from './auth.js';
import { login, registrar, getHealth } from './api.js';
import { mostrarToast, escapeHtml } from './ui.js';
import { DEMO_EMAIL, DEMO_SENHA } from './config.js';

if (estaLogado()) {
    window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', init);

function init() {
    _verificarApi();
    _configurarAbas();
    _configurarFormLogin();
    _configurarFormRegistro();
    _configurarDemo();
    _configurarToggleSenhas();
}

async function _verificarApi() {
    const el = document.getElementById('login-status-api');
    const texto = document.getElementById('login-status-texto');
    try {
        await getHealth();
        if (el) el.className = 'conectado';
        if (texto) texto.textContent = 'Servidor conectado';
    } catch {
        if (el) el.className = 'desconectado';
        if (texto) texto.textContent = 'Servidor indisponível. Verifique se o back-end está rodando';
    }
}

function _configurarAbas() {
    const tabEntrar = document.getElementById('tab-entrar');
    const tabCriar = document.getElementById('tab-criar-conta');
    const formLogin = document.getElementById('form-login');
    const formRegistro = document.getElementById('form-registro');

    tabEntrar?.addEventListener('click', () => {
        tabEntrar.classList.add('ativa');
        tabEntrar.setAttribute('aria-selected', 'true');
        tabCriar.classList.remove('ativa');
        tabCriar.setAttribute('aria-selected', 'false');
        formLogin.classList.add('ativo');
        formRegistro.classList.remove('ativo');
        document.getElementById('login-email')?.focus();
    });

    tabCriar?.addEventListener('click', () => {
        tabCriar.classList.add('ativa');
        tabCriar.setAttribute('aria-selected', 'true');
        tabEntrar.classList.remove('ativa');
        tabEntrar.setAttribute('aria-selected', 'false');
        formRegistro.classList.add('ativo');
        formLogin.classList.remove('ativo');
        document.getElementById('registro-nome')?.focus();
    });
}

function _configurarFormLogin() {
    const form = document.getElementById('form-login');
    const btn = document.getElementById('login-submit');
    const erroEl = document.getElementById('login-erro');

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        _limparErro(erroEl);

        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        if (!email || !senha) {
            _mostrarErro(erroEl, 'Preencha e-mail e senha.');
            return;
        }

        _setCarregando(btn, true);
        try {
            const resp = await login(email, senha);
            salvarSessao(resp);
            mostrarToast(`Bem-vindo, ${resp.usuario?.nome || 'Usuário'}!`, 'ok');
            setTimeout(() => { window.location.href = '/index.html'; }, 400);
        } catch (err) {
            if (err.status === 401) {
                _mostrarErro(erroEl, 'E-mail ou senha incorretos.');
            } else if (err.status === 0) {
                _mostrarErro(erroEl, 'Não foi possível falar com o servidor.');
            } else {
                _mostrarErro(erroEl, err.titulo || err.detail || 'Erro ao fazer login.');
            }
        } finally {
            _setCarregando(btn, false);
        }
    });
}

function _configurarFormRegistro() {
    const form = document.getElementById('form-registro');
    const btn = document.getElementById('registro-submit');
    const erroEl = document.getElementById('registro-erro');
    const senhaInput = document.getElementById('registro-senha');

    senhaInput?.addEventListener('input', () => {
        _atualizarForcaSenha(senhaInput.value);
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        _limparErro(erroEl);
        _limparErrosCamposRegistro();

        const nome = document.getElementById('registro-nome').value.trim();
        const email = document.getElementById('registro-email').value.trim();
        const senha = document.getElementById('registro-senha').value;
        const senha2 = document.getElementById('registro-senha2').value;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        let valido = true;
        if (!nome) {
            _mostrarCampoErro('err-reg-nome', 'Nome é obrigatório.');
            valido = false;
        }
        if (!email || !emailRegex.test(email)) {
            _mostrarCampoErro('err-reg-email', 'Informe um e-mail válido.');
            valido = false;
        }
        if (!_validarSenha(senha)) {
            _mostrarCampoErro('err-reg-senha', 'Mínimo 8 caracteres com letra e número.');
            valido = false;
        }
        if (senha !== senha2) {
            _mostrarCampoErro('err-reg-senha2', 'As senhas não coincidem.');
            valido = false;
        }
        if (!valido) return;

        _setCarregando(btn, true);
        try {
            const resp = await registrar({ nome, email, senha });
            salvarSessao(resp);
            mostrarToast('Conta criada com sucesso! Bem-vindo!', 'ok');
            setTimeout(() => { window.location.href = '/index.html'; }, 400);
        } catch (err) {
            if (err.status === 409) {
                _mostrarErro(erroEl, 'Este e-mail já está cadastrado. Tente entrar.');
            } else if (err.status === 400) {
                let msgs = '';
                if (err.errors) {
                    msgs = Object.values(err.errors).flat().join(' ');
                } else if (err.erros) {
                    msgs = Object.values(err.erros).flat().join(' ');
                }
                _mostrarErro(erroEl, msgs || err.detail || 'Dados de cadastro inválidos.');
            } else if (err.status === 0) {
                _mostrarErro(erroEl, 'Não foi possível falar com o servidor.');
            } else {
                _mostrarErro(erroEl, err.titulo || err.detail || 'Erro ao criar conta.');
            }
        } finally {
            _setCarregando(btn, false);
        }
    });
}

function _configurarDemo() {
    const btn = document.getElementById('btn-preencher-demo');
    btn?.addEventListener('click', () => {
        document.getElementById('tab-entrar')?.click();
        const emailInput = document.getElementById('login-email');
        const senhaInput = document.getElementById('login-senha');
        if (emailInput) emailInput.value = DEMO_EMAIL;
        if (senhaInput) senhaInput.value = DEMO_SENHA;
        mostrarToast('Credenciais de demonstração preenchidas!', 'info');
    });
}

function _configurarToggleSenhas() {
    document.querySelectorAll('.fogo-btn-toggle-senha').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrapper = btn.closest('.fogo-input-senha');
            const input = wrapper?.querySelector('input[type="password"], input[type="text"]');
            if (!input) return;
            const visivel = input.type === 'text';
            input.type = visivel ? 'password' : 'text';
            btn.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
        });
    });
}

function _setCarregando(btn, carregando) {
    if (!btn) return;
    btn.classList.toggle('carregando', carregando);
    btn.disabled = carregando;
}

function _mostrarErro(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visivel');
}

function _limparErro(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('visivel');
}

function _mostrarCampoErro(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('visivel');
}

function _limparErrosCamposRegistro() {
    ['err-reg-nome', 'err-reg-email', 'err-reg-senha', 'err-reg-senha2'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '';
            el.classList.remove('visivel');
        }
    });
}

function _validarSenha(senha) {
    return senha.length >= 8 && /[a-zA-Z]/.test(senha) && /[0-9]/.test(senha);
}

function _atualizarForcaSenha(senha) {
    const container = document.getElementById('registro-forca');
    if (!container) return;

    let pontos = 0;
    if (senha.length >= 8) pontos++;
    if (/[a-zA-Z]/.test(senha) && /[0-9]/.test(senha)) pontos++;
    if (senha.length >= 12 || /[^a-zA-Z0-9]/.test(senha)) pontos++;

    const classes = ['', 'forca-fraca', 'forca-media', 'forca-forte'];
    const rotulos = ['', 'Fraca', 'Média', 'Forte'];

    container.className = `fogo-forca-senha ${classes[pontos]}`;
    const texto = container.querySelector('.fogo-forca-senha__texto');
    if (texto) texto.textContent = senha.length > 0 ? rotulos[pontos] : '';
}