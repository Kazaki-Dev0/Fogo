// ============================================================
// PROMETHEUS F.O.G.O. – equipamentos.js
// ============================================================
import { exigirLogin } from './auth.js';
import { montarLayout } from './layout.js';
import {
  getTipos, getRegioes, getDominios, getResumo,
  getEquipamentos, getEquipamento,
  criarEquipamento, atualizarEquipamento, excluirEquipamento
} from './api.js';
import {
  mostrarToast, abrirModal, fecharModal, confirmar,
  badgeSituacao, formatarDataSimples, formatarNumero,
  escapeHtml, debounce, mostrarEsqueleto, mostrarVazio, mostrarErroTabela
} from './ui.js';
import { MAPA_CENTRO, DEBOUNCE_FILTROS_MS, PAGINA_TAMANHO_PADRAO } from './config.js';

exigirLogin();
montarLayout('equipamentos');

// ── Estado ───────────────────────────────────────────────────
const st = {
  pagina: 1,
  tamanho: PAGINA_TAMANHO_PADRAO,
  total: 0,
  filtros: { tipo: '', situacao: '', regiaoId: '', orgao: '', manutencao: '', busca: '' },
  tipos: [],
  dominios: null,
  modoEdicao: null, // null = novo, number = id do equipamento
  mapaPicker: null,
  marcadorPicker: null
};

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  [st.tipos, , st.dominios] = await Promise.all([getTipos(), getRegioes(), getDominios()]);
  await _preencherSelects();
  await _carregarGridTipos();
  _configurarFiltros();
  _configurarPaginacao();
  _configurarModal();
  _configurarMapaPicker();

  await carregarEquipamentos();

  // Abre por URL (?id=123)
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get('id');
  if (idParam) _abrirEdicao(Number(idParam));
});

// ============================================================
// LISTAGEM
// ============================================================
async function carregarEquipamentos() {
  mostrarEsqueleto('tbody-equipamentos', 8, 6);
  try {
    const resp = await getEquipamentos({ ...st.filtros, pagina: st.pagina, tamanho: st.tamanho });
    st.total = resp.total;
    _renderizarTabela(resp.itens);
    _atualizarPaginacao();
  } catch (err) {
    mostrarErroTabela('tbody-equipamentos', 8, 'Erro ao carregar equipamentos.', carregarEquipamentos);
    mostrarToast('Erro ao carregar equipamentos.', 'atencao');
  }
}

function _renderizarTabela(itens) {
  const tbody = document.getElementById('tbody-equipamentos');
  if (!tbody) return;

  if (!itens || itens.length === 0) {
    mostrarVazio('tbody-equipamentos', 8, 'Nenhum equipamento encontrado.');
    return;
  }

  const tiposMap = new Map(st.tipos.map(t => [t.codigo, t]));
  const rotulasOrgao = { Emdurb: 'EMDURB', GuardaMunicipal: 'Guarda Municipal', PoliciaMilitar: 'PM', Prefeitura: 'Prefeitura', Terceirizado: 'Terceirizado' };
  const rotulosNecManu = { Nenhuma: '—', Agendada: '📅 Agendada', Imediata: '⚠ Imediata' };

  tbody.innerHTML = itens.map(eq => {
    const tipo = tiposMap.get(eq.tipoCodigo) || {};
    return `
      <tr data-id="${eq.id}" data-tipo="${escapeHtml(eq.tipoCodigo)}" data-situacao="${escapeHtml(eq.situacao)}">
        <td>
          <span style="font-size:1.1rem;" aria-hidden="true">${escapeHtml(tipo.icone || '📦')}</span>
          <span style="font-size:0.75rem; color:var(--texto-mudo); margin-left:4px;">${escapeHtml(tipo.nome || eq.tipoCodigo)}</span>
        </td>
        <td style="font-family:var(--fonte-titulo); font-weight:700; color:var(--texto);">${escapeHtml(eq.numeroSerie)}</td>
        <td style="color:var(--texto-suave);">${escapeHtml(eq.marca || '')} ${escapeHtml(eq.modelo || '')}</td>
        <td style="color:var(--texto-mudo);">${escapeHtml(eq.bairro || '—')}</td>
        <td style="color:var(--texto-mudo);">${escapeHtml(rotulasOrgao[eq.orgao] || eq.orgao || '—')}</td>
        <td>${badgeSituacao(eq.situacao)}</td>
        <td style="font-size:0.78rem; color:var(--texto-mudo);">${escapeHtml(rotulosNecManu[eq.necessidadeManutencao] || eq.necessidadeManutencao || '—')}</td>
        <td>
          <div class="td-acoes">
            <button class="fogo-btn fogo-btn--icone btn-ver" data-id="${eq.id}" title="Ver detalhes" aria-label="Ver equipamento ${escapeHtml(eq.numeroSerie)}">🔍</button>
            <button class="fogo-btn fogo-btn--icone btn-editar" data-id="${eq.id}" title="Editar" aria-label="Editar equipamento ${escapeHtml(eq.numeroSerie)}">✏️</button>
            <button class="fogo-btn fogo-btn--icone fogo-btn--perigo btn-excluir" data-id="${eq.id}" data-serie="${escapeHtml(eq.numeroSerie)}" title="Excluir" aria-label="Excluir equipamento ${escapeHtml(eq.numeroSerie)}">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Eventos
  tbody.querySelectorAll('.btn-ver').forEach(btn =>
    btn.addEventListener('click', () => _abrirEdicao(Number(btn.dataset.id), true))
  );
  tbody.querySelectorAll('.btn-editar').forEach(btn =>
    btn.addEventListener('click', () => _abrirEdicao(Number(btn.dataset.id)))
  );
  tbody.querySelectorAll('.btn-excluir').forEach(btn =>
    btn.addEventListener('click', () => _confirmarExclusao(Number(btn.dataset.id), btn.dataset.serie))
  );
}

// ============================================================
// GRID DE TIPOS
// ============================================================
async function _carregarGridTipos() {
  const grid = document.getElementById('grid-tipos-resumo');
  if (!grid) return;
  try {
    const resumo = await getResumo();
    const porTipo = resumo.porTipo || [];

    grid.innerHTML = porTipo.map(t => `
      <div class="grid-tipo-card" role="listitem" tabindex="0" data-tipo="${escapeHtml(t.tipoCodigo)}" aria-label="${escapeHtml(t.tipoNome)}: ${t.total} equipamentos">
        <span class="grid-tipo-card__icone">${escapeHtml(t.icone)}</span>
        <span class="grid-tipo-card__nome">${escapeHtml(t.tipoNome)}</span>
        <span class="grid-tipo-card__total">${formatarNumero(t.total)}</span>
      </div>
    `).join('');

    grid.querySelectorAll('.grid-tipo-card').forEach(card => {
      const clickHandler = () => {
        const tipo = card.dataset.tipo;
        st.filtros.tipo = tipo;
        const sel = document.getElementById('eq-filtro-tipo');
        if (sel) sel.value = tipo;
        grid.querySelectorAll('.grid-tipo-card').forEach(c => c.classList.toggle('ativo', c.dataset.tipo === tipo));
        st.pagina = 1;
        carregarEquipamentos();
      };
      card.addEventListener('click', clickHandler);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickHandler(); } });
    });
  } catch { /* grid é opcional */ }
}

// ============================================================
// FILTROS E PAGINAÇÃO
// ============================================================
function _configurarFiltros() {
  const debouncedFiltrar = debounce(() => { st.pagina = 1; carregarEquipamentos(); }, DEBOUNCE_FILTROS_MS);

  const filtros = ['eq-filtro-tipo', 'eq-filtro-situacao', 'eq-filtro-regiao', 'eq-filtro-orgao', 'eq-filtro-manutencao'];
  filtros.forEach(id => {
    document.getElementById(id)?.addEventListener('change', e => {
      const chave = id.replace('eq-filtro-', '');
      if (chave === 'regiao') st.filtros.regiaoId = e.target.value;
      else st.filtros[chave] = e.target.value;
      st.pagina = 1;
      carregarEquipamentos();
    });
  });

  document.getElementById('eq-busca')?.addEventListener('input', e => {
    st.filtros.busca = e.target.value;
    debouncedFiltrar();
  });

  document.getElementById('eq-btn-limpar')?.addEventListener('click', () => {
    st.filtros = { tipo: '', situacao: '', regiaoId: '', orgao: '', manutencao: '', busca: '' };
    ['eq-filtro-tipo', 'eq-filtro-situacao', 'eq-filtro-regiao', 'eq-filtro-orgao', 'eq-filtro-manutencao'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const busca = document.getElementById('eq-busca');
    if (busca) busca.value = '';
    st.pagina = 1;
    carregarEquipamentos();
    document.querySelectorAll('.grid-tipo-card').forEach(c => c.classList.remove('ativo'));
  });
}

function _configurarPaginacao() {
  document.getElementById('eq-pagina-anterior')?.addEventListener('click', () => {
    if (st.pagina > 1) { st.pagina--; carregarEquipamentos(); }
  });
  document.getElementById('eq-pagina-proxima')?.addEventListener('click', () => {
    const maxPaginas = Math.ceil(st.total / st.tamanho);
    if (st.pagina < maxPaginas) { st.pagina++; carregarEquipamentos(); }
  });
  document.getElementById('eq-tamanho')?.addEventListener('change', e => {
    st.tamanho = Number(e.target.value);
    st.pagina = 1;
    carregarEquipamentos();
  });
}

function _atualizarPaginacao() {
  const maxPaginas = Math.ceil(st.total / st.tamanho) || 1;
  const info = document.getElementById('eq-info-pagina');
  if (info) info.textContent = `Página ${st.pagina} de ${maxPaginas} · ${formatarNumero(st.total)} equipamento${st.total !== 1 ? 's' : ''}`;
  const anterior = document.getElementById('eq-pagina-anterior');
  const proxima = document.getElementById('eq-pagina-proxima');
  if (anterior) anterior.disabled = st.pagina <= 1;
  if (proxima) proxima.disabled = st.pagina >= maxPaginas;
}

// ============================================================
// PREENCHIMENTO DE SELECTS
// ============================================================
async function _preencherSelects() {
  const regioes = await getRegioes();

  // Tipo (modal)
  const selTipoModal = document.getElementById('eq-tipo');
  st.tipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.codigo;
    opt.textContent = `${t.icone} ${t.nome}`;
    selTipoModal?.appendChild(opt);
  });

  // Filtro tipo
  const selTipoFiltro = document.getElementById('eq-filtro-tipo');
  st.tipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.codigo;
    opt.textContent = `${t.icone} ${t.nome}`;
    selTipoFiltro?.appendChild(opt);
  });

  // Situação
  st.dominios?.situacoes?.forEach(s => {
    ['eq-filtro-situacao', 'eq-situacao'].forEach(id => {
      const opt = document.createElement('option');
      opt.value = s.valor;
      opt.textContent = s.rotulo;
      document.getElementById(id)?.appendChild(opt);
    });
  });

  // Órgão
  st.dominios?.orgaos?.forEach(o => {
    ['eq-filtro-orgao', 'eq-orgao'].forEach(id => {
      const opt = document.createElement('option');
      opt.value = o.valor;
      opt.textContent = o.rotulo;
      document.getElementById(id)?.appendChild(opt);
    });
  });

  // Região
  regioes.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.nome;
    document.getElementById('eq-filtro-regiao')?.appendChild(opt);
  });

  // Necessidade manutenção
  st.dominios?.necessidadesManutencao?.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.valor;
    opt.textContent = n.rotulo;
    document.getElementById('eq-necessidade-manutencao')?.appendChild(opt);
  });
}

// ============================================================
// MODAL DE CADASTRO / EDIÇÃO
// ============================================================
function _configurarModal() {
  document.getElementById('btn-novo-equipamento')?.addEventListener('click', () => _abrirNovo());
  document.getElementById('btn-cancelar-equipamento')?.addEventListener('click', () => fecharModal('modal-equipamento'));
  document.getElementById('btn-cancelar-eq-rodape')?.addEventListener('click', () => fecharModal('modal-equipamento'));

  // Troca de tipo → campos dinâmicos + prefixo série
  document.getElementById('eq-tipo')?.addEventListener('change', (e) => {
    const tipo = st.tipos.find(t => t.codigo === e.target.value);
    _gerarCamposDinamicos(tipo);
    // Sugerir prefixo
    const serieInput = document.getElementById('eq-numero-serie');
    if (serieInput && tipo?.prefixoSerie && !serieInput.value) {
      serieInput.placeholder = `${tipo.prefixoSerie}-`;
    }
  });

  // CEP: consulta ViaCEP ao sair do campo
  document.getElementById('eq-cep')?.addEventListener('blur', _consultarViaCep);

  // Submit do form
  document.getElementById('form-equipamento')?.addEventListener('submit', _submeterForm);

  // Geocodificação
  document.getElementById('btn-geocodificar')?.addEventListener('click', _geocodificar);
}
function _atualizarTamanhoMapaPicker() {
    setTimeout(() => {
        if (!st.mapaPicker) return;
        st.mapaPicker.invalidateSize();
        if (st.marcadorPicker) {
            st.mapaPicker.setView(st.marcadorPicker.getLatLng(), st.mapaPicker.getZoom());
        } else {
            st.mapaPicker.setView(MAPA_CENTRO, 13);
        }
    }, 250);
}

// Reabilita o formulário (ele fica travado depois do modo "somente leitura")
function _habilitarForm() {
    document.querySelectorAll('#form-equipamento input, #form-equipamento select, #form-equipamento textarea')
        .forEach(el => { el.disabled = false; });
    const btnSalvar = document.getElementById('btn-salvar-equipamento');
    if (btnSalvar) btnSalvar.style.display = '';
}

function _abrirNovo() {
    st.modoEdicao = null;
    const titulo = document.getElementById('eq-modal-titulo');
    if (titulo) titulo.textContent = 'Novo equipamento';
    _habilitarForm();
    document.getElementById('form-equipamento')?.reset();
    document.getElementById('eq-campos-dinamicos').innerHTML = '';
    _limparErrosForm();
    _resetarMapaPicker();
    abrirModal('modal-equipamento');
    _atualizarTamanhoMapaPicker();
}

async function _abrirEdicao(id, soLeitura = false) {
    st.modoEdicao = id;
    const titulo = document.getElementById('eq-modal-titulo');
    if (titulo) titulo.textContent = soLeitura ? 'Detalhes do equipamento' : 'Editar equipamento';

    _habilitarForm();
    document.getElementById('form-equipamento')?.reset();
    document.getElementById('eq-campos-dinamicos').innerHTML = '';
    _limparErrosForm();
    _resetarMapaPicker();
    abrirModal('modal-equipamento');
    _atualizarTamanhoMapaPicker();

    try {
        const eq = await getEquipamento(id);
        _preencherFormulario(eq, soLeitura);
    } catch (err) {
        mostrarToast('Erro ao carregar equipamento.', 'atencao');
        fecharModal('modal-equipamento');
    }
}

function _preencherFormulario(eq, soLeitura = false) {
  const campos = ['tipoCodigo', 'numeroSerie', 'marca', 'modelo', 'cep', 'rua', 'bairro', 'cidade', 'uf', 'referencia', 'orgao', 'situacao', 'necessidadeManutencao', 'proximaManutencao'];
  const mapeamento = {
    tipoCodigo: 'eq-tipo',
    numeroSerie: 'eq-numero-serie',
    marca: 'eq-marca',
    modelo: 'eq-modelo',
    cep: 'eq-cep',
    rua: 'eq-rua',
    bairro: 'eq-bairro',
    cidade: 'eq-cidade',
    uf: 'eq-uf',
    referencia: 'eq-referencia',
    orgao: 'eq-orgao',
    situacao: 'eq-situacao',
    necessidadeManutencao: 'eq-necessidade-manutencao',
    proximaManutencao: 'eq-proxima-manutencao'
  };

  campos.forEach(campo => {
    const el = document.getElementById(mapeamento[campo]);
    if (el && eq[campo] !== undefined) el.value = eq[campo] || '';
  });

  // Lat/lon
  const latEl = document.getElementById('eq-latitude');
  const lonEl = document.getElementById('eq-longitude');
  if (latEl) latEl.value = eq.latitude || '';
  if (lonEl) lonEl.value = eq.longitude || '';

  // Campos dinâmicos
  const tipo = st.tipos.find(t => t.codigo === eq.tipoCodigo);
  _gerarCamposDinamicos(tipo, eq.caracteristicas || {});

  // Mini mapa
  if (eq.latitude && eq.longitude) {
    _moverMarcadorPicker(eq.latitude, eq.longitude);
  }

  // Readonly
  if (soLeitura) {
    document.querySelectorAll('#form-equipamento input, #form-equipamento select, #form-equipamento textarea').forEach(el => el.disabled = true);
    document.getElementById('btn-salvar-equipamento').style.display = 'none';
  }
}

function _gerarCamposDinamicos(tipo, caracteristicas = {}) {
  const container = document.getElementById('eq-campos-dinamicos');
  if (!container) return;

  if (!tipo || !tipo.camposSchema || tipo.camposSchema.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="fogo-form-secao">Características – ${escapeHtml(tipo.nome)}</div>
    <div class="fogo-form-grid">
      ${tipo.camposSchema.map(campo => _gerarCampoSchema(campo, caracteristicas)).join('')}
    </div>
  `;
}

function _gerarCampoSchema(campo, valores) {
  const id = `eq-extra-${campo.chave}`;
  const val = valores[campo.chave];

  if (campo.tipo === 'booleano') {
    return `
      <div class="fogo-field">
        <label class="fogo-label" for="${id}">${escapeHtml(campo.rotulo)}</label>
        <label class="fogo-toggle" style="margin-top:6px;">
          <input type="checkbox" id="${id}" data-chave="${campo.chave}" ${val ? 'checked' : ''} />
          <span class="fogo-toggle__slider"></span>
          <span class="fogo-toggle__label">${escapeHtml(campo.rotulo)}</span>
        </label>
      </div>
    `;
  } else if (campo.tipo === 'selecao') {
    const opts = (campo.opcoes || []).map(o => `<option value="${escapeHtml(o)}" ${val === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `
      <div class="fogo-field">
        <label class="fogo-label" for="${id}">${escapeHtml(campo.rotulo)}${campo.obrigatorio ? ' *' : ''}</label>
        <select id="${id}" class="fogo-select" data-chave="${campo.chave}" ${campo.obrigatorio ? 'required' : ''}>
          <option value="">Selecione</option>${opts}
        </select>
      </div>
    `;
  } else if (campo.tipo === 'numero') {
    return `
      <div class="fogo-field">
        <label class="fogo-label" for="${id}">${escapeHtml(campo.rotulo)}${campo.unidade ? ` (${campo.unidade})` : ''}</label>
        <input type="number" id="${id}" class="fogo-input" data-chave="${campo.chave}" step="any" value="${escapeHtml(String(val ?? ''))}" />
      </div>
    `;
  } else if (campo.tipo === 'data') {
    return `
      <div class="fogo-field">
        <label class="fogo-label" for="${id}">${escapeHtml(campo.rotulo)}</label>
        <input type="date" id="${id}" class="fogo-input" data-chave="${campo.chave}" value="${escapeHtml(String(val ?? ''))}" />
      </div>
    `;
  } else {
    return `
      <div class="fogo-field">
        <label class="fogo-label" for="${id}">${escapeHtml(campo.rotulo)}</label>
        <input type="text" id="${id}" class="fogo-input" data-chave="${campo.chave}" value="${escapeHtml(String(val ?? ''))}" />
      </div>
    `;
  }
}

// ── Submeter formulário ───────────────────────────────────────
async function _submeterForm(e) {
  e.preventDefault();
  _limparErrosForm();

  const form = document.getElementById('form-equipamento');
  const dados = _coletarDadosForm(form);

  // Validações básicas
  let valido = true;
  if (!dados.tipoCodigo) { _mostrarCampoErro('err-eq-tipo', 'Tipo obrigatório.'); valido = false; }
  if (!dados.numeroSerie) { _mostrarCampoErro('err-eq-serie', 'Número de série obrigatório.'); valido = false; }
  if (!dados.latitude || isNaN(dados.latitude)) { _mostrarCampoErro('err-eq-lat', 'Latitude inválida.'); valido = false; }
  if (!dados.longitude || isNaN(dados.longitude)) { _mostrarCampoErro('err-eq-lon', 'Longitude inválida.'); valido = false; }
  if (!valido) return;

  const btn = document.getElementById('btn-salvar-equipamento');
  btn.classList.add('carregando');
  btn.disabled = true;

  try {
    if (st.modoEdicao) {
      await atualizarEquipamento(st.modoEdicao, dados);
      mostrarToast('Equipamento atualizado com sucesso!', 'ok');
    } else {
      await criarEquipamento(dados);
      mostrarToast('Equipamento cadastrado com sucesso!', 'ok');
    }
    fecharModal('modal-equipamento');
    await carregarEquipamentos();
    await _carregarGridTipos();
  } catch (err) {
    if (err.status === 409) {
      _mostrarCampoErro('err-eq-serie', 'Número de série já cadastrado.');
    } else if (err.erros) {
      Object.entries(err.erros).forEach(([campo, msgs]) => {
        const errId = `err-eq-${campo.toLowerCase()}`;
        _mostrarCampoErro(errId, Array.isArray(msgs) ? msgs.join(' ') : msgs);
      });
      _mostrarFormErro(err.titulo || 'Erro de validação.');
    } else {
      _mostrarFormErro(err.titulo || 'Erro ao salvar equipamento.');
    }
  } finally {
    btn.classList.remove('carregando');
    btn.disabled = false;
  }
}

function _coletarDadosForm(form) {
  const fd = new FormData(form);
  const dados = {};
  for (const [k, v] of fd.entries()) {
    if (v !== '') dados[k] = v;
  }

  // Lat/lon como números
  if (dados.latitude) dados.latitude = parseFloat(dados.latitude);
  if (dados.longitude) dados.longitude = parseFloat(dados.longitude);

  // Campos dinâmicos → caracteristicas
  const caracteristicas = {};
  document.querySelectorAll('#eq-campos-dinamicos [data-chave]').forEach(el => {
    const chave = el.dataset.chave;
    if (el.type === 'checkbox') {
      caracteristicas[chave] = el.checked;
    } else if (el.type === 'number') {
      if (el.value !== '') caracteristicas[chave] = parseFloat(el.value);
    } else {
      if (el.value !== '') caracteristicas[chave] = el.value;
    }
  });
  if (Object.keys(caracteristicas).length > 0) dados.caracteristicas = caracteristicas;

  return dados;
}

// ── Exclusão ──────────────────────────────────────────────────
async function _confirmarExclusao(id, serie) {
  const ok = await confirmar(`Deseja excluir o equipamento ${serie}? Esta ação não pode ser desfeita.`);
  if (!ok) return;
  try {
    await excluirEquipamento(id);
    mostrarToast('Equipamento excluído.', 'ok');
    await carregarEquipamentos();
    await _carregarGridTipos();
  } catch {
    mostrarToast('Erro ao excluir equipamento.', 'atencao');
  }
}

// ── ViaCEP ────────────────────────────────────────────────────
async function _consultarViaCep() {
  const cepInput = document.getElementById('eq-cep');
  if (!cepInput) return;
  const cep = cepInput.value.replace(/\D/g, '');
  if (cep.length !== 8) return;

  try {
    const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await resp.json();
    if (data.erro) { mostrarToast('CEP não encontrado. Preencha o endereço manualmente.', 'atencao'); return; }
    if (data.logradouro) { const el = document.getElementById('eq-rua'); if (el) el.value = data.logradouro; }
    if (data.bairro) { const el = document.getElementById('eq-bairro'); if (el) el.value = data.bairro; }
    if (data.localidade) { const el = document.getElementById('eq-cidade'); if (el) el.value = data.localidade; }
    if (data.uf) { const el = document.getElementById('eq-uf'); if (el) el.value = data.uf; }
  } catch {
    mostrarToast('Não foi possível consultar o CEP. Preencha o endereço manualmente.', 'atencao');
  }
}

// ── Geocodificação (Nominatim) ────────────────────────────────
async function _geocodificar() {
  const rua = document.getElementById('eq-rua')?.value;
  const bairro = document.getElementById('eq-bairro')?.value;
  const cidade = document.getElementById('eq-cidade')?.value || 'Marília';

  const query = [rua, bairro, cidade, 'SP', 'Brasil'].filter(Boolean).join(', ');

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!data || data.length === 0) { mostrarToast('Endereço não encontrado. Tente ser mais específico ou use o mapa.', 'atencao'); return; }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    const latEl = document.getElementById('eq-latitude');
    const lonEl = document.getElementById('eq-longitude');
    if (latEl) latEl.value = lat.toFixed(7);
    if (lonEl) lonEl.value = lon.toFixed(7);

    _moverMarcadorPicker(lat, lon);
    mostrarToast('Coordenadas encontradas e marcadas no mapa!', 'ok');
  } catch {
    mostrarToast('Não foi possível buscar as coordenadas. Preencha manualmente.', 'atencao');
  }
}

// ── Mini mapa picker ──────────────────────────────────────────
function _configurarMapaPicker() {
  const L = window.L;
  if (!L) return;

  const el = document.getElementById('eq-mapa-picker');
  if (!el) return;

  st.mapaPicker = L.map('eq-mapa-picker', {
    center: MAPA_CENTRO,
    zoom: 13,
    zoomControl: true
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd'
  }).addTo(st.mapaPicker);

  st.mapaPicker.on('click', e => {
    const { lat, lng } = e.latlng;
    const latEl = document.getElementById('eq-latitude');
    const lonEl = document.getElementById('eq-longitude');
    if (latEl) latEl.value = lat.toFixed(7);
    if (lonEl) lonEl.value = lng.toFixed(7);
    _moverMarcadorPicker(lat, lng);
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
        html: '<div style="width:12px;height:12px;background:#22D3EE;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #22D3EE;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      })
    }).addTo(st.mapaPicker);
  }
  st.mapaPicker.invalidateSize();
  st.mapaPicker.setView([lat, lon], Math.max(st.mapaPicker.getZoom(), 15));
}

function _resetarMapaPicker() {
  if (st.marcadorPicker && st.mapaPicker) {
    st.mapaPicker.removeLayer(st.marcadorPicker);
    st.marcadorPicker = null;
  }
  st.mapaPicker?.setView(MAPA_CENTRO, 13);
}

// ── Utilitários de form ───────────────────────────────────────
function _limparErrosForm() {
  document.querySelectorAll('#form-equipamento .fogo-campo-erro').forEach(el => {
    el.textContent = '';
    el.classList.remove('visivel');
  });
  const erroGeral = document.getElementById('eq-form-erro');
  if (erroGeral) { erroGeral.textContent = ''; erroGeral.classList.remove('visivel'); }
}

function _mostrarCampoErro(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('visivel'); }
}

function _mostrarFormErro(msg) {
  const el = document.getElementById('eq-form-erro');
  if (el) { el.textContent = msg; el.classList.add('visivel'); }
}
