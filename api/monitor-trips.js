const { list, put } = require('@vercel/blob');
const { Resend } = require('resend');
const { analyze, KNOWLEDGE_VERSION } = require('../lib/travel-agent-knowledge');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';
const AZUL_POINTS_URL = 'https://passagens.voeazul.com.br/pt/pontos';

function allFlights(data) {
  return [...(data.best_flights || []), ...(data.other_flights || [])]
    .filter(item => Number(item.price) > 0)
    .sort((a, b) => Number(a.price) - Number(b.price));
}

function summarizeFlight(item) {
  const legs = Array.isArray(item?.flights) ? item.flights : [];
  const first = legs[0] || {};
  const last = legs[legs.length - 1] || {};
  const airlines = [...new Set(legs.map(leg => leg.airline).filter(Boolean))];
  return {
    price: Number(item?.price) || null,
    airline: airlines.join(' + ') || 'Companhia não informada',
    departure: first.departure_airport?.time || '',
    arrival: last.arrival_airport?.time || '',
    stops: Math.max(0, legs.length - 1),
    duration: Number(item?.total_duration) || null
  };
}

function buildSuggestions(data) {
  return allFlights(data).slice(0, 3).map(summarizeFlight).filter(item => item.price);
}

function shouldEmail(trip, price, now, decision) {
  const improved = !trip.bestPrice || price < Number(trip.bestPrice);
  const urgentDecision = ['buy_cash', 'buy_cash_preserve_points', 'use_points'].includes(decision?.action);
  if (!improved && !urgentDecision) return false;
  if (!trip.lastAlertAt || trip.frequency === 'instant') return true;
  const elapsed = now - new Date(trip.lastAlertAt).getTime();
  if (trip.frequency === 'daily') return elapsed >= 20 * 60 * 60 * 1000;
  if (trip.frequency === 'weekly') return elapsed >= 6 * 24 * 60 * 60 * 1000;
  return true;
}

async function searchTrip(trip) {
  const params = new URLSearchParams({
    engine: 'google_flights', api_key: process.env.SERPAPI_API_KEY, hl: 'pt', gl: 'br', currency: 'BRL',
    type: trip.return ? '1' : '2', departure_id: trip.origin.toUpperCase(), arrival_id: trip.destination.toUpperCase(),
    outbound_date: trip.departure, adults: String(trip.adults || 1), children: String(trip.children || 0), sort_by: '2'
  });
  if (trip.return) params.set('return_date', trip.return);
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Falha na consulta da SerpApi');
  const suggestions = buildSuggestions(data);
  return { price: suggestions[0]?.price || null, suggestions, data };
}

function plainText(html = '') {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

async function findPublicAzulPoints(trip) {
  if (!['points', 'mixed'].includes(trip.preference)) return null;
  try {
    const response = await fetch(AZUL_POINTS_URL, { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'AlertaViagemPro/1.0 (+professional-monitor)' }, cache: 'no-store' });
    if (!response.ok) return null;
    const text = plainText(await response.text());
    const pattern = /([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Para)?\s*([A-Za-zÀ-ÿ .'-]+)\s*\(([A-Z]{3})\)\s*(?:Só ida|Ida e volta)?\s*Ida:\s*(\d{2}\/\d{2}\/\d{4})[\s\S]{0,80}?A partir de\s*([\d.,]+)\s*pontos/gi;
    let match;
    const candidates = [];
    while ((match = pattern.exec(text)) !== null) {
      const [, , origin, , destination, dateBr, pointsRaw] = match;
      const [day, month, year] = dateBr.split('/');
      const date = `${year}-${month}-${day}`;
      if (origin === trip.origin.toUpperCase() && destination === trip.destination.toUpperCase() && date === trip.departure) {
        candidates.push(Number(pointsRaw.replace(/[^\d]/g, '')));
      }
    }
    const points = candidates.filter(Boolean).sort((a, b) => a - b)[0];
    return points ? { points, exactInventory: false, source: 'Azul Fidelidade', sourceUrl: AZUL_POINTS_URL } : null;
  } catch {
    return null;
  }
}

function minutesLabel(value) {
  if (!value) return '';
  const h = Math.floor(value / 60), m = value % 60;
  return `${h}h${m ? ` ${m}min` : ''}`;
}

async function sendAlert(resend, trip, result, oldPrice, decision, pointsOffer) {
  const price = result.price;
  const saving = oldPrice && oldPrice > price ? oldPrice - price : null;
  const options = trip.agentSuggestions !== false ? result.suggestions : result.suggestions.slice(0, 1);
  const suggestionsHtml = options.map((item, index) => `
    <div style="padding:12px 14px;margin:10px 0;border:1px solid #d7e6f5;border-radius:12px">
      <b>${index === 0 ? 'Melhor opção encontrada' : `Sugestão ${index + 1}`}</b><br>
      ${item.airline} • R$ ${item.price.toLocaleString('pt-BR')}<br>
      ${item.departure && item.arrival ? `${item.departure} → ${item.arrival}` : ''}${item.stops === 0 ? ' • voo direto' : ` • ${item.stops} escala(s)`}${item.duration ? ` • ${minutesLabel(item.duration)}` : ''}
    </div>`).join('');

  const pointsHtml = pointsOffer
    ? `<p><b>Referência pública em pontos:</b> ${Number(pointsOffer.points).toLocaleString('pt-BR')} pontos por pessoa. A disponibilidade precisa ser confirmada no programa.</p>`
    : ['points','mixed'].includes(trip.preference) ? '<p><b>Milhas:</b> não encontrei uma emissão pública confirmada para esta rota e data.</p>' : '';

  const subject = `✈️ ${decision.title}: ${trip.origin} → ${trip.destination}`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#102235"><h2>Alerta Viagem PRO</h2><p><b>Análise profissional:</b> ${decision.reason}</p><h3>${trip.origin} → ${trip.destination}</h3><p><b>Ida:</b> ${new Date(`${trip.departure}T12:00:00`).toLocaleDateString('pt-BR')}${trip.return ? `<br><b>Volta:</b> ${new Date(`${trip.return}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>${pointsHtml}${suggestionsHtml}${saving ? `<p>Economia de R$ ${saving.toLocaleString('pt-BR')} em relação ao melhor preço anterior.</p>` : '<p>Este é o primeiro preço real registrado para esta viagem.</p>'}<p><b>Recomendação:</b> ${decision.title}.</p><small>Conhecimento profissional ${KNOWLEDGE_VERSION}. Preços e disponibilidade devem ser confirmados antes da compra.</small></div>`;
  await resend.emails.send({ from: ALERT_FROM, to: ALERT_EMAIL, subject, html });
}

module.exports = async function handler(req, res) {
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Não autorizado.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.SERPAPI_API_KEY) {
    const missing = [];
    if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
    if (!process.env.SERPAPI_API_KEY) missing.push('SERPAPI_API_KEY');
    return res.status(200).json({ ok:false, configured:false, skipped:true, missing, message:'Monitoramento aguardando configuração das variáveis de ambiente.' });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const now = Date.now(); let checked = 0, alerts = 0, errors = 0;
  try {
    let cursor;
    do {
      const page = await list({ prefix:'monitoring/', limit:100, cursor }); cursor = page.cursor;
      for (const blob of page.blobs) {
        const response = await fetch(blob.url, { cache:'no-store' });
        const document = await response.json();
        const trips = Array.isArray(document.trips) ? document.trips : [];
        for (const trip of trips) {
          if (!trip.active) continue;
          checked += 1;
          try {
            if (!/^[A-Z]{3}$/i.test(trip.origin) || !/^[A-Z]{3}$/i.test(trip.destination)) throw new Error('Use códigos IATA de três letras, como CGB, GRU ou GIG.');
            const oldPrice = Number(trip.bestPrice) || null;
            const [result, pointsOffer] = await Promise.all([searchTrip(trip), findPublicAzulPoints(trip)]);
            const decision = analyze({ trip, cashPrice: result.price, oldBest: oldPrice, flightData: result.data, pointsOffer });
            trip.lastCheckedAt = new Date().toISOString();
            trip.lastError = null;
            trip.lastSuggestion = result.suggestions?.[0] || null;
            trip.lastDecision = decision;
            trip.lastPointsReference = pointsOffer;
            if (result.price) {
              if (shouldEmail(trip, result.price, now, decision) && resend && ['email','both'].includes(trip.channel)) {
                await sendAlert(resend, trip, result, oldPrice, decision, pointsOffer);
                trip.lastAlertAt = new Date().toISOString();
                alerts += 1;
              }
              if (!oldPrice || result.price < oldPrice) trip.bestPrice = result.price;
            }
          } catch (error) {
            trip.lastCheckedAt = new Date().toISOString();
            trip.lastError = error.message || 'Erro durante a consulta';
            errors += 1;
          }
        }
        await put(new URL(blob.url).pathname.replace(/^\//,''), JSON.stringify({ ...document, trips, knowledgeVersion: KNOWLEDGE_VERSION, updatedAt:new Date().toISOString() }), { access:'public', addRandomSuffix:false, allowOverwrite:true, contentType:'application/json', cacheControlMaxAge:0 });
      }
    } while (cursor);
    return res.status(200).json({ ok:true, checked, alerts, errors, emailEnabled:Boolean(resend), agentMode:true, knowledgeVersion:KNOWLEDGE_VERSION, extraSerpApiQueriesUsed:0 });
  } catch (error) {
    console.error('Monitor trips error:', error);
    return res.status(500).json({ error:'Falha ao executar o monitoramento automático.' });
  }
};
