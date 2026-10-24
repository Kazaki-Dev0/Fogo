// ============================================================
// PROMETHEUS F.O.G.O. – Mock Data
// Usado apenas quando USE_MOCK = true em config.js
// ============================================================

export const MOCK_TIPOS = [
  { codigo: 'radar', nome: 'Radar de trânsito', prefixoSerie: 'RAD', icone: '📡', cor: '#38BDF8', movel: false, camposSchema: [
    { chave: 'tipoFiscalizacao', rotulo: 'Tipo de fiscalização', tipo: 'selecao', opcoes: ['Velocidade', 'Semaforo', 'ConversaoProibida', 'RetornoProibido', 'FaixaExclusiva'], obrigatorio: true },
    { chave: 'velocidadeMaximaKmh', rotulo: 'Velocidade máxima (km/h)', tipo: 'numero', unidade: 'km/h' },
    { chave: 'faixasMonitoradas', rotulo: 'Faixas monitoradas', tipo: 'numero' },
    { chave: 'aferidoAte', rotulo: 'Aferido até', tipo: 'data' }
  ]},
  { codigo: 'camera', nome: 'Câmera de videomonitoramento', prefixoSerie: 'CAM', icone: '📹', cor: '#22D3EE', movel: false, camposSchema: [
    { chave: 'visaoNoturna', rotulo: 'Visão noturna', tipo: 'booleano' },
    { chave: 'resolucao', rotulo: 'Resolução', tipo: 'selecao', opcoes: ['HD', 'FullHD', '2K', '4K'] },
    { chave: 'colorida', rotulo: 'Colorida', tipo: 'booleano' },
    { chave: 'conectividade', rotulo: 'Conectividade', tipo: 'selecao', opcoes: ['Fibra', '4G', '5G', 'Radio'] },
    { chave: 'ptz', rotulo: 'PTZ', tipo: 'booleano' }
  ]},
  { codigo: 'balanca', nome: 'Balança de caminhão', prefixoSerie: 'BAL', icone: '⚖️', cor: '#A78BFA', movel: false, camposSchema: [
    { chave: 'capacidadeToneladas', rotulo: 'Capacidade (ton)', tipo: 'numero', unidade: 'ton' },
    { chave: 'tipoBalanca', rotulo: 'Tipo', tipo: 'selecao', opcoes: ['Estatica', 'Dinamica'] }
  ]},
  { codigo: 'veiculo_fiscalizacao', nome: 'Veículo autônomo de fiscalização', prefixoSerie: 'FIS', icone: '🚙', cor: '#60A5FA', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'autonomo', rotulo: 'Autônomo', tipo: 'booleano' },
    { chave: 'autonomiaKm', rotulo: 'Autonomia (km)', tipo: 'numero', unidade: 'km' }
  ]},
  { codigo: 'cancela', nome: 'Cancela / portão automatizado', prefixoSerie: 'CAN', icone: '🚧', cor: '#FBBF24', movel: false, camposSchema: [
    { chave: 'tipoAcesso', rotulo: 'Tipo de acesso', tipo: 'selecao', opcoes: ['Veicular', 'Pedestre'] },
    { chave: 'leituraPlaca', rotulo: 'Leitura de placa', tipo: 'booleano' }
  ]},
  { codigo: 'taxi', nome: 'Táxi', prefixoSerie: 'TAX', icone: '🚕', cor: '#FACC15', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'alvara', rotulo: 'Alvará', tipo: 'texto' },
    { chave: 'acessivel', rotulo: 'Acessível', tipo: 'booleano' }
  ]},
  { codigo: 'mototaxi', nome: 'Mototáxi', prefixoSerie: 'MOT', icone: '🛵', cor: '#FB923C', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'alvara', rotulo: 'Alvará', tipo: 'texto' }
  ]},
  { codigo: 'escolar', nome: 'Transporte escolar', prefixoSerie: 'ESC', icone: '🚌', cor: '#F59E0B', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'capacidadePassageiros', rotulo: 'Capacidade', tipo: 'numero', unidade: 'passageiros' },
    { chave: 'escolaRota', rotulo: 'Escola/Rota', tipo: 'texto' }
  ]},
  { codigo: 'totem', nome: 'Totem de estacionamento rotativo', prefixoSerie: 'TOT', icone: '🅿️', cor: '#2DD4BF', movel: false, camposSchema: [
    { chave: 'vagasAtendidas', rotulo: 'Vagas atendidas', tipo: 'numero' },
    { chave: 'pagamento', rotulo: 'Pagamento', tipo: 'selecao', opcoes: ['Cartao', 'Pix', 'Ambos'] },
    { chave: 'tarifaHora', rotulo: 'Tarifa/hora', tipo: 'numero', unidade: 'R$' }
  ]},
  { codigo: 'patinete', nome: 'Patinete elétrico compartilhado', prefixoSerie: 'PAT', icone: '🛴', cor: '#4ADE80', movel: true, camposSchema: [
    { chave: 'bateriaPercentual', rotulo: 'Bateria', tipo: 'numero', unidade: '%' },
    { chave: 'operadora', rotulo: 'Operadora', tipo: 'texto' }
  ]},
  { codigo: 'moto_agente', nome: 'Moto de agente de trânsito', prefixoSerie: 'MAG', icone: '🏍️', cor: '#818CF8', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'cilindradas', rotulo: 'Cilindradas', tipo: 'numero', unidade: 'cc' }
  ]},
  { codigo: 'viatura_gm', nome: 'Viatura da Guarda Municipal', prefixoSerie: 'GCM', icone: '🚔', cor: '#3B82F6', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'prefixoViatura', rotulo: 'Prefixo da viatura', tipo: 'texto' }
  ]},
  { codigo: 'viatura_pm', nome: 'Viatura da Polícia Militar', prefixoSerie: 'VPM', icone: '🚓', cor: '#6366F1', movel: true, camposSchema: [
    { chave: 'placa', rotulo: 'Placa', tipo: 'texto' },
    { chave: 'prefixoViatura', rotulo: 'Prefixo da viatura', tipo: 'texto' }
  ]}
];

export const MOCK_REGIOES = [
  { id: 1, codigo: 'centro', nome: 'Centro', latitude: -22.2171, longitude: -49.9501 },
  { id: 2, codigo: 'norte', nome: 'Norte', latitude: -22.1900, longitude: -49.9450 },
  { id: 3, codigo: 'sul', nome: 'Sul', latitude: -22.2400, longitude: -49.9530 },
  { id: 4, codigo: 'leste', nome: 'Leste', latitude: -22.2200, longitude: -49.9200 },
  { id: 5, codigo: 'oeste', nome: 'Oeste', latitude: -22.2150, longitude: -49.9750 }
];

export const MOCK_DOMINIOS = {
  situacoes: [
    { valor: 'Operacional', rotulo: 'Operacional', cor: '#22C55E' },
    { valor: 'MauFuncionamento', rotulo: 'Mau funcionamento', cor: '#F59E0B' },
    { valor: 'EmManutencao', rotulo: 'Em manutenção', cor: '#3B82F6' },
    { valor: 'Desativado', rotulo: 'Desativado', cor: '#6B7280' },
    { valor: 'Furtado', rotulo: 'Furtado', cor: '#EF4444' },
    { valor: 'NaoInstalado', rotulo: 'Não instalado', cor: '#94A3B8' }
  ],
  orgaos: [
    { valor: 'Emdurb', rotulo: 'EMDURB' },
    { valor: 'GuardaMunicipal', rotulo: 'Guarda Municipal' },
    { valor: 'PoliciaMilitar', rotulo: 'Polícia Militar' },
    { valor: 'Prefeitura', rotulo: 'Prefeitura' },
    { valor: 'Terceirizado', rotulo: 'Terceirizado' }
  ],
  cargos: [
    { valor: 'AgenteTransito', rotulo: 'Agente de trânsito' },
    { valor: 'GuardaMunicipal', rotulo: 'Guarda Municipal' },
    { valor: 'Policial', rotulo: 'Policial' }
  ],
  statusAgente: [
    { valor: 'EmAtividade', rotulo: 'Em atividade' },
    { valor: 'Disponivel', rotulo: 'Disponível' },
    { valor: 'Offline', rotulo: 'Offline' }
  ],
  criticidades: [
    { valor: 'Critico', rotulo: 'Crítico', cor: '#EF4444' },
    { valor: 'Atencao', rotulo: 'Atenção', cor: '#F59E0B' },
    { valor: 'Info', rotulo: 'Info', cor: '#38BDF8' }
  ],
  necessidadesManutencao: [
    { valor: 'Nenhuma', rotulo: 'Nenhuma' },
    { valor: 'Agendada', rotulo: 'Agendada' },
    { valor: 'Imediata', rotulo: 'Imediata' }
  ],
  bairros: ['Centro', 'Fragata', 'Palmital', 'Borebi', 'Vila Barros', 'Jardim Bélgica']
};

export const MOCK_EQUIPAMENTOS_MAPA = [
  { id: 1, tipoCodigo: 'camera', tipoNome: 'Câmera de videomonitoramento', numeroSerie: 'CAM-1093', marca: 'Hikvision', modelo: 'DS-2CD2746G2', latitude: -22.2139, longitude: -49.9458, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: '2026-12-01', regiaoId: 1, bairro: 'Centro', orgao: 'Emdurb', ultimoHeartbeat: new Date().toISOString() },
  { id: 2, tipoCodigo: 'radar', tipoNome: 'Radar de trânsito', numeroSerie: 'RAD-7842', marca: 'Perkons', modelo: 'PDR-85E', latitude: -22.2190, longitude: -49.9550, situacao: 'MauFuncionamento', necessidadeManutencao: 'Imediata', proximaManutencao: '2026-10-26', regiaoId: 1, bairro: 'Centro', orgao: 'Emdurb', ultimoHeartbeat: new Date(Date.now() - 600000).toISOString() },
  { id: 3, tipoCodigo: 'totem', tipoNome: 'Totem de estacionamento rotativo', numeroSerie: 'TOT-1180', marca: 'Parkeon', modelo: 'Strada', latitude: -22.2171, longitude: -49.9501, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 1, bairro: 'Centro', orgao: 'Emdurb', ultimoHeartbeat: new Date().toISOString() },
  { id: 4, tipoCodigo: 'viatura_gm', tipoNome: 'Viatura da Guarda Municipal', numeroSerie: 'GCM-7712', marca: 'Fiat', modelo: 'Argo', latitude: -22.2100, longitude: -49.9400, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 2, bairro: 'Fragata', orgao: 'GuardaMunicipal', ultimoHeartbeat: new Date().toISOString() },
  { id: 5, tipoCodigo: 'camera', tipoNome: 'Câmera de videomonitoramento', numeroSerie: 'CAM-2041', marca: 'Intelbras', modelo: 'VHD 3230 D', latitude: -22.2250, longitude: -49.9480, situacao: 'Furtado', necessidadeManutencao: 'Imediata', proximaManutencao: null, regiaoId: 3, bairro: 'Palmital', orgao: 'Emdurb', ultimoHeartbeat: new Date(Date.now() - 3600000).toISOString() },
  { id: 6, tipoCodigo: 'taxi', tipoNome: 'Táxi', numeroSerie: 'TAX-9087', marca: 'VW', modelo: 'Polo', latitude: -22.2200, longitude: -49.9600, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 1, bairro: 'Centro', orgao: 'Prefeitura', ultimoHeartbeat: new Date().toISOString() },
  { id: 7, tipoCodigo: 'escolar', tipoNome: 'Transporte escolar', numeroSerie: 'ESC-2201', marca: 'Mercedes-Benz', modelo: 'OF-1724', latitude: -22.2300, longitude: -49.9700, situacao: 'EmManutencao', necessidadeManutencao: 'Agendada', proximaManutencao: '2026-10-28', regiaoId: 5, bairro: 'Borebi', orgao: 'Prefeitura', ultimoHeartbeat: new Date(Date.now() - 86400000).toISOString() },
  { id: 8, tipoCodigo: 'patinete', tipoNome: 'Patinete elétrico compartilhado', numeroSerie: 'PAT-4478', marca: 'Xiaomi', modelo: 'Mi Electric', latitude: -22.2160, longitude: -49.9520, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 1, bairro: 'Centro', orgao: 'Terceirizado', ultimoHeartbeat: new Date().toISOString() },
  { id: 9, tipoCodigo: 'moto_agente', tipoNome: 'Moto de agente de trânsito', numeroSerie: 'MAG-9321', marca: 'Honda', modelo: 'CG 160', latitude: -22.2130, longitude: -49.9470, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 1, bairro: 'Centro', orgao: 'Emdurb', ultimoHeartbeat: new Date().toISOString() },
  { id: 10, tipoCodigo: 'viatura_pm', tipoNome: 'Viatura da Polícia Militar', numeroSerie: 'VPM-3390', marca: 'Chevrolet', modelo: 'S10', latitude: -22.1950, longitude: -49.9480, situacao: 'Operacional', necessidadeManutencao: 'Nenhuma', proximaManutencao: null, regiaoId: 2, bairro: 'Fragata', orgao: 'PoliciaMilitar', ultimoHeartbeat: new Date().toISOString() }
];

export const MOCK_AGENTES = [
  { id: 1, nome: 'Carlos Souza', matricula: 'AGT-0156', cargo: 'AgenteTransito', orgao: 'Emdurb', telefone: '(14) 99999-0001', status: 'EmAtividade', latitude: -22.2171, longitude: -49.9501, ultimaPosicaoEm: new Date().toISOString(), regiaoId: 1, regiaoNome: 'Centro', equipamentoVinculadoId: null },
  { id: 2, nome: 'Ana Lima', matricula: 'AGT-0201', cargo: 'GuardaMunicipal', orgao: 'GuardaMunicipal', telefone: '(14) 99999-0002', status: 'EmAtividade', latitude: -22.2100, longitude: -49.9400, ultimaPosicaoEm: new Date().toISOString(), regiaoId: 2, regiaoNome: 'Norte', equipamentoVinculadoId: null },
  { id: 3, nome: 'Roberto Silva', matricula: 'AGT-0089', cargo: 'Policial', orgao: 'PoliciaMilitar', telefone: '(14) 99999-0003', status: 'Disponivel', latitude: -22.2250, longitude: -49.9600, ultimaPosicaoEm: new Date().toISOString(), regiaoId: 3, regiaoNome: 'Sul', equipamentoVinculadoId: null },
  { id: 4, nome: 'Fernanda Costa', matricula: 'AGT-0312', cargo: 'AgenteTransito', orgao: 'Emdurb', telefone: '(14) 99999-0004', status: 'Offline', latitude: -22.2200, longitude: -49.9300, ultimaPosicaoEm: new Date(Date.now() - 3600000).toISOString(), regiaoId: 4, regiaoNome: 'Leste', equipamentoVinculadoId: null },
  { id: 5, nome: 'Marcos Oliveira', matricula: 'AGT-0445', cargo: 'GuardaMunicipal', orgao: 'GuardaMunicipal', telefone: '(14) 99999-0005', status: 'EmAtividade', latitude: -22.2150, longitude: -49.9750, ultimaPosicaoEm: new Date().toISOString(), regiaoId: 5, regiaoNome: 'Oeste', equipamentoVinculadoId: null }
];

export const MOCK_ALERTAS = [
  { id: 1, tipo: 'MauFuncionamento', criticidade: 'Critico', titulo: 'Radar RAD-7842 com mau funcionamento', descricao: 'Sem leituras válidas nos últimos 10 minutos.', status: 'Ativo', equipamentoId: 2, equipamentoSerie: 'RAD-7842', agenteId: null, regiaoId: 1, regiaoNome: 'Centro', latitude: -22.2190, longitude: -49.9550, criadoEm: new Date(Date.now() - 600000).toISOString(), reconhecidoEm: null, resolvidoEm: null },
  { id: 2, tipo: 'Furtado', criticidade: 'Critico', titulo: 'Câmera CAM-2041 possivelmente furtada', descricao: 'Sem heartbeat há mais de 1 hora. Posição inválida.', status: 'Ativo', equipamentoId: 5, equipamentoSerie: 'CAM-2041', agenteId: null, regiaoId: 3, regiaoNome: 'Sul', latitude: -22.2250, longitude: -49.9480, criadoEm: new Date(Date.now() - 3600000).toISOString(), reconhecidoEm: null, resolvidoEm: null },
  { id: 3, tipo: 'ManutencaoProxima', criticidade: 'Atencao', titulo: 'Transporte escolar ESC-2201 manutenção agendada', descricao: 'Manutenção vence em 4 dias.', status: 'Ativo', equipamentoId: 7, equipamentoSerie: 'ESC-2201', agenteId: null, regiaoId: 5, regiaoNome: 'Oeste', latitude: -22.2300, longitude: -49.9700, criadoEm: new Date(Date.now() - 86400000).toISOString(), reconhecidoEm: null, resolvidoEm: null }
];

export const MOCK_RESUMO = {
  geradoEm: new Date().toISOString(),
  totalEquipamentos: 10,
  naoInstalados: 0,
  operacionais: 7,
  indisponiveis: 3,
  percentualDisponibilidade: 70.0,
  manutencaoImediata: 2,
  manutencaoProxima: 1,
  totalAgentes: 5,
  agentesEmCampo: 3,
  alertasAtivos: 3,
  alertasCriticos: 2,
  ocorrenciasHoje: 8,
  porTipo: [
    { tipoCodigo: 'camera', tipoNome: 'Câmera de videomonitoramento', icone: '📹', cor: '#22D3EE', total: 2, operacionais: 1, indisponiveis: 1 },
    { tipoCodigo: 'radar', tipoNome: 'Radar de trânsito', icone: '📡', cor: '#38BDF8', total: 1, operacionais: 0, indisponiveis: 1 },
    { tipoCodigo: 'totem', tipoNome: 'Totem de estacionamento', icone: '🅿️', cor: '#2DD4BF', total: 1, operacionais: 1, indisponiveis: 0 },
    { tipoCodigo: 'viatura_gm', tipoNome: 'Viatura GCM', icone: '🚔', cor: '#3B82F6', total: 1, operacionais: 1, indisponiveis: 0 },
    { tipoCodigo: 'taxi', tipoNome: 'Táxi', icone: '🚕', cor: '#FACC15', total: 1, operacionais: 1, indisponiveis: 0 },
    { tipoCodigo: 'escolar', tipoNome: 'Transporte escolar', icone: '🚌', cor: '#F59E0B', total: 1, operacionais: 0, indisponiveis: 1 },
    { tipoCodigo: 'patinete', tipoNome: 'Patinete', icone: '🛴', cor: '#4ADE80', total: 1, operacionais: 1, indisponiveis: 0 },
    { tipoCodigo: 'moto_agente', tipoNome: 'Moto agente', icone: '🏍️', cor: '#818CF8', total: 1, operacionais: 1, indisponiveis: 0 },
    { tipoCodigo: 'viatura_pm', tipoNome: 'Viatura PM', icone: '🚓', cor: '#6366F1', total: 1, operacionais: 1, indisponiveis: 0 }
  ],
  porSituacao: [
    { situacao: 'Operacional', total: 7 },
    { situacao: 'MauFuncionamento', total: 1 },
    { situacao: 'EmManutencao', total: 1 },
    { situacao: 'Furtado', total: 1 }
  ],
  porRegiao: [
    { regiaoId: 1, nome: 'Centro', latitude: -22.2171, longitude: -49.9501, total: 5, operacionais: 4, percentualDisponibilidade: 80.0, alertasAtivos: 1, alertasCriticos: 1, nivel: 'Atencao' },
    { regiaoId: 2, nome: 'Norte', latitude: -22.1900, longitude: -49.9450, total: 2, operacionais: 2, percentualDisponibilidade: 100.0, alertasAtivos: 0, alertasCriticos: 0, nivel: 'Normal' },
    { regiaoId: 3, nome: 'Sul', latitude: -22.2400, longitude: -49.9530, total: 1, operacionais: 0, percentualDisponibilidade: 0.0, alertasAtivos: 1, alertasCriticos: 1, nivel: 'Critico' },
    { regiaoId: 4, nome: 'Leste', latitude: -22.2200, longitude: -49.9200, total: 0, operacionais: 0, percentualDisponibilidade: 0.0, alertasAtivos: 0, alertasCriticos: 0, nivel: 'Normal' },
    { regiaoId: 5, nome: 'Oeste', latitude: -22.2150, longitude: -49.9750, total: 1, operacionais: 0, percentualDisponibilidade: 0.0, alertasAtivos: 1, alertasCriticos: 0, nivel: 'Atencao' }
  ]
};

export const MOCK_MANUTENCOES = [
  { equipamentoId: 2, numeroSerie: 'RAD-7842', tipoCodigo: 'radar', tipoNome: 'Radar de trânsito', situacao: 'MauFuncionamento', necessidadeManutencao: 'Imediata', proximaManutencao: '2026-10-26', diasRestantes: 2, latitude: -22.2190, longitude: -49.9550, bairro: 'Centro' },
  { equipamentoId: 5, numeroSerie: 'CAM-2041', tipoCodigo: 'camera', tipoNome: 'Câmera de videomonitoramento', situacao: 'Furtado', necessidadeManutencao: 'Imediata', proximaManutencao: null, diasRestantes: -1, latitude: -22.2250, longitude: -49.9480, bairro: 'Palmital' },
  { equipamentoId: 7, numeroSerie: 'ESC-2201', tipoCodigo: 'escolar', tipoNome: 'Transporte escolar', situacao: 'EmManutencao', necessidadeManutencao: 'Agendada', proximaManutencao: '2026-10-28', diasRestantes: 4, latitude: -22.2300, longitude: -49.9700, bairro: 'Borebi' }
];
