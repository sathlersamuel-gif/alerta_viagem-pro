const { Resend } = require('resend');

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
const ALERT_FROM = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const configured = Boolean(process.env.RESEND_API_KEY);
  const status = {
    ok: configured,
    configured,
    recipientConfigured: Boolean(ALERT_EMAIL),
    recipientMasked: ALERT_EMAIL.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    senderConfigured: Boolean(ALERT_FROM),
    missing: configured ? [] : ['RESEND_API_KEY'],
    message: configured
      ? 'Serviço de e-mail configurado.'
      : 'A chave RESEND_API_KEY ainda não está configurada na Vercel.'
  };

  if (req.method === 'GET') return res.status(200).json(status);

  if (!configured) return res.status(503).json(status);
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: 'Não autorizado.' });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const sent = await resend.emails.send({
      from: ALERT_FROM,
      to: ALERT_EMAIL,
      subject: '✅ Teste do Alerta Viagem PRO',
      html: '<div style="font-family:Arial,sans-serif"><h2>Alerta Viagem PRO</h2><p>O envio de e-mail está funcionando corretamente.</p><p>Os relatórios automáticos serão enviados a cada 3 horas quando houver viagens ativas.</p></div>'
    });
    if (sent?.error) throw new Error(sent.error.message || 'O serviço recusou o envio.');
    return res.status(200).json({ ok: true, configured: true, sent: true, id: sent?.data?.id || null });
  } catch (error) {
    return res.status(502).json({ ok: false, configured: true, sent: false, error: error.message || 'Falha ao enviar e-mail de teste.' });
  }
};
