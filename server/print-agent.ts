import http from 'node:http';
import {
  buildEscPosReceipt,
  listWindowsPrinters,
  sendRawToWindowsPrinter,
  type EscPosReceiptData,
  type EscPosStoreInfo,
} from './utils/printer.ts';

const PORT = Number(process.env.PRINT_AGENT_PORT ?? 3131);
const HOST = '127.0.0.1';

function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function sendJson(res: http.ServerResponse, status: number, data: unknown) {
  setCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8').trim();
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split('?')[0] ?? '/';

  try {
    if (req.method === 'GET' && url === '/health') {
      sendJson(res, 200, { ok: true, platform: process.platform });
      return;
    }

    if (req.method === 'GET' && url === '/printers') {
      const result = await listWindowsPrinters();
      sendJson(res, 200, result);
      return;
    }

    if (req.method === 'POST' && url === '/print/receipt') {
      const body = await readJsonBody<{
        receipt?: EscPosReceiptData;
        store?: EscPosStoreInfo;
        twoCopies?: boolean;
        printerName?: string;
        width?: '80mm' | '58mm';
      }>(req);

      if (!body.receipt || !Array.isArray(body.receipt.items)) {
        sendJson(res, 400, { ok: false, error: 'Dados do cupom inválidos.' });
        return;
      }

      const targetPrinter = (body.printerName || 'VOX(U) 1').trim();
      const widthMm: '80mm' | '58mm' = body.width === '58mm' ? '58mm' : '80mm';
      const raw = buildEscPosReceipt(body.receipt, body.store ?? {}, {
        twoCopies: body.twoCopies,
        widthMm,
      });

      await sendRawToWindowsPrinter(targetPrinter, raw);
      sendJson(res, 200, { ok: true, printerName: targetPrinter, widthMm });
      return;
    }

    if (req.method === 'POST' && url === '/print/test') {
      const body = await readJsonBody<{
        printerName?: string;
        width?: '80mm' | '58mm';
        store?: EscPosStoreInfo;
      }>(req);

      const targetPrinter = (body.printerName || 'VOX(U) 1').trim();
      const widthMm: '80mm' | '58mm' = body.width === '58mm' ? '58mm' : '80mm';
      const nowStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(new Date());

      const testReceipt: EscPosReceiptData = {
        cupom: 'TESTE-0001',
        date: nowStr,
        operator: 'Sistema',
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

      const raw = buildEscPosReceipt(testReceipt, body.store ?? {}, {
        twoCopies: false,
        widthMm,
      });

      await sendRawToWindowsPrinter(targetPrinter, raw);
      sendJson(res, 200, { ok: true, printerName: targetPrinter, widthMm });
      return;
    }

    sendJson(res, 404, { error: 'Rota não encontrada.' });
  } catch (err) {
    sendJson(res, 500, { ok: false, error: (err as Error).message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Agente de impressão Mercadinho do Geleia rodando em http://${HOST}:${PORT}`);
});
