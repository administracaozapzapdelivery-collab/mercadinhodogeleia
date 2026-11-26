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

interface PrintableReceiptProps {
  receipt: ReceiptData;
  store: Partial<CompanyData>;
  twoCopies: boolean;
  bobinaWidth?: '80mm' | '58mm';
}

export function PrintableReceipt({
  receipt,
  store,
  twoCopies,
  bobinaWidth = '80mm',
}: PrintableReceiptProps) {
  const isCrediario = receipt.paymentMethod === 'Crediário';

  function renderVia(viaLabel: string, requireSignature: boolean) {
    return (
      <div className="bg-[#FFFDF5] text-slate-900 font-mono text-[12px] leading-relaxed p-4 border border-dashed border-slate-300 rounded-lg">
        {/* Cabeçalho da Loja */}
        <div className="text-center border-b border-dashed border-slate-400 pb-2 mb-2">
          <p className="font-bold text-[14px] uppercase tracking-wide">
            {store.nome_fantasia || 'Mercadinho do Geleia'}
          </p>
          {store.razao_social && <p className="text-[10px] text-slate-700">{store.razao_social}</p>}
          {store.cnpj && <p className="text-[11px]">CNPJ: {store.cnpj}</p>}
          {store.inscricao_estadual && <p className="text-[10px]">IE: {store.inscricao_estadual}</p>}
          {store.nome_proprietario && <p className="text-[10px]">Prop.: {store.nome_proprietario}</p>}
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

        {/* Assinatura (apenas Crediário) */}
        {requireSignature ? (
          <div className="pt-2 text-center space-y-2">
            <p className="text-[10px] text-slate-700 leading-snug">
              Reconheço e confesso a dívida referente aos itens acima descritos para pagamento no
              crediário.
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
    <div
      className={`receipt-print-area ${
        bobinaWidth === '58mm' ? 'bobina-58mm max-w-[260px]' : 'max-w-[340px]'
      } mx-auto space-y-4`}
    >
      {renderVia(isCrediario ? '1ª Via — Estabelecimento (Assinar)' : 'Cupom Não Fiscal', isCrediario)}

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
  );
}
