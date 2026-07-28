const { Resend } = require('resend');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';

function flightUrl(origin, destination, departure, returning) {
  const text = `Voos de ${origin} para ${destination} ida em ${departure} volta em ${returning} para 1 adulto`;
  const q = new URLSearchParams({ q: text, hl: 'pt-BR', curr: 'BRL' });
  return `https://www.google.com/travel/flights?${q.toString()}`;
}

function hotelUrl(destination, checkin, checkout) {
  const q = new URLSearchParams({
    ss: destination,
    checkin,
    checkout,
    group_adults: '1',
    group_children: '0',
    no_rooms: '1'
  });
  return `https://www.booking.com/searchresults.pt-br.html?${q.toString()}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ ok: false, error: 'RESEND_API_KEY ausente.' });
  if (String(req.query?.token || '') !== 'avp-email-test-2026') return res.status(401).json({ ok: false, error: 'Não autorizado.' });

  const offers = [
    { origin: 'CGB', destination: 'SSA', departure: '2026-11-05', returning: '2026-11-13', airline: 'Azul', price: 6709 },
    { origin: 'PVH', destination: 'GRU', departure: '2026-10-08', returning: '2026-10-15', airline: 'LATAM', price: 2489 },
    { origin: 'CGB', destination: 'REC', departure: '2026-09-12', returning: '2026-09-20', airline: 'Azul', price: 3198 }
  ];

  const cards = offers.map((o, i) => `
    <div style="border:1px solid #d7e6f5;border-radius:14px;padding:16px;margin:14px 0">
      <div style="font-size:12px;font-weight:800;color:#087cff">${i === 0 ? 'OFERTA EM DESTAQUE' : 'PROMOÇÃO DE TESTE'}</div>
      <h3 style="margin:8px 0">${o.origin} → ${o.destination}</h3>
      <div style="font-size:24px;font-weight:900">R$ ${o.price.toLocaleString('pt-BR')}</div>
      <p>${o.airline}<br>Ida: ${o.departure} • Volta: ${o.returning}</p>
      <a href="${flightUrl(o.origin, o.destination, o.departure, o.returning)}" style="display:inline-block;padding:11px 15px;background:#0057b8;color:#fff;text-decoration:none;border-radius:9px;margin-right:8px">Ver passagem aérea</a>
      <a href="${hotelUrl(o.destination, o.departure, o.returning)}" style="display:inline-block;padding:11px 15px;background:#0b7a53;color:#fff;text-decoration:none;border-radius:9px;margin-top:8px">Ver hotéis</a>
    </div>`).join('');

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent = await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_EMAIL,
      subject: '✈️ Teste de promoções — Alerta Viagem PRO',
      html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#102235"><h2>Alerta Viagem PRO</h2><p>Este é um teste real do formato dos alertas. Os botões abaixo devem abrir a busca de passagem e a busca de hotel com rota e datas preenchidas.</p>${cards}<p><small>Valores exibidos apenas para testar o formato e os links. Confirme preços reais ao abrir cada fornecedor.</small></p></div>`
    });
    if (sent?.error) throw new Error(sent.error.message || 'Resend recusou o envio.');
    return res.status(200).json({ ok: true, sent: true, id: sent?.data?.id || null, recipient: ALERT_EMAIL.replace(/^(.{2}).*(@.*)$/, '$1***$2') });
  } catch (error) {
    return res.status(502).json({ ok: false, sent: false, error: error.message || 'Falha ao enviar teste.' });
  }
};
