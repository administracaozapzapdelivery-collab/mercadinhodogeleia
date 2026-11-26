import { Router } from 'express';
import { pool } from '../db.ts';
import { requireAuth } from '../utils/security.ts';
import {
  buildEscPosReceipt,
  listWindowsPrinters,
  sendRawToWindowsPrinter,
  type EscPosReceiptData,
} from '../utils/printer.ts';

export const printRouter = Router();

printRouter.get('/printers', requireAuth, async (_req, res) => {
  try {
    const result = await listWindowsPrinters();
    res.json(result);
  } catch (err) {
    res.json({
      supported: process.platform === 'win32',
      printers: [],
      error: (err as Error).message,
    });
  }
});

printRouter.post('/receipt', requireAuth, async (req, res) => {
  try {
    const { receipt, twoCopies = true, printerName: bodyPrinter, width: bodyWidth } = req.body as {
      receipt?: EscPosReceiptData;
      twoCopies?: boolean;
      printerName?: string;
      width?: '80mm' | '58mm';
    };

    if (!receipt || !Array.isArray(receipt.items)) {
      res.status(400).json({ error: 'Dados do cupom inválidos.' });
      return;
    }

    if (process.platform !== 'win32') {
      res.status(200).json({
        ok: false,
        fallbackBrowser: true,
        error: 'Impressão direta disponível apenas no servidor local Windows.',
      });
      return;
    }

    const [cfgRes, companyRes] = await Promise.all([
      pool.query('SELECT nome_impressora, largura_bobina FROM configuracoes WHERE id = 1'),
      pool.query('SELECT * FROM dados_empresa WHERE id = 1'),
    ]);

    const cfg = cfgRes.rows[0] ?? {};
    const store = companyRes.rows[0] ?? {};
    const targetPrinter = (bodyPrinter || cfg.nome_impressora || 'VOX(U) 1').trim();
    const widthMm: '80mm' | '58mm' =
      (bodyWidth || cfg.largura_bobina) === '58mm' ? '58mm' : '80mm';

    const raw = buildEscPosReceipt(receipt, store, {
      twoCopies: Boolean(twoCopies),
      widthMm,
    });

    await sendRawToWindowsPrinter(targetPrinter, raw);
    res.json({ ok: true, printerName: targetPrinter, widthMm });
  } catch (err) {
    res.status(200).json({
      ok: false,
      fallbackBrowser: true,
      error: (err as Error).message,
    });
  }
});

printRouter.post('/test', requireAuth, async (req, res) => {
  try {
    if (process.platform !== 'win32') {
      res.status(400).json({ error: 'Impressão de teste direta disponível apenas no Windows.' });
      return;
    }

    const { printerName: bodyPrinter, width: bodyWidth } = (req.body ?? {}) as {
      printerName?: string;
      width?: '80mm' | '58mm';
    };

    const [cfgRes, companyRes] = await Promise.all([
      pool.query('SELECT nome_impressora, largura_bobina FROM configuracoes WHERE id = 1'),
      pool.query('SELECT * FROM dados_empresa WHERE id = 1'),
    ]);

    const cfg = cfgRes.rows[0] ?? {};
    const store = companyRes.rows[0] ?? {};
    const targetPrinter = (bodyPrinter || cfg.nome_impressora || 'VOX(U) 1').trim();
    const widthMm: '80mm' | '58mm' =
      (bodyWidth || cfg.largura_bobina) === '58mm' ? '58mm' : '80mm';

    const nowStr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date());

    const testReceipt: EscPosReceiptData = {
      cupom: 'TESTE-0001',
      date: nowStr,
      operator: req.user?.name || 'Sistema',
      paymentMethod: 'Dinheiro',
      items: [
        { name: 'Teste de Impressao Termica', quantity: 1, unit: 'un', unitPrice: 1.0, subtotal: 1.0 },
        { name: 'Acentuacao: A E I O U C a e i o u c', quantity: 1, unit: 'un', unitPrice: 0.0, subtotal: 0.0 },
      ],
      subtotal: 1.0,
      discount: 0,
      total: 1.0,
      cashReceived: 1.0,
      changeDue: 0,
    };

    const raw = buildEscPosReceipt(testReceipt, store, {
      twoCopies: false,
      widthMm,
    });

    await sendRawToWindowsPrinter(targetPrinter, raw);
    res.json({ ok: true, printerName: targetPrinter, widthMm });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
