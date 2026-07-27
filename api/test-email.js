const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método não permitido.' });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ ok: false, error: 'RESEND_API_KEY não configurada.' });
  }

  const to = process.env.ALERT_EMAIL || 'sathlersamuel@gmail.com';
  const from = process.env.ALERT_FROM || 'Alerta Viagem PRO <onboarding@resend.dev>';

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from,
      to,
      subject: '✅ Teste do Alerta Viagem PRO',
      html: '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto"><h2>Alerta Viagem PRO</h2><p>Seu envio de e-mail foi configurado corretamente.</p><p>Quando o sistema encontrar uma oportunidade de viagem, você poderá receber o alerta neste endereço.</p></div>'
    });

    if (result.error) {
      return res.status(502).json({ ok: false, error: result.error.message || 'Falha no envio.' });
    }

    return res.status(200).json({ ok: true, sentTo: to, message: 'E-mail de teste enviado.' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'Erro inesperado.' });
  }
};