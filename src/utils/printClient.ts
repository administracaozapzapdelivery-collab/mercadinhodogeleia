import type { ReceiptData } from '../components/PrintableReceipt';
import type { CompanyData } from '../types/erp';

const LOCAL_AGENT_URL = 'http://127.0.0.1:3131';

export interface PrinterOption {
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isDefault: boolean;
}

export interface PrintResult {
  ok: boolean;
  printerName?: string;
  widthMm?: string;
  fallbackBrowser?: boolean;
  error?: string;
}

async function postJsonWithTimeout(url: string, body: unknown, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    return { res, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAvailablePrinters(): Promise<{
  supported: boolean;
  printers: PrinterOption[];
}> {
  try {
    const res = await fetch('/api/print/printers');
    if (res.ok) {
      const data = await res.json();
      if (data?.supported) {
        return { supported: true, printers: data.printers ?? [] };
      }
    }
  } catch {
    // Tenta o agente local
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${LOCAL_AGENT_URL}/printers`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { supported: Boolean(data?.supported), printers: data?.printers ?? [] };
    }
  } catch {
    // Agente local não está rodando
  }

  return { supported: false, printers: [] };
}

export async function printReceiptDirect(params: {
  receipt: ReceiptData;
  twoCopies: boolean;
  store?: Partial<CompanyData> | null;
  printerName?: string;
  width?: '80mm' | '58mm';
}): Promise<PrintResult> {
  try {
    const { res, data } = await postJsonWithTimeout('/api/print/receipt', {
      receipt: params.receipt,
      twoCopies: params.twoCopies,
      printerName: params.printerName,
      width: params.width,
    });
    if (res.ok && data?.ok) {
      return { ok: true, printerName: data.printerName, widthMm: data.widthMm };
    }
  } catch {
    // Tenta agente local
  }

  // Modo produção (Vercel): envia direto para o agente local no Windows (127.0.0.1:3131)
  try {
    let printerName = params.printerName;
    let width = params.width;
    if (!printerName || !width) {
      const cfgRes = await fetch('/api/settings').catch(() => null);
      const cfgData = cfgRes?.ok ? await cfgRes.json().catch(() => null) : null;
      if (!printerName) printerName = cfgData?.config?.nome_impressora || 'VOX(U) 1';
      if (!width) width = cfgData?.config?.largura_bobina === '58mm' ? '58mm' : '80mm';
    }

    const { res, data } = await postJsonWithTimeout(
      `${LOCAL_AGENT_URL}/print/receipt`,
      {
        receipt: params.receipt,
        store: params.store ?? {},
        twoCopies: params.twoCopies,
        printerName,
        width,
      },
      5000
    );
    if (res.ok && data?.ok) {
      return { ok: true, printerName: data.printerName, widthMm: data.widthMm };
    }
    return {
      ok: false,
      fallbackBrowser: true,
      error: data?.error || 'Agente de impressão local retornou erro.',
    };
  } catch {
    return {
      ok: false,
      fallbackBrowser: true,
      error: 'Agente de impressão local (127.0.0.1:3131) não está rodando.',
    };
  }
}

export async function printTestDirect(params: {
  printerName?: string;
  width?: '80mm' | '58mm';
  store?: Partial<CompanyData> | null;
}): Promise<PrintResult> {
  try {
    const { res, data } = await postJsonWithTimeout('/api/print/test', {
      printerName: params.printerName,
      width: params.width,
    });
    if (res.ok && data?.ok) {
      return { ok: true, printerName: data.printerName, widthMm: data.widthMm };
    }
  } catch {
    // Tenta agente local
  }

  try {
    const { res, data } = await postJsonWithTimeout(
      `${LOCAL_AGENT_URL}/print/test`,
      {
        printerName: params.printerName || 'VOX(U) 1',
        width: params.width || '80mm',
        store: params.store ?? {},
      },
      5000
    );
    if (res.ok && data?.ok) {
      return { ok: true, printerName: data.printerName, widthMm: data.widthMm };
    }
    return { ok: false, fallbackBrowser: true, error: data?.error };
  } catch {
    return { ok: false, fallbackBrowser: true };
  }
}
