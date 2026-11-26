import { useCallback, useEffect, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { CompanyData, PaymentMethod } from '../types/erp';

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  subtotal: number;
}

export interface ReceiptData {
  cupom: string;
  date: string;
  operator: string;
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
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

interface ReceiptModalProps {
  open: boolean;
  receipt: ReceiptData | null;
  autoPrint?: boolean;
  onClose: () => void;
}

export function ReceiptModal({ open, receipt, autoPrint = false, onClose }: ReceiptModalProps) {
  const { company } = useErp();
  const [twoCopies, setTwoCopies] = useState(true);
  const [bobinaWidth, setBobinaWidth] = useState<'80mm' | '58mm'>('80mm');
  const [printerName, setPrinterName] = useState<string>('VOX(U) 1');
  const [printing, setPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [store, setStore] = useState<Partial<CompanyData>>({
    nome_fantasia: 'Mercadinho do Geleia',
    razao_social: '',
    cnpj: '',
    nome_proprietario: '',
    telefone: '',
    whatsapp: '',
    mensagem_cupom: 'Obrigado pela preferência! Volte sempre.',
  });

  useEffect(() => {
    if (!open) return;
    setTwoCopies(receipt?.paymentMethod === 'Crediário');
    setPrintStatus(null);
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config?.largura_bobina === '58mm') {
          setBobinaWidth('58mm');
        } else {
          setBobinaWidth('80mm');
        }
        if (data?.config?.nome_impressora) {
          setPrinterName(data.config.nome_impressora);
        }
      })
      .catch(() => {});

    if (company) {
      setStore(company);
      return;
    }
    fetch('/api/company')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setStore(data);
      })
      .catch(() => {});
  }, [open, company]);

  const handlePrint = useCallback(
    async (copies: boolean) => {
      if (!receipt) return;
      setPrinting(true);
      setPrintStatus(null);
      try {
        const res = await fetch('/api/print/receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receipt,
            twoCopies: copies,
            printerName,
            width: bobinaWidth,
          }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.ok) {
          setPrintStatus({
            ok: true,
            text: `Cupom enviado para "${data.printerName}"!`,
          });
          return;
        }
        if (data?.fallbackBrowser) {
          window.print();
          return;
        }
        setPrintStatus({
          ok: false,
          text: data?.error || 'Falha na impressão direta. Usando navegador...',
        });
        window.print();
      } catch {
        window.print();
      } finally {
        setPrinting(false);
      }
    },
    [receipt, printerName, bobinaWidth]
  );

  useEffect(() => {
    if (!open || !receipt || !autoPrint) return;
    const timer = setTimeout(() => {
      void handlePrint(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [open, receipt, autoPrint, handlePrint]);

  if (!open || !receipt) return null;

  const isCrediario = receipt.paymentMethod === 'Crediário';

  function renderVia(viaLabel: string, requireSignature: boolean) {
    if (!receipt) return null;
    return (
      <div className="bg-[#FFFDF5] text-slate-900 font-mono text-[12px] leading-relaxed p-4 border border-dashed border-slate-300 rounded-lg">
        {/* Cabeçalho da Loja */}
        <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
          <p className="font-bold text-[14px] uppercase tracking-wide">
            {store.nome_fantasia || 'Mercadinho do Geleia'}
          </p>
          {store.razao_social && (
            <p className="text-[10px] text-slate-700">{store.razao_social}</p>
          )}
          {store.cnpj && <p className="text-[11px]">CNPJ: {store.cnpj}</p>}
          {store.inscricao_estadual && (
            <p className="text-[10px]">IE: {store.inscricao_estadual}</p>
          )}
          {store.nome_proprietario && (
            <p className="text-[10px]">Prop.: {store.nome_proprietario}</p>
          )}
          {(store.telefone || store.whatsapp) && (
            <p className="text-[11px]">
              Tel: {store.telefone || store.whatsapp}
              {store.telefone && store.whatsapp && store.telefone !== store.whatsapp
                ? ` • WhatsApp: ${store.whatsapp}`
                : ''}
            </p>
          )}
          {store.endereco && (
            <p className="text-[10px] text-slate-700">
              {store.endereco}
              {store.numero ? `, ${store.numero}` : ''}
              {store.bairro ? ` — ${store.bairro}` : ''}
              {store.cidade ? `, ${store.cidade}` : ''}
              {store.uf ? `/${store.uf}` : ''}
            </p>
          )}
          <p className="mt-1 inline-block px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded">
            {viaLabel}
          </p>
        </div>

        {/* Dados do Cupom */}
        <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[11px] space-y-0.5">
          <div className="flex justify-between">
            <span>CUPOM NÃO FISCAL:</span>
            <strong>{receipt.cupom}</strong>
          </div>
          <div className="flex justify-between">
            <span>DATA/HORA:</span>
            <span>{receipt.date}</span>
          </div>
          <div className="flex justify-between">
            <span>OPERADOR:</span>
            <span>{receipt.operator}</span>
          </div>
          <div className="flex justify-between">
            <span>PAGAMENTO:</span>
            <strong className="uppercase">{receipt.paymentMethod}</strong>
          </div>
        </div>

        {/* Dados do Cliente */}
        {receipt.customer && (
          <div className="border-b border-dashed border-slate-400 pb-2 mb-2 text-[11px] space-y-0.5">
            <p className="font-bold uppercase">CLIENTE: {receipt.customer.name}</p>
            {receipt.customer.cpf && <p>CPF: {receipt.customer.cpf}</p>}
            {receipt.customer.phone && <p>FONE: {receipt.customer.phone}</p>}
            {isCrediario && receipt.customer.newDebt !== undefined && (
              <div className="mt-1 pt-1 border-t border-dotted border-slate-300 flex justify-between">
                <span>SALDO CREDIÁRIO ATUAL:</span>
                <strong>{formatBRL(receipt.customer.newDebt)}</strong>
              </div>
            )}
          </div>
        )}

        {/* Itens */}
        <div className="border-b border-dashed border-slate-400 pb-2 mb-2">
          <div className="flex justify-between font-bold text-[11px] border-b border-dotted border-slate-300 pb-1 mb-1">
            <span>ITEM / QTD x UNIT</span>
            <span>TOTAL</span>
          </div>
          <div className="space-y-1.5">
            {receipt.items.map((item, idx) => (
              <div key={`${item.name}-${idx}`} className="text-[11px]">
                <div className="font-semibold">
                  {String(idx + 1).padStart(2, '0')}. {item.name}
                </div>
                <div className="flex justify-between pl-4 text-slate-700">
                  <span>
                    {item.quantity} {item.unit || 'un'} x {formatBRL(item.unitPrice)}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    {formatBRL(item.subtotal)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totais */}
        <div className="space-y-0.5 text-[11px] border-b border-dashed border-slate-400 pb-2 mb-2">
          <div className="flex justify-between">
            <span>SUBTOTAL:</span>
            <span className="tabular-nums">{formatBRL(receipt.subtotal)}</span>
          </div>
          {receipt.discount > 0 && (
            <div className="flex justify-between">
              <span>DESCONTO:</span>
              <span className="tabular-nums">- {formatBRL(receipt.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[14px] font-bold pt-1">
            <span>TOTAL A PAGAR:</span>
            <span className="tabular-nums">{formatBRL(receipt.total)}</span>
          </div>
          {receipt.paymentMethod === 'Dinheiro' &&
            receipt.cashReceived !== undefined &&
            receipt.cashReceived > 0 && (
              <>
                <div className="flex justify-between pt-1">
                  <span>VALOR RECEBIDO:</span>
                  <span className="tabular-nums">{formatBRL(receipt.cashReceived)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>TROCO:</span>
                  <span className="tabular-nums">{formatBRL(receipt.changeDue || 0)}</span>
                </div>
              </>
            )}
        </div>

        {/* Assinatura (1ª Via Estabelecimento) */}
        {requireSignature ? (
          <div className="pt-2 text-center space-y-2">
            <p className="text-[10px] text-slate-700 leading-snug">
              {isCrediario
                ? 'Reconheço e confesso a dívida referente aos itens acima descritos para pagamento no crediário.'
                : 'Confirmo o recebimento das mercadorias descritas neste cupom.'}
            </p>
            <div className="pt-6 border-b border-slate-800 w-11/12 mx-auto" />
            <p className="text-[11px] font-bold uppercase">
              {receipt.customer?.name || 'Assinatura do Cliente'}
            </p>
            {receipt.customer?.cpf && (
              <p className="text-[10px] text-slate-600">CPF: {receipt.customer.cpf}</p>
            )}
          </div>
        ) : (
          <div className="pt-1 text-center text-[10px] text-slate-600">
            <p>{store.mensagem_cupom || 'Obrigado pela preferência! Volte sempre.'}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header do Modal (não sai na impressão) */}
        <div className="no-print px-5 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary-container">receipt_long</span>
            <div>
              <h3 className="font-headline-sm font-bold text-primary">
                Cupom da Venda {receipt.cupom}
              </h3>
              <p className="font-body-sm text-on-surface-variant">
                {twoCopies ? '2 Vias (Estabelecimento com assinatura + Cliente)' : '1 Via'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant"
            aria-label="Fechar cupom"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Barra de Opções (não sai na impressão) */}
        <div className="no-print px-5 py-2.5 bg-white border-b border-surface-container flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTwoCopies(true)}
              className={`px-3 py-1.5 rounded-lg font-label-sm font-bold transition-colors ${
                twoCopies
                  ? 'bg-primary-container text-white'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              2 Vias (Assinatura)
            </button>
            <button
              type="button"
              onClick={() => setTwoCopies(false)}
              className={`px-3 py-1.5 rounded-lg font-label-sm font-bold transition-colors ${
                !twoCopies
                  ? 'bg-primary-container text-white'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              1 Via
            </button>
          </div>

          <button
            type="button"
            disabled={printing}
            onClick={() => void handlePrint(twoCopies)}
            className="px-4 py-1.5 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-60 text-[#0F172A] font-label-md font-extrabold flex items-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">print</span>
            <span>{printing ? 'Enviando...' : `Imprimir ${twoCopies ? '2 Vias' : 'Cupom'}`}</span>
          </button>
        </div>

        {printStatus && (
          <div
            className={`no-print px-5 py-2 text-xs font-bold border-b ${
              printStatus.ok
                ? 'bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary'
                : 'bg-error-container/40 border-error/30 text-error'
            }`}
          >
            {printStatus.text}
          </div>
        )}

        {/* Área Imprimível */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-100">
          <div
            className={`receipt-print-area ${
              bobinaWidth === '58mm' ? 'bobina-58mm max-w-[260px]' : 'max-w-[340px]'
            } mx-auto space-y-4`}
          >
            {renderVia(
              isCrediario ? '1ª Via — Estabelecimento (Assinar)' : 'Cupom Não Fiscal',
              isCrediario
            )}

            {twoCopies && (
              <>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono select-none">
                  <div className="flex-1 border-t border-dashed border-slate-400" />
                  <span>✂ CORTE AQUI</span>
                  <div className="flex-1 border-t border-dashed border-slate-400" />
                </div>
                {renderVia('2ª Via — Cliente', false)}
              </>
            )}
          </div>
        </div>

        {/* Rodapé do Modal (não sai na impressão) */}
        <div className="no-print px-5 py-3 border-t border-surface-container bg-white flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-on-surface-variant hover:bg-surface-container-low"
          >
            Diálogo do Navegador
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 font-label-md font-bold hover:bg-surface-container-low"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={printing}
              onClick={() => void handlePrint(twoCopies)}
              className="px-5 py-2 rounded-lg bg-primary-container disabled:opacity-60 text-white font-label-md font-bold flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>{printing ? 'Enviando...' : 'Imprimir Agora'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
