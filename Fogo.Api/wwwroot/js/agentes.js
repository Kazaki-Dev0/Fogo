import { exigirLogin } from './auth.js';
import { montarLayout } from './layout.js';
import {
    getTipos, getRegioes, getDominios,
    getAgentes, getAgente, criarAgente, atualizarAgente,
    excluirAgente, alterarStatusAgente
} from './api.js';
import {
    mostrarToast, abrirModal, fecharModal, confirmar,
    badgeStatusAgente, formatarTempoRelativo, formatarNumero,
    escapeHtml, debounce, mostrarEsqueleto, mostrarVazio, mostrarErroTabela
} from './ui.js';
import { MAPA_CENTRO, DEBOUNCE_FILTROS_MS } from './config.js';

exigirLogin();
montarLayout('agentes');

const st = {
    dominios: null,
    regioes: [],
    filtros: { cargo: '', status: '', regiaoId: '', busca: '' },
    modoEdicao: null,
    mapaPicker: null,
    marcadorPicker: null
};

const ROTULOS_CARGO = {
    AgenteTransito: 'Agente de trânsito',
    GuardaMunicipal: 'Guarda Municipal',
    Policial: 'Policial'
};

const ROTULOS_ORGAO = {
    Emdurb: 'EMDURB',
    GuardaMunicipal: 'Guarda Municipal',
    PoliciaMilitar: 'Polícia Militar',
    Prefeitura: 'Prefeitura',
    Terceirizado: 'Terceirizado'
};

document.addEventListener('DOMContentLoaded', async () => {
    [st.dominios, st.regioes] = await Promise.all([getDominios(), getRegioes()]);
    _preencherSelects();
    _configurarFiltros();
    _configurarModal();
    _configurarMapaPicker();
    await carregarAgentes();
    _renderizarResumo();

    const params = new URLSearchParams(window.location.search);
    const idParam = params.get('id');
    if (idParam) _abrirEdicao(Number(idParam));
});

async function carregarAgentes() {
    mostrarEsqueleto('tbody-agentes', 8, 5);

    try {
        const lista = await getAgentes({ ...st.filtros });
        _renderizarTabela(lista);
    } catch (err) {
        mostrarErroTabela('tbody-agentes', 8, 'Erro ao carregar agentes.', carregarAgentes);
        mostrarToast('Erro ao carregar agentes.', 'atencao');
    }
}

function _renderizarTabela(agentes) {
    const tbody = document.getElementById('tbody-agentes');
    if (!tbody) return;

    if (!agentes || agentes.length === 0) {
        mostrarVazio('tbody-agentes', 8, 'Nenhum agente encontrado.');
        return;
    }

    tbody.innerHTML = agentes.map(ag => `
    <tr data-id="${ag.id}">
      <td style="font-weight:600; color:var(--texto);">
        <span style="margin-right:6px;" aria-hidden="true">👮</span>${escapeHtml(ag.nome)}
      </td>
      <td style="font-family:var(--fonte-titulo); font-weight:700; color:var(--ciano);">
        ${escapeHtml(ag.matricula)}
      </td>
      <td style="color:var(--texto-suave);">
        ${escapeHtml(ROTULOS_CARGO[ag.cargo] || ag.cargo)}
      </td>
      <td style="color:var(--texto-mudo);">
        ${escapeHtml(ROTULOS_ORGAO[ag.orgao] || ag.orgao || '—')}
      </td>
      <td>${badgeStatusAgente(ag.status)}</td>
      <td style="color:var(--texto-mudo);">
        ${escapeHtml(ag.regiaoNome || '—')}
      </td>
      <td style="font-size:0.78rem; color:var(--texto-mudo);">
        ${formatarTempoRelativo(ag.ultimaPosicaoEm)}
      </td>
      <td>
        <div class="td-acoes">
          <select class="fogo-select select-status-rapido"
                  data-id="${ag.id}"
                  aria-label="Alterar status de ${escapeHtml(ag.nome)}"
                  style="padding:4px 8px; font-size:0.72rem; height:30px; min-width:110px;">
            <option value="EmAtividade"  ${ag.status === 'EmAtividade' ? 'selected' : ''}>Em atividade</option>
            <option value="Disponivel"   ${ag.status === 'Disponivel' ? 'selected' : ''}>Disponível</option>
            <option value="Offline"      ${ag.status === 'Offline' ? 'selected' : ''}>Offline</option>
          </select>
          <button class="fogo-btn fogo-btn--icone btn-editar"
                  data-id="${ag.id}"
                  title="Editar agente"
                  aria-label="Editar ${escapeHtml(ag.nome)}">✏️</button>
          <button class="fogo-btn fogo-btn--icone fogo-btn--perigo btn-excluir"
                  data-id="${ag.id}"
                  data-nome="${escapeHtml(ag.nome)}"
                  title="Excluir agente"
                  aria-label="Excluir ${escapeHtml(ag.nome)}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

    tbody.querySelectorAll('.select-status-rapido').forEach(sel => {
        sel.addEventListener('change', async (e) => {
            const id = Number(e.target.dataset.id);
            const novoStatus = e.target.value;
            const statusAnterior = e.target.querySelector('option[selected]')?.value;
            try {
                await alterarStatusAgente(id, novoStatus);
                mostrarToast('Status atualizado.', 'ok');
                const linha = e.target.closest('tr');
                const tdStatus = linha?.querySelectorAll('td')[4];
                if (tdStatus) tdStatus.innerHTML = badgeStatusAgente(novoStatus);
            } catch (err) {
                mostrarToast('Erro ao alterar status.', 'atencao');
                if (statusAnterior) e.target.value = statusAnterior;
            }
        });
    });

    tbody.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => _abrirEdicao(Number(btn.dataset.id)));
    });

    tbody.querySelectorAll('.btn-excluir').forEach(btn => {
        btn.addEventListener('click', () => _confirmarExclusao(Number(btn.dataset.id), btn.dataset.nome));
    });
}

async function _renderizarResumo() {
    const container = document.getElementById('agentes-resumo');
    if (!container) return;

    try {
        const lista = await getAgentes({});
        const emAtividade = lista.filter(a => a.status === 'EmAtividade').length;
        const disponiveis = lista.filter(a => a.status === 'Disponivel').length;
        const offline = lista.filter(a => a.status === 'Offline').length;

        container.innerHTML = [
            { label: 'Total de agentes', valor: lista.length, cor: 'var(--ciano)', icone: '👮' },
            { label: 'Em atividade', valor: emAtividade, cor: 'var(--ok)', icone: '🟢' },
            { label: 'Disponíveis', valor: disponiveis, cor: 'var(--azul)', icone: '🔵' },
            { label: 'Offline', valor: offline, cor: 'var(--mudo)', icone: '⚫' }
        ].map(c => `
      <div class="fogo-panel fogo-kpi" role="listitem">
        <span class="fogo-kpi__valor" style="color:${c.cor}; font-size:2.2rem;">${formatarNumero(c.valor)}</span>
        <span class="fogo-kpi__rotulo">${escapeHtml(c.label)}</span>
      </div>
    `).join('');
    } catch { }
}

function _configurarFiltros() {
    const debouncedFiltrar = debounce(carregarAgentes, DEBOUNCE_FILTROS_MS);

    document.getElementById('ag-filtro-cargo')?.addEventListener('change', e => {
        st.filtros.cargo = e.target.value;
        carregarAgentes();
    });

    document.getElementById('ag-filtro-status')?.addEventListener('change', e => {
        st.filtros.status = e.target.value;
        carregarAgentes();
    });

    document.getElementById('ag-filtro-regiao')?.addEventListener('change', e => {
        st.filtros.regiaoId = e.target.value;
        carregarAgentes();
    });

    document.getElementById('ag-busca')?.addEventListener('input', e => {
        st.filtros.busca = e.target.value;
        debouncedFiltrar();
    });

    document.getElementById('ag-btn-limpar')?.addEventListener('click', () => {
        st.filtros = { cargo: '', status: '', regiaoId: '', busca: '' };
        ['ag-filtro-cargo', 'ag-filtro-status', 'ag-filtro-regiao'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const busca = document.getElementById('ag-busca');
        if (busca) busca.value = '';
        carregarAgentes();
    });
}

function _preencherSelects() {
    const cargos = st.dominios?.cargos || [];
    cargos.forEach(c => {
        ['ag-cargo', 'ag-filtro-cargo'].forEach(id => {
            const opt = document.createElement('option');
            opt.value = c.valor;
            opt.textContent = c.rotulo;
            document.getElementById(id)?.appendChild(opt);
        });
    });

    const statuses = st.dominios?.statusAgente || [];
    statuses.forEach(s => {
        const optFiltro = document.createElement('option');
        optFiltro.value = s.valor;
        optFiltro.textContent = s.rotulo;
        document.getElementById('ag-filtro-status')?.appendChild(optFiltro);

        const optModal = document.createElement('option');
        optModal.value = s.valor;
        optModal.textContent = s.rotulo;
        document.getElementById('ag-status')?.appendChild(optModal);
    });

    const orgaos = st.dominios?.orgaos || [];
    orgaos.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.valor;
        opt.textContent = o.rotulo;
        document.getElementById('ag-orgao')?.appendChild(opt);
    });

    st.regioes.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = r.nome;
        document.getElementById('ag-filtro-regiao')?.appendChild(opt);
    });
}

function _configurarModal() {
    document.getElementById('btn-novo-agente')?.addEventListener('click', _abrirNovo);
    document.getElementById('ag-modal-fechar')?.addEventListener('click', () => fecharModal('modal-agente'));
    document.getElementById('btn-cancelar-agente')?.addEventListener('click', () => fecharModal('modal-agente'));

    document.getElementById('ag-telefone')?.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        if (v.length > 6) v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
        else if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        else if (v.length > 0) v = `(${v}`;
        e.target.value = v;
    });

    document.getElementById('form-agente')?.addEventListener('submit', _submeterForm);
}

function _abrirNovo() {
    st.modoEdicao = null;
    const titulo = document.getElementById('ag-modal-titulo');
    if (titulo) titulo.textContent = 'Novo agente';
    document.getElementById('form-agente')?.reset();
    _limparErrosForm();
    _resetarMapaPicker();
    abrirModal('modal-agente');

    setTimeout(() => {
        if (st.mapaPicker) {
            st.mapaPicker.invalidateSize();
        }
    }, 250);
}

async function _abrirEdicao(id) {
    st.modoEdicao = id;
    const titulo = document.getElementById('ag-modal-titulo');
    if (titulo) titulo.textContent = 'Editar agente';
    document.getElementById('form-agente')?.reset();
    _limparErrosForm();
    abrirModal('modal-agente');

    setTimeout(() => {
        if (st.mapaPicker) {
            st.mapaPicker.invalidateSize();
        }
    }, 250);

    try {
        const ag = await getAgente(id);
        _preencherFormulario(ag);
    } catch {
        mostrarToast('Erro ao carregar dados do agente.', 'atencao');
        fecharModal('modal-agente');
    }
}

function _preencherFormulario(ag) {
    const mapeamento = {
        nome: 'ag-nome',
        matricula: 'ag-matricula',
        cargo: 'ag-cargo',
        orgao: 'ag-orgao',
        telefone: 'ag-telefone',
        status: 'ag-status'
    };
    Object.entries(mapeamento).forEach(([campo, elId]) => {
        const el = document.getElementById(elId);
        if (el && ag[campo] !== undefined) el.value = ag[campo] ?? '';
    });

    const latEl = document.getElementById('ag-latitude');
    const lonEl = document.getElementById('ag-longitude');
    if (latEl) latEl.value = ag.latitude ?? '';
    if (lonEl) lonEl.value = ag.longitude ?? '';

    if (ag.latitude && ag.longitude) _moverMarcadorPicker(ag.latitude, ag.longitude);
}

async function _submeterForm(e) {
    e.preventDefault();
    _limparErrosForm();

    const dados = _coletarDados();

    let valido = true;
    if (!dados.nome?.trim()) { _mostrarCampoErro('err-ag-nome', 'Nome obrigatório.'); valido = false; }
    if (!dados.matricula?.trim()) { _mostrarCampoErro('err-ag-matricula', 'Matrícula obrigatória.'); valido = false; }
    if (!dados.cargo) { _mostrarCampoErro('err-ag-cargo', 'Cargo obrigatório.'); valido = false; }
    if (!valido) return;

    const btn = document.getElementById('btn-salvar-agente');
    btn.classList.add('carregando');
    btn.disabled = true;

    try {
        if (st.modoEdicao) {
            await atualizarAgente(st.modoEdicao, dados);
            mostrarToast('Agente atualizado com sucesso!', 'ok');
        } else {
            await criarAgente(dados);
            mostrarToast('Agente cadastrado com sucesso!', 'ok');
        }
        fecharModal('modal-agente');
        await carregarAgentes();
        await _renderizarResumo();
    } catch (err) {
        if (err.status === 409) {
            _mostrarCampoErro('err-ag-matricula', 'Matrícula já cadastrada.');
        } else if (err.erros) {
            Object.entries(err.erros).forEach(([campo, msgs]) => {
                _mostrarCampoErro(`err-ag-${campo.toLowerCase()}`, Array.isArray(msgs) ? msgs.join(' ') : msgs);
            });
            _mostrarFormErro(err.titulo || 'Erro de validação.');
        } else {
            _mostrarFormErro(err.titulo || 'Erro ao salvar agente.');
        }
    } finally {
        btn.classList.remove('carregando');
        btn.disabled = false;
    }
}

function _coletarDados() {
    const campos = ['nome', 'matricula', 'cargo', 'orgao', 'telefone', 'status'];
    const dados = {};
    campos.forEach(c => {
        const el = document.querySelector(`[name="${c}"]`);
        if (el && el.value !== '') dados[c] = el.value;
    });

    const lat = document.getElementById('ag-latitude')?.value;
    const lon = document.getElementById('ag-longitude')?.value;
    if (lat && lat !== '') dados.latitude = parseFloat(lat);
    if (lon && lon !== '') dados.longitude = parseFloat(lon);

    return dados;
}

async function _confirmarExclusao(id, nome) {
    const ok = await confirmar(`Deseja excluir o agente "${nome}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    try {
        await excluirAgente(id);
        mostrarToast('Agente excluído.', 'ok');
        await carregarAgentes();
        await _renderizarResumo();
    } catch {
        mostrarToast('Erro ao excluir agente.', 'atencao');
    }
}

function _configurarMapaPicker() {
    const L = window.L;
    if (!L) return;

    const el = document.getElementById('ag-mapa-picker');
    if (!el) return;

    st.mapaPicker = L.map('ag-mapa-picker', {
        center: MAPA_CENTRO,
        zoom: 13,
        zoomControl: true
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(st.mapaPicker);

    st.mapaPicker.on('click', e => {
        const { lat, lng } = e.latlng;
        const latEl = document.getElementById('ag-latitude');
        const lonEl = document.getElementById('ag-longitude');
        if (latEl) latEl.value = lat.toFixed(7);
        if (lonEl) lonEl.value = lng.toFixed(7);
        _moverMarcadorPicker(lat, lng);
    });

    ['ag-latitude', 'ag-longitude'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            const lat = parseFloat(document.getElementById('ag-latitude')?.value);
            const lon = parseFloat(document.getElementById('ag-longitude')?.value);
            if (!isNaN(lat) && !isNaN(lon)) _moverMarcadorPicker(lat, lon);
        });
    });
}

function _moverMarcadorPicker(lat, lon) {
    const L = window.L;
    if (!L || !st.mapaPicker) return;

    if (st.marcadorPicker) {
        st.marcadorPicker.setLatLng([lat, lon]);
    } else {
        st.marcadorPicker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: '',
                html: `<div style="
          width: 16px; height: 16px;
          background: #22D3EE;
          border-radius: 50%;
          border: 2px solid #fff;
          box-shadow: 0 0 10px #22D3EE;
          display:flex; align-items:center; justify-content:center;
          font-size:9px;">👮</div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            })
        }).addTo(st.mapaPicker);
    }
    st.mapaPicker.setView([lat, lon], Math.max(st.mapaPicker.getZoom(), 15));
}

function _resetarMapaPicker() {
    if (st.marcadorPicker && st.mapaPicker) {
        st.mapaPicker.removeLayer(st.marcadorPicker);
        st.marcadorPicker = null;
    }
    st.mapaPicker?.setView(MAPA_CENTRO, 13);
}

function _limparErrosForm() {
    document.querySelectorAll('#form-agente .fogo-campo-erro').forEach(el => {
        el.textContent = '';
        el.classList.remove('visivel');
    });
    const erroGeral = document.getElementById('ag-form-erro');
    if (erroGeral) {
        erroGeral.textContent = '';
        erroGeral.classList.remove('visivel');
    }
}

function _mostrarCampoErro(id, msg) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.classList.add('visivel');
    }
}

function _mostrarFormErro(msg) {
    const el = document.getElementById('ag-form-erro');
    if (el) {
        el.textContent = msg;
        el.classList.add('visivel');
    }
}