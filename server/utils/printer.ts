import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface WindowsPrinterInfo {
  name: string;
  driverName: string;
  portName: string;
  status: string;
  isDefault: boolean;
}

export interface EscPosReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  subtotal: number;
}

export interface EscPosReceiptData {
  cupom: string;
  date: string;
  operator: string;
  paymentMethod: string;
  items: EscPosReceiptItem[];
  subtotal: number;
  discount: number;
  total: number;
  cashReceived?: number;
  changeDue?: number;
  customer?: {
    name: string;
    cpf?: string;
    phone?: string;
    previousDebt?: number;
    newDebt?: number;
    creditLimit?: number;
  };
}

export interface EscPosStoreInfo {
  nome_fantasia?: string | null;
  razao_social?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  nome_proprietario?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  mensagem_cupom?: string | null;
}

// Mapa CP850 (Multilingual Latin 1) para caracteres acentuados em português
const CP850_MAP: Record<string, number> = {
  Ç: 0x80,
  ü: 0x81,
  é: 0x82,
  â: 0x83,
  ä: 0x84,
  à: 0x85,
  å: 0x86,
  ç: 0x87,
  ê: 0x88,
  ë: 0x89,
  è: 0x8a,
  ï: 0x8b,
  î: 0x8c,
  ì: 0x8d,
  Ä: 0x8e,
  Å: 0x8f,
  É: 0x90,
  æ: 0x91,
  Æ: 0x92,
  ô: 0x93,
  ö: 0x94,
  ò: 0x95,
  û: 0x96,
  ù: 0x97,
  ÿ: 0x98,
  Ö: 0x99,
  Ü: 0x9a,
  ø: 0x9b,
  '£': 0x9c,
  Ø: 0x9d,
  '×': 0x9e,
  ƒ: 0x9f,
  á: 0xa0,
  í: 0xa1,
  ó: 0xa2,
  ú: 0xa3,
  ñ: 0xa4,
  Ñ: 0xa5,
  ª: 0xa6,
  º: 0xa7,
  '¿': 0xa8,
  '®': 0xa9,
  '¬': 0xaa,
  '½': 0xab,
  '¼': 0xac,
  '¡': 0xad,
  '«': 0xae,
  '»': 0xaf,
  Á: 0xb5,
  Â: 0xb6,
  À: 0xb7,
  '©': 0xb8,
  ã: 0xc6,
  Ã: 0xc7,
  Ê: 0xd2,
  Ë: 0xd3,
  È: 0xd4,
  Í: 0xd6,
  Î: 0xd7,
  Ï: 0xd8,
  Ó: 0xe0,
  ß: 0xe1,
  Ô: 0xe2,
  Ò: 0xe3,
  õ: 0xe4,
  Õ: 0xe5,
  Ú: 0xe9,
  Û: 0xea,
  Ù: 0xeb,
  ý: 0xec,
  Ý: 0xed,
  '°': 0xf8,
  '•': 0x2a,
  '—': 0x2d,
  '–': 0x2d,
  '✂': 0x2d,
};

function encodeCp850(text: string): Buffer {
  const bytes: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      bytes.push(code);
    } else if (ch === '\n' || ch === '\r') {
      bytes.push(code);
    } else if (CP850_MAP[ch] !== undefined) {
      bytes.push(CP850_MAP[ch]);
    } else {
      const normalized = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const fallback = normalized.charCodeAt(0);
      bytes.push(fallback >= 0x20 && fallback <= 0x7e ? fallback : 0x3f);
    }
  }
  return Buffer.from(bytes);
}

function formatMoney(value: number): string {
  return `R$ ${Number(value || 0)
    .toFixed(2)
    .replace('.', ',')}`;
}

function wrapText(text: string, width: number): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word.length > width ? word.slice(0, width) : word;
      if (word.length > width) {
        lines.push(current);
        current = word.slice(width);
      }
    } else if (current.length + 1 + word.length <= width) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function lrLine(left: string, right: string, width: number): string {
  const r = right.trim();
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.trim().slice(0, maxLeft);
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(spaces)}${r}`;
}

export function buildEscPosReceipt(
  receipt: EscPosReceiptData,
  store: EscPosStoreInfo,
  options: { twoCopies?: boolean; widthMm?: '80mm' | '58mm' } = {}
): Buffer {
  const cols = options.widthMm === '58mm' ? 32 : 48;
  const isCrediario = receipt.paymentMethod === 'Crediário';
  const twoCopies = options.twoCopies !== undefined ? options.twoCopies : isCrediario;

  const chunks: Buffer[] = [];
  const pushRaw = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const pushText = (line = '') => chunks.push(encodeCp850(`${line}\n`));

  const ESC = 0x1b;
  const GS = 0x1d;

  const initPrinter = () => {
    pushRaw(ESC, 0x40); // ESC @ - Initialize
    pushRaw(ESC, 0x74, 0x02); // ESC t 2 - Codepage PC850
  };

  const alignLeft = () => pushRaw(ESC, 0x61, 0x00);
  const alignCenter = () => pushRaw(ESC, 0x61, 0x01);
  const boldOn = () => pushRaw(ESC, 0x45, 0x01);
  const boldOff = () => pushRaw(ESC, 0x45, 0x00);
  const sizeNormal = () => pushRaw(GS, 0x21, 0x00);
  const sizeDouble = () => pushRaw(GS, 0x21, 0x11);
  const sizeDoubleHeight = () => pushRaw(GS, 0x21, 0x01);
  const cutPaper = () => {
    pushRaw(0x0a, 0x0a, 0x0a, 0x0a);
    pushRaw(GS, 0x56, 0x42, 0x03); // GS V 66 3 - Feed and partial cut
  };

  const sepDash = '-'.repeat(cols);
  const sepEq = '='.repeat(cols);

  const renderVia = (viaLabel: string, requireSignature: boolean) => {
    initPrinter();

    // Cabeçalho da Loja
    alignCenter();
    boldOn();
    sizeDoubleHeight();
    for (const line of wrapText((store.nome_fantasia || 'Mercadinho do Geleia').toUpperCase(), cols)) {
      pushText(line);
    }
    sizeNormal();
    boldOff();

    if (store.razao_social) {
      for (const line of wrapText(store.razao_social, cols)) pushText(line);
    }
    if (store.cnpj) pushText(`CNPJ: ${store.cnpj}`);
    if (store.inscricao_estadual) pushText(`IE: ${store.inscricao_estadual}`);
    if (store.nome_proprietario) pushText(`Prop.: ${store.nome_proprietario}`);
    if (store.telefone || store.whatsapp) {
      const tel = store.telefone || store.whatsapp || '';
      const extra =
        store.telefone && store.whatsapp && store.telefone !== store.whatsapp
          ? ` | WhatsApp: ${store.whatsapp}`
          : '';
      for (const line of wrapText(`Tel: ${tel}${extra}`, cols)) pushText(line);
    }
    if (store.endereco) {
      const addr = [
        store.endereco,
        store.numero ? `, ${store.numero}` : '',
        store.bairro ? ` - ${store.bairro}` : '',
        store.cidade ? `, ${store.cidade}` : '',
        store.uf ? `/${store.uf}` : '',
      ].join('');
      for (const line of wrapText(addr, cols)) pushText(line);
    }

    pushText('');
    boldOn();
    pushText(`[ ${viaLabel.toUpperCase()} ]`);
    boldOff();
    alignLeft();
    pushText(sepDash);

    // Dados do Cupom
    pushText(lrLine('CUPOM NAO FISCAL:', receipt.cupom, cols));
    pushText(lrLine('DATA/HORA:', receipt.date, cols));
    pushText(lrLine('OPERADOR:', receipt.operator, cols));
    boldOn();
    pushText(lrLine('PAGAMENTO:', receipt.paymentMethod.toUpperCase(), cols));
    boldOff();
    pushText(sepDash);

    // Dados do Cliente
    if (receipt.customer) {
      boldOn();
      for (const line of wrapText(`CLIENTE: ${receipt.customer.name.toUpperCase()}`, cols)) {
        pushText(line);
      }
      boldOff();
      if (receipt.customer.cpf) pushText(`CPF: ${receipt.customer.cpf}`);
      if (receipt.customer.phone) pushText(`FONE: ${receipt.customer.phone}`);
      if (isCrediario && receipt.customer.newDebt !== undefined) {
        boldOn();
        pushText(lrLine('SALDO CREDIARIO ATUAL:', formatMoney(receipt.customer.newDebt), cols));
        boldOff();
      }
      pushText(sepDash);
    }

    // Itens
    boldOn();
    pushText(lrLine('ITEM / QTD x UNIT', 'TOTAL', cols));
    boldOff();
    pushText(sepDash);

    receipt.items.forEach((item, idx) => {
      const num = String(idx + 1).padStart(2, '0');
      const titleLines = wrapText(`${num}. ${item.name}`, cols);
      boldOn();
      for (const line of titleLines) pushText(line);
      boldOff();
      const leftDetail = `  ${item.quantity} ${item.unit || 'un'} x ${formatMoney(item.unitPrice)}`;
      pushText(lrLine(leftDetail, formatMoney(item.subtotal), cols));
    });

    pushText(sepDash);

    // Totais
    pushText(lrLine('SUBTOTAL:', formatMoney(receipt.subtotal), cols));
    if (receipt.discount > 0) {
      pushText(lrLine('DESCONTO:', `- ${formatMoney(receipt.discount)}`, cols));
    }
    pushText(sepEq);
    boldOn();
    sizeDoubleHeight();
    pushText(lrLine('TOTAL:', formatMoney(receipt.total), cols));
    sizeNormal();
    boldOff();
    pushText(sepEq);

    if (
      receipt.paymentMethod === 'Dinheiro' &&
      receipt.cashReceived !== undefined &&
      receipt.cashReceived > 0
    ) {
      pushText(lrLine('VALOR RECEBIDO:', formatMoney(receipt.cashReceived), cols));
      boldOn();
      pushText(lrLine('TROCO:', formatMoney(receipt.changeDue || 0), cols));
      boldOff();
      pushText(sepDash);
    }

    // Assinatura ou Rodapé
    if (requireSignature) {
      pushText('');
      const msg = isCrediario
        ? 'Reconheco e confesso a divida referente aos itens acima descritos para pagamento no crediario.'
        : 'Confirmo o recebimento das mercadorias descritas neste cupom.';
      alignCenter();
      for (const line of wrapText(msg, cols)) pushText(line);
      pushText('');
      pushText('');
      pushText('_'.repeat(Math.min(36, cols - 4)));
      boldOn();
      pushText((receipt.customer?.name || 'Assinatura do Cliente').toUpperCase().slice(0, cols));
      boldOff();
      if (receipt.customer?.cpf) pushText(`CPF: ${receipt.customer.cpf}`);
      alignLeft();
    } else {
      pushText('');
      alignCenter();
      const footer =
        store.mensagem_cupom || 'Obrigado pela preferencia! Volte sempre.';
      for (const line of wrapText(footer, cols)) pushText(line);
      alignLeft();
    }

    cutPaper();
  };

  if (isCrediario) {
    renderVia('1a Via - Estabelecimento (Assinar)', true);
    if (twoCopies) {
      renderVia('2a Via - Cliente', false);
    }
  } else {
    renderVia('Cupom Nao Fiscal', false);
    if (twoCopies) {
      renderVia('2a Via - Cliente', false);
    }
  }

  return Buffer.concat(chunks);
}

export async function listWindowsPrinters(): Promise<{
  supported: boolean;
  printers: WindowsPrinterInfo[];
}> {
  if (process.platform !== 'win32') {
    return { supported: false, printers: [] };
  }

  const psScript = `
$ErrorActionPreference = 'Stop'
$defaultName = (Get-CimInstance Win32_Printer -Filter "Default = True" | Select-Object -First 1 -ExpandProperty Name)
$items = Get-Printer | ForEach-Object {
  [PSCustomObject]@{
    name = $_.Name
    driverName = $_.DriverName
    portName = $_.PortName
    status = ($_.PrinterStatus -join ', ')
    isDefault = ($_.Name -eq $defaultName)
  }
}
$items | ConvertTo-Json -Compress
`.trim();

  const { stdout } = await execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', psScript],
    { timeout: 8000 }
  );

  const trimmed = stdout.trim();
  if (!trimmed) return { supported: true, printers: [] };
  const parsed = JSON.parse(trimmed);
  const list: WindowsPrinterInfo[] = Array.isArray(parsed) ? parsed : [parsed];
  return { supported: true, printers: list };
}

export async function sendRawToWindowsPrinter(
  printerName: string,
  rawBuffer: Buffer
): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Impressão direta Windows Spooler disponível apenas em servidor Windows.');
  }
  if (!printerName.trim()) {
    throw new Error('Nome da impressora não configurado.');
  }

  const tmpFile = path.join(
    os.tmpdir(),
    `geleia-escpos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`
  );
  await fs.writeFile(tmpFile, rawBuffer);

  const safePrinter = printerName.replace(/'/g, "''");
  const safePath = tmpFile.replace(/'/g, "''");

  const psScript = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

  public static void SendBytesToPrinter(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      var di = new DOCINFOA { pDocName = "Cupom Mercadinho do Geleia", pDataType = "RAW" };
      if (!StartDocPrinter(hPrinter, 1, ref di)) {
        throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        }
        try {
          int written;
          if (!WritePrinter(hPrinter, bytes, bytes.Length, out written) || written != bytes.Length) {
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
"@
$bytes = [System.IO.File]::ReadAllBytes('${safePath}')
[RawPrinterHelper]::SendBytesToPrinter('${safePrinter}', $bytes)
`.trim();

  try {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 15000 }
    );
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}
