import { useCallback, useEffect, useState } from 'react';
import { useErp } from '../context/ErpContext';
import type { CompanyData } from '../types/erp';
import { PrintableReceipt, type ReceiptData, type ReceiptItem } from './PrintableReceipt';
import { printReceiptDirect } from '../utils/printClient';

export type { ReceiptData, ReceiptItem };

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
        const result = await printReceiptDirect({
          receipt,
          twoCopies: copies,
          store,
          printerName,
          width: bobinaWidth,
        });
        if (result.ok) {
          setPrintStatus({
            ok: true,
            text: `Cupom enviado para "${result.printerName}"!`,
          });
          return;
        }
        window.print();
      } catch {
        window.print();
      } finally {
        setPrinting(false);
      }
    },
    [receipt, store, printerName, bobinaWidth]
  );

  useEffect(() => {
    if (!open || !receipt || !autoPrint) return;
    const timer = setTimeout(() => {
      void handlePrint(true);
    }, 180);
    return () => clearTimeout(timer);
  }, [open, receipt, autoPrint, handlePrint]);

  if (!open || !receipt) return null;

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
          <PrintableReceipt
            receipt={receipt}
            store={store}
            twoCopies={twoCopies}
            bobinaWidth={bobinaWidth}
          />
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
