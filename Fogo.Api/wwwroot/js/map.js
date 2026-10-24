// ============================================================
// PROMETHEUS F.O.G.O. – map.js
// Fábrica do mapa Leaflet, marcadores, cluster, heatmap, ícones
// ============================================================

import { MAPA_CENTRO, MAPA_ZOOM_INICIAL } from './config.js';

// Provedor público e 100% gratuito do OpenStreetMap (sem exigência de chave de API)
const CARTO_DARK = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

/** Cores de situação (espelhadas do contrato) */
const COR_SITUACAO = {
    Operacional: '#22C55E',
    MauFuncionamento: '#F59E0B',
    EmManutencao: '#3B82F6',
    Desativado: '#6B7280',
    Furtado: '#EF4444',
    NaoInstalado: '#94A3B8'
};

/**
 * Cria e retorna o mapa Leaflet.
 * @param {string} elementoId – ID do div do mapa
 * @param {{ zoom?: number, centro?: [number, number] }} [opcoes]
 */
export function criarMapa(elementoId, opcoes = {}) {
    const L = window.L;
    if (!L) throw new Error('Leaflet não carregado');

    const centro = opcoes.centro || MAPA_CENTRO;
    const zoom = opcoes.zoom || MAPA_ZOOM_INICIAL;

    const mapa = L.map(elementoId, {
        center: centro,
        zoom,
        zoomControl: true,
        attributionControl: true
    });

    // Tile layer – CARTO Dark Matter sem API Key
    const tileLayer = L.tileLayer(CARTO_DARK, {
        attribution: CARTO_ATTR,
        subdomains: 'abcd',
        maxZoom: 19,
        minZoom: 8
    }).addTo(mapa);

    // Aviso discreto se tiles falharem
    let avisandoTiles = false;
    tileLayer.on('tileerror', () => {
        if (avisandoTiles) return;
        avisandoTiles = true;
        const aviso = document.querySelector('.mapa-aviso-tiles');
        if (aviso) aviso.style.display = 'block';
    });

    return mapa;
}

/**
 * Cria o ícone HTML de um equipamento.
 * @param {{ icone: string, cor: string }} tipo – objeto tipo da API
 * @param {string} situacao – enum Situacao
 * @param {boolean} critico – se deve ter animação de pulso
 */
export function criarIconeEquipamento(tipo, situacao, critico = false) {
    const L = window.L;
    const cor = COR_SITUACAO[situacao] || '#6B7280';
    const icone = tipo?.icone || '📦';

    const pulsoClass = critico ? 'marcador-critico' : '';
    const anelStyle = `border: 2.5px solid ${cor}; box-shadow: 0 0 ${critico ? '14px' : '6px'} ${cor}40;`;

    return L.divIcon({
        className: '',
        html: `
      <div class="marcador-eq ${pulsoClass}" style="
        width: 32px; height: 32px;
        background: rgba(4, 10, 24, 0.88);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        ${anelStyle}
        position: relative;
      ">
        ${icone}
        ${critico ? `<div style="
          position: absolute; inset: -4px;
          border-radius: 50%;
          border: 2px solid ${cor};
          opacity: 0.5;
          animation: pulso-marcador 1.5s ease infinite;
        "></div>` : ''}
      </div>
    `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

/**
 * Cria o ícone HTML de um agente.
 * @param {string} status – enum StatusAgente
 */
export function criarIconeAgente(status) {
    const L = window.L;
    const corStatus = {
        EmAtividade: '#22C55E',
        Disponivel: '#38BDF8',
        Offline: '#6B7280'
    };
    const cor = corStatus[status] || '#6B7280';

    return L.divIcon({
        className: '',
        html: `
      <div style="
        width: 30px; height: 30px;
        background: rgba(226, 232, 240, 0.9);
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px;
        border: 2.5px solid ${cor};
        box-shadow: 0 0 8px ${cor}66;
      ">
        👮
      </div>
    `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
    });
}

/**
 * Cria a camada de cluster para equipamentos.
 * Requer Leaflet.markercluster.
 */
export function criarCamadaCluster() {
    const L = window.L;
    if (!L.MarkerClusterGroup) {
        console.warn('[map] Leaflet.markercluster não carregado – cluster desativado.');
        return L.layerGroup();
    }

    return L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 48,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
            const count = cluster.getChildCount();
            return L.divIcon({
                className: '',
                html: `
          <div style="
            width: 40px; height: 40px;
            background: rgba(10, 24, 54, 0.88);
            border: 2px solid rgba(56, 189, 248, 0.6);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 700;
            font-size: 13px;
            color: #38BDF8;
            box-shadow: 0 0 16px rgba(56, 189, 248, 0.3);
          ">${count}</div>
        `,
                iconSize: [40, 40],
                iconAnchor: [20, 20]
            });
        }
    });
}

/**
 * Cria camada de heatmap.
 * Requer Leaflet.heat.
 * @param {Array<[lat, lon, intensidade]>} pontos
 */
export function criarCamadaCalor(pontos) {
    const L = window.L;
    if (!L.heatLayer) {
        console.warn('[map] Leaflet.heat não carregado.');
        return L.layerGroup();
    }

    return L.heatLayer(pontos, {
        radius: 30,
        blur: 20,
        maxZoom: 17,
        gradient: {
            0.2: '#3B82F6',
            0.5: '#F59E0B',
            0.8: '#EF4444',
            1.0: '#FF0000'
        }
    });
}

/**
 * Centraliza o mapa em uma posição específica.
 * @param {object} mapa – instância Leaflet
 * @param {number} lat
 * @param {number} lon
 * @param {number} [zoom]
 */
export function centralizarEm(mapa, lat, lon, zoom = 16) {
    if (!mapa) return;
    mapa.flyTo([lat, lon], zoom, { duration: 0.8, easeLinearity: 0.35 });
}

/**
 * Cria círculos de região no mapa.
 * @param {object} mapa
 * @param {Array<object>} regioes – porRegiao do resumo
 */
export function renderizarCirculosRegiao(mapa, regioes) {
    const L = window.L;
    const cores = { Normal: '#22C55E', Atencao: '#F59E0B', Critico: '#EF4444' };
    const camada = L.layerGroup();

    regioes.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const cor = cores[r.nivel] || '#6B7280';

        L.circle([r.latitude, r.longitude], {
            radius: 1200,
            color: cor,
            fillColor: cor,
            fillOpacity: 0.08,
            weight: 1.5,
            opacity: 0.5
        }).addTo(camada);

        L.marker([r.latitude, r.longitude], {
            icon: L.divIcon({
                className: '',
                html: `<div style="
          background: rgba(4,10,24,0.75);
          border: 1px solid ${cor};
          color: ${cor};
          font-family: Rajdhani, sans-serif;
          font-weight: 700;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          white-space: nowrap;
        ">${r.nome} ${r.percentualDisponibilidade?.toFixed(1)}%</div>`,
                iconAnchor: [40, 12]
            })
        }).addTo(camada);
    });

    return camada;
}