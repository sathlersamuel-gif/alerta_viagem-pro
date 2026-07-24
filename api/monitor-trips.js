const { list, put } = require('@vercel/blob');
const { Resend } = require('resend');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';

function minPrice(data) {
  const flights = [...(data.best_flights || []), ...(data.other_flights || [])];
  const prices = flights.map(item => Number(item.price)).filter(value => Number.isFinite(value) && value > 0);
  return prices.length ? Math.min(...prices) : null;
}

function shouldEmail(trip, price, now) {
  const improved = !trip.bestPrice || price < Number(trip.bestPrice);
  if (!improved) return false;
  if (!trip.lastAlertAt || trip.frequency === 'instant') return true;
  const elapsed = now - new Date(trip.lastAlertAt).getTime();
  if (trip.frequency === 'daily') return elapsed >= 20 * 60 * 60 * 1000;
  if (trip.frequency === 'weekly') return elapsed >= 6 * 24 * 60 * 60 * 1000;
  return true;
}

async function searchTrip(trip) {
  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: process.env.SERPAPI_API_KEY,
    hl: 'pt',
    gl: 'br',
    currency: 'BRL',
    type: trip.return ? '1' : '2',
    departure_id: trip.origin.toUpperCase(),
    arrival_id: trip.destination.toUpperCase(),
    outbound_date: trip.departure,
    adults: String(trip.adults || 1),
    children: String(trip.children || 0),
    sort_by: '2'
  });
  if (trip.return) params.set('return_date', trip.return);
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Falha na consulta da SerpApi');
  return { price: minPrice(data), data };
}

async function sendAlert(resend, trip, price, oldPrice) {
  const saving = oldPrice && oldPrice > price ? oldPrice - price : null;
  const subject = `✈️ Oferta encontrada: ${trip.origin} → ${trip.destination} por R$ ${price.toLocaleString('pt-BR')}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#102235">
      <h2>Alerta Viagem PRO</h2>
      <p>Encontramos uma nova oportunidade para a viagem monitorada:</p>
      <h3>${trip.origin} → ${trip.destination}</h3>
      <p><b>Ida:</b> ${new Date(`${trip.departure}T12:00:00`).toLocaleDateString('pt-BR')}${trip.return ? `<br><b>Volta:</b> ${new Date(`${trip.return}T12:00:00`).toLocaleDateString('pt-BR')}` : ''}</p>
      <p style="font-size:25px"><b>R$ ${price.toLocaleString('pt-BR')}</b></p>
      ${saving ? `<p>Economia de R$ ${saving.toLocaleString('pt-BR')} em relação ao melhor preço anterior.</p>` : '<p>Este é o primeiro preço real registrado para esta viagem.</p>'}
      <p>Abra o Alerta Viagem PRO para acompanhar o monitoramento.</p>
      <small>Os preços podem mudar rapidamente e dependem da disponibilidade exibida no momento da consulta.</small>
    </div>`;
  await resend.emails.send({ from: ALERT_FROM, to: ALERT_EMAIL, subject, html });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.SERPAPI_API_KEY) {
    const missing = [];
    if (!process.env.BLOB_READ_WRITE_TOKEN) missing.push('BLOB_READ_WRITE_TOKEN');
    if (!process.env.SERPAPI_API_KEY) missing.push('SERPAPI_API_KEY');
    return res.status(200).json({
      ok: false,
      configured: false,
      skipped: true,
      missing,
      message: 'Monitoramento aguardando configuração das variáveis de ambiente.'
    });
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const now = Date.now();
  let checked = 0;
  let alerts = 0;
  let errors = 0;

  try {
    let cursor;
    do {
      const page = await list({ prefix: 'monitoring/', limit: 100, cursor });
      cursor = page.cursor;
      for (const blob of page.blobs) {
        const response = await fetch(blob.url, { cache: 'no-store' });
        const document = await response.json();
        const trips = Array.isArray(document.trips) ? document.trips : [];

        for (const trip of trips) {
          if (!trip.active) continue;
          checked += 1;
          try {
            if (!/^[A-Z]{3}$/i.test(trip.origin) || !/^[A-Z]{3}$/i.test(trip.destination)) {
              throw new Error('Use códigos IATA de três letras, como CGB, GRU ou GIG.');
            }
            const oldPrice = Number(trip.bestPrice) || null;
            const result = await searchTrip(trip);
            trip.lastCheckedAt = new Date().toISOString();
            trip.lastError = null;
            if (result.price) {
              if (shouldEmail(trip, result.price, now) && resend && ['email', 'both'].includes(trip.channel)) {
                await sendAlert(resend, trip, result.price, oldPrice);
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

        await put(new URL(blob.url).pathname.replace(/^\//, ''), JSON.stringify({ ...document, trips, updatedAt: new Date().toISOString() }), {
          access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 0
        });
      }
    } while (cursor);

    return res.status(200).json({ ok: true, checked, alerts, errors, emailEnabled: Boolean(resend) });
  } catch (error) {
    console.error('Monitor trips error:', error);
    return res.status(500).json({ error: 'Falha ao executar o monitoramento automático.' });
  }
};