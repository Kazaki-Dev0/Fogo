// ============================================================
// PROMETHEUS F.O.G.O. – previsao.js
// Placeholder da Parte 3 – Inteligência Preditiva
// Apenas exige login e monta o layout compartilhado.
// A implementação real ficará neste arquivo na Parte 3.
// ============================================================
import { exigirLogin } from './auth.js';
import { montarLayout } from './layout.js';

// TODO(contrato): Parte 3 – implementar chamadas a /api/previsao/*
//   quando os endpoints getHistoricoTelemetria, getHistoricoOcorrencias
//   e getHistoricoSerie forem integrados à interface preditiva.

exigirLogin();
montarLayout('previsao');
