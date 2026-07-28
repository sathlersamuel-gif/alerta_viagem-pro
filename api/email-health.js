const { Resend } = require('resend');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';

function compactDate(value) {
  return String(value || '').replaceAll('-', '').slice(2);
}

function flightUrl(origin, destination, departure, returning) {
  const outbound = compactDate(departure);
  const inbound = compactDate(returning);
  const path = inbound
    ? `${origin.toLowerCase()}/${destination.toLowerCase()}/${outbound}/${inbound}`
    : `${origin.toLowerCase()}/${destination.toLowerCase()}/${outbound}`;
  const query = new URLSearchParams({
    adultsv2: '1',
    cabinclass: 'economy',
    currency: 'BRL',
    locale: 'pt-BR',
    market: 'BR'
  });
  return `https://www.skyscanner.com.br/transport/flights/${path}/?${query.toString()}`;
}

function hotelUrl(destination, checkin, checkout) {
  return `https://www.booking.com/searchresults.pt-br.html?${new URLSearchParams({
    ss: destination,
    checkin,
    checkout,
    group_adults: '1',
    group_children: '0',
    no_rooms: '1'
  }).toString()}`;
}

function promotionTestHtml() {
  const offers = [
    { origin: 'CGB', destination: 'SSA', departure: '2026-11-05', returning: '2026-11-13', airline: 'Azul', price: 6709 },
    { origin: 'PVH', destination: 'GRU', departure: '2026-10-08', returning: '2026-10-15', airline: 'LATAM', price: 2489 },
    { origin: 'CGB', destination: 'REC', departure: '2026-09-12', returning: '2026-09-20', airline: 'Azul', price: 3198 }
  ];
  const cards = offers.map((o, i) => `<div style="border:1px solid #d7e6f5;border-radius:14px;padding:16px;margin:14px 0"><div style="font-size:12px;font-weight:800;color:#087cff">${i === 0 ? 'OFERTA EM DESTAQUE' : 'PROMOÇÃO DE TESTE'}</div><h3 style="margin:8px 0">${o.origin} → ${o.destination}</h3><div style="font-size:24px;font-weight:900">R$ ${o.price.toLocaleString('pt-BR')}</div><p>${o.airline}<br>Ida: ${o.departure} • Volta: ${o.returning}</p><a href="${flightUrl(o.origin,o.destination,o.departure,o.returning)}" style="display:inline-block;padding:11px 15px;background:#0057b8;color:#fff;text-decoration:none;border-radius:9px;margin-right:8px">Ver passagem aérea</a><a href="${hotelUrl(o.destination,o.departure,o.returning)}" style="display:inline-block;padding:11px 15px;background:#0b7a53;color:#fff;text-decoration:none;border-radius:9px;margin-top:8px">Ver hotéis</a></div>`).join('');
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#102235"><h2>Alerta Viagem PRO</h2><p>Teste real do formato dos alertas com links de passagem e hotel.</p>${cards}<p><small>Valores apenas para testar o formato e os links.</small></p></div>`;
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Método não permitido.' });
  const configured = Boolean(process.env.RESEND_API_KEY);
  const status = { ok: configured, configured, recipientConfigured: Boolean(ALERT_EMAIL), recipientMasked: ALERT_EMAIL.replace(/^(.{2}).*(@.*)$/, '$1***$2'), senderConfigured: Boolean(ALERT_FROM), missing: configured ? [] : ['RESEND_API_KEY'], message: configured ? 'Serviço de e-mail configurado.' : 'A chave RESEND_API_KEY ainda não está configurada na Vercel.' };

  const promotionTest = req.method === 'GET' && String(req.query?.promotionTest || '') === '1' && String(req.query?.token || '') === 'avp-email-test-2026';
  if (req.method === 'GET' && !promotionTest) return res.status(200).json(status);
  if (!configured) return res.status(503).json(status);
  if (!promotionTest && (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`)) return res.status(401).json({ ok: false, error: 'Não autorizado.' });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent = await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_EMAIL,
      subject: promotionTest ? '✈️ Teste de promoções — Alerta Viagem PRO' : '✅ Teste do Alerta Viagem PRO',
      html: promotionTest ? promotionTestHtml() : '<div style="font-family:Arial,sans-serif"><h2>Alerta Viagem PRO</h2><p>O envio de e-mail está funcionando corretamente.</p><p>Os relatórios automáticos serão enviados a cada 3 horas quando houver viagens ativas.</p></div>'
    });
    if (sent?.error) throw new Error(sent.error.message || 'O serviço recusou o envio.');
    return res.status(200).json({ ok: true, configured: true, sent: true, id: sent?.data?.id || null, recipient: status.recipientMasked });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, sent: false, error: error.message || 'Falha ao enviar e-mail de teste.' });
  }
};