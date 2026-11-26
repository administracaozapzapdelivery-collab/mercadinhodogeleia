import crypto from 'node:crypto';
import { Router } from 'express';
import { pool } from '../db.ts';
import { requireAuth, requireRole } from '../utils/security.ts';

export const mercadopagoRouter = Router();

const MP_API_BASE = 'https://api.mercadopago.com';

async function getMpConfig() {
  const { rows } = await pool.query<{
    mp_pix_ativo: boolean;
    mp_public_key: string | null;
    mp_access_token: string | null;
  }>('SELECT mp_pix_ativo, mp_public_key, mp_access_token FROM configuracoes WHERE id = 1');
  const row = rows[0];
  return {
    active: Boolean(row?.mp_pix_ativo),
    publicKey: row?.mp_public_key || process.env.MP_PUBLIC_KEY || '',
    accessToken: row?.mp_access_token || process.env.MP_ACCESS_TOKEN || '',
  };
}

// Cria uma cobrança EXCLUSIVA via PIX no Mercado Pago
mercadopagoRouter.post('/pix', requireAuth, async (req, res) => {
  try {
    const { amount, description, payerEmail } = req.body as {
      amount?: number;
      description?: string;
      payerEmail?: string;
    };

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'Valor inválido para gerar QR Code PIX.' });
      return;
    }

    const mp = await getMpConfig();
    if (!mp.active) {
      res.status(400).json({ error: 'Integração Mercado Pago (PIX) está desativada nas Configurações.' });
      return;
    }
    if (!mp.accessToken) {
      res.status(400).json({ error: 'Access Token do Mercado Pago não configurado.' });
      return;
    }

    const expiration = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const idempotencyKey = crypto.randomUUID();

    const mpRes = await fetch(`${MP_API_BASE}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${mp.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: Number(numericAmount.toFixed(2)),
        description: (description || 'Venda PDV - Mercadinho e Lanchonete do Geleia').slice(0, 250),
        payment_method_id: 'pix',
        date_of_expiration: expiration,
        payer: {
          email: payerEmail || 'cliente@mercadinhodogeleia.com.br',
        },
      }),
    });

    const data = (await mpRes.json().catch(() => null)) as Record<string, any> | null;
    if (!mpRes.ok || !data) {
      const msg =
        data?.message ||
        data?.cause?.[0]?.description ||
        'Erro ao gerar cobrança PIX no Mercado Pago.';
      res.status(mpRes.status || 502).json({ error: msg });
      return;
    }

    const txData = data.point_of_interaction?.transaction_data ?? {};
    res.json({
      paymentId: String(data.id),
      status: String(data.status || 'pending'),
      qrCode: txData.qr_code || '',
      qrCodeBase64: txData.qr_code_base64 || '',
      ticketUrl: txData.ticket_url || '',
      expiresAt: data.date_of_expiration || expiration,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Consulta status do pagamento PIX no Mercado Pago
mercadopagoRouter.get('/pix/:paymentId', requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!/^\d+$/.test(paymentId)) {
      res.status(400).json({ error: 'ID de pagamento inválido.' });
      return;
    }

    const mp = await getMpConfig();
    if (!mp.accessToken) {
      res.status(400).json({ error: 'Access Token do Mercado Pago não configurado.' });
      return;
    }

    const mpRes = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mp.accessToken}`,
      },
    });
    const data = (await mpRes.json().catch(() => null)) as Record<string, any> | null;
    if (!mpRes.ok || !data) {
      res.status(mpRes.status || 502).json({
        error: data?.message || 'Erro ao consultar status do PIX no Mercado Pago.',
      });
      return;
    }

    res.json({
      paymentId: String(data.id),
      status: String(data.status || 'pending'),
      statusDetail: String(data.status_detail || ''),
      transactionAmount: Number(data.transaction_amount || 0),
      dateApproved: data.date_approved || null,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Testa as credenciais do Mercado Pago na aba de Configurações
mercadopagoRouter.post('/test', requireAuth, requireRole('ADMIN', 'GERENTE'), async (req, res) => {
  try {
    const bodyToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
    const mp = await getMpConfig();
    const tokenToTest = bodyToken || mp.accessToken;

    if (!tokenToTest) {
      res.status(400).json({ ok: false, error: 'Informe o Access Token de produção.' });
      return;
    }

    const mpRes = await fetch(`${MP_API_BASE}/users/me`, {
      headers: {
        Authorization: `Bearer ${tokenToTest}`,
      },
    });
    const data = (await mpRes.json().catch(() => null)) as Record<string, any> | null;
    if (!mpRes.ok || !data) {
      res.status(400).json({
        ok: false,
        error: data?.message || 'Access Token inválido ou sem permissão.',
      });
      return;
    }

    res.json({
      ok: true,
      userId: data.id,
      nickname: data.nickname || '',
      email: data.email || '',
      siteId: data.site_id || 'MLB',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
});
