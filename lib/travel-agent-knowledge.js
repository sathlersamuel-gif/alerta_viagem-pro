// Núcleo de decisão profissional do Alerta Viagem PRO.
// Usa somente dados observados, fontes oficiais/públicas e regras explicáveis.

const KNOWLEDGE_VERSION = '2026.07.24';
const SOURCES = [
  { name: 'Google Flights', purpose: 'preço, duração, escalas, aeroportos e indicadores de preço' },
  { name: 'SerpApi Google Flights', purpose: 'estrutura dos resultados e price_insights' },
  { name: 'Azul Fidelidade', purpose: 'ofertas públicas em pontos, sempre sujeitas à confirmação' }
];

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function typicalRange(data = {}) {
  const insight = data.price_insights || data.price_insight || {};
  const range = insight.typical_price_range || insight.price_range || [];
  const low = number(Array.isArray(range) ? range[0] : range.low);
  const high = number(Array.isArray(range) ? range[1] : range.high);
  return { low, high, lowest: number(insight.lowest_price), level: insight.price_level || '' };
}

function cashQuality(price, oldBest, insights) {
  const references = [number(oldBest), insights.low, insights.lowest].filter(Boolean);
  const reference = references.length ? Math.min(...references) : null;
  const improvement = reference && price < reference ? (reference - price) / reference : 0;
  const belowTypical = insights.low && price < insights.low ? (insights.low - price) / insights.low : 0;
  const exceptional = improvement >= 0.12 || belowTypical >= 0.12 || /low/i.test(insights.level || '');
  const good = exceptional || improvement >= 0.06 || belowTypical >= 0.06;
  return { reference, improvement, belowTypical, exceptional, good };
}

function analyze({ trip, cashPrice, oldBest, flightData, pointsOffer }) {
  const price = number(cashPrice);
  const insights = typicalRange(flightData);
  const quality = price ? cashQuality(price, oldBest, insights) : { exceptional:false, good:false };
  const wantsPoints = ['points', 'mixed'].includes(trip.preference);
  const points = number(pointsOffer?.points);
  const pointsExact = Boolean(pointsOffer?.exactInventory);

  if (wantsPoints && points && pointsExact) {
    return {
      action: 'use_points',
      title: 'Boa oportunidade com milhas',
      reason: `Há emissão confirmada por ${points.toLocaleString('pt-BR')} pontos. Compare as taxas antes de finalizar.`,
      confidence: 'alta', knowledgeVersion: KNOWLEDGE_VERSION, sources: SOURCES
    };
  }

  if (price && quality.exceptional) {
    return {
      action: wantsPoints ? 'buy_cash_preserve_points' : 'buy_cash',
      title: wantsPoints ? 'Compre em dinheiro e preserve suas milhas' : 'Preço excepcional em dinheiro',
      reason: wantsPoints
        ? 'Não apareceu uma emissão confirmada em pontos, mas a tarifa em reais está muito abaixo das referências disponíveis. Um agente profissional não deixaria essa oportunidade passar apenas para insistir nas milhas.'
        : 'A tarifa está muito abaixo das referências disponíveis para esta pesquisa.',
      confidence: insights.low || oldBest ? 'alta' : 'média', knowledgeVersion: KNOWLEDGE_VERSION, sources: SOURCES
    };
  }

  if (wantsPoints && !points) {
    return {
      action: quality.good ? 'consider_cash' : 'keep_monitoring',
      title: quality.good ? 'Preço em dinheiro interessante' : 'Continue monitorando milhas e dinheiro',
      reason: quality.good
        ? 'A emissão em pontos não foi encontrada, porém o preço em reais está melhor que as referências recentes.'
        : 'Ainda não há emissão pública confirmada em pontos nem queda forte no preço em reais.',
      confidence: 'média', knowledgeVersion: KNOWLEDGE_VERSION, sources: SOURCES
    };
  }

  return {
    action: quality.good ? 'consider_cash' : 'keep_monitoring',
    title: quality.good ? 'Boa tarifa encontrada' : 'Acompanhar antes de comprar',
    reason: quality.good ? 'O preço melhorou em relação às referências disponíveis.' : 'Ainda não houve melhoria suficiente para recomendar compra imediata.',
    confidence: 'média', knowledgeVersion: KNOWLEDGE_VERSION, sources: SOURCES
  };
}

module.exports = { analyze, typicalRange, KNOWLEDGE_VERSION, SOURCES };
