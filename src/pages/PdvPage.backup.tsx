import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { PaymentMethod, Product } from '../types/erp';

interface CartItem {
  product: Product;
  quantity: number;
}

const paymentMethods: PaymentMethod[] = ['PIX', 'Débito', 'Crédito', 'Dinheiro', 'Crediário'];

export function PdvPage() {
  const navigate = useNavigate();
  const { products, customers, currentUser, refreshData } = useErp();
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [customerId, setCustomerId] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode.includes(query) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
  );

  function addToCart(product: Product) {
    setFeedback(null);
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function updateQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  const total = cart.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0);
  const itemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const handleFinalizeSale = useCallback(async () => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    const cupomNum = `#00${Math.floor(4822 + Math.random() * 5000)}`;
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cupom: cupomNum,
          paymentMethod,
          customerId: paymentMethod === 'Crediário' ? customerId : undefined,
          operatorId: currentUser?.id,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            salePrice: i.product.salePrice,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao finalizar venda');

      await refreshData();
      setFeedback({
        type: 'ok',
        text: `Venda ${cupomNum} (${formatBRL(total)}) salva no PostgreSQL via ${paymentMethod}! Estoque e caixa atualizados.`,
      });
      setCart([]);
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }, [cart, submitting, paymentMethod, customerId, currentUser?.id, refreshData, total]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F4') {
        e.preventDefault();
        void handleFinalizeSale();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFinalizeSale]);

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="h-16 bg-primary-container text-white px-space-lg flex items-center justify-between shadow-md">
        <div className="flex items-center gap-space-md">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 font-label-md transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>Voltar ao ERP</span>
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary-fixed">point_of_sale</span>
            <span className="font-headline-sm font-bold">PDV — Frente de Caixa 01</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-tertiary-fixed text-tertiary px-3 py-1 rounded-full font-label-sm font-bold uppercase">
            Operador: {currentUser?.nome ?? 'Maria Clara'}
          </span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-space-md p-space-md lg:p-space-lg">
        <section className="lg:col-span-7 flex flex-col gap-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200 shadow-sm">
            <label htmlFor="pdv-scanner" className="sr-only">
              Ler código de barras ou buscar produto
            </label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-secondary text-[24px]">
                barcode_scanner
              </span>
              <input
                id="pdv-scanner"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && filteredProducts.length === 1) {
                    e.preventDefault();
                    addToCart(filteredProducts[0]);
                    setQuery('');
                  }
                }}
                placeholder="Bipe o código de barras ou digite o nome do produto..."
                className="w-full h-12 pl-12 pr-4 rounded-lg border-2 border-secondary/40 focus:border-secondary focus:ring-4 focus:ring-tertiary-fixed/40 focus:outline-none font-body-lg"
                autoFocus
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200 hover:border-primary-container hover:shadow-md text-left transition-all active:scale-[0.98] flex flex-col justify-between min-h-[115px]"
              >
                <div>
                  <span className="font-label-sm text-secondary uppercase">{product.category}</span>
                  <p className="font-label-lg font-bold text-on-surface mt-0.5 line-clamp-2">
                    {product.name}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="font-headline-sm font-extrabold text-primary tabular-nums">
                    {formatBRL(product.salePrice)}
                  </span>
                  <span className="font-body-sm text-on-surface-variant">
                    Est: {product.stock} {product.unit}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-space-md border-b border-surface-container flex items-center justify-between bg-surface-container-low">
            <h2 className="font-headline-sm font-bold text-primary">Cupom Atual</h2>
            <span className="font-label-md text-on-surface-variant">{itemsCount} itens</span>
          </div>

          <div className="flex-1 p-space-md space-y-space-sm overflow-y-auto max-h-[380px]">
            {feedback && (
              <div
                className={`p-4 rounded-xl border font-label-md ${
                  feedback.type === 'ok'
                    ? 'bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary'
                    : 'bg-error-container border-error/30 text-on-error-container'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {cart.length === 0 && !feedback && (
              <div className="py-12 text-center text-on-surface-variant font-body-md">
                Nenhum item no carrinho. Bipe ou clique em um produto ao lado.
              </div>
            )}

            {cart.map((item) => (
              <div
                key={item.product.id}
                className="p-3 rounded-lg border border-primary/20 bg-primary-fixed/15 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-label-lg font-bold text-on-surface">
                    {item.product.name}
                  </span>
                  <span className="font-label-lg font-bold text-primary tabular-nums">
                    {formatBRL(item.product.salePrice * item.quantity)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body-sm text-on-surface-variant tabular-nums">
                    {formatBRL(item.product.salePrice)} / {item.product.unit}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, -1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-surface-container"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-label-lg font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-slate-200 font-bold hover:bg-surface-container"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-space-lg border-t border-surface-container bg-surface-container-low space-y-space-md">
            <div>
              <span className="font-label-sm uppercase text-on-surface-variant block mb-2">
                Forma de Pagamento
              </span>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {paymentMethods.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-2 rounded-lg font-label-md font-bold transition-colors ${
                      paymentMethod === method
                        ? 'bg-secondary text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'Crediário' && (
              <div>
                <label htmlFor="pdv-customer" className="block font-label-sm uppercase text-on-surface-variant mb-1">
                  Cliente (Crediário)
                </label>
                <select
                  id="pdv-customer"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="">Selecione o cliente...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Disp: {formatBRL(Math.max(0, c.creditLimit - c.currentDebt))})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
              <span className="font-headline-sm font-bold text-on-surface">TOTAL A PAGAR</span>
              <span className="font-numeric-total text-primary tabular-nums">{formatBRL(total)}</span>
            </div>

            <button
              type="button"
              onClick={() => void handleFinalizeSale()}
              disabled={cart.length === 0 || submitting}
              className="w-full py-3.5 rounded-xl bg-tertiary-fixed hover:bg-tertiary-fixed-dim disabled:opacity-50 text-tertiary font-headline-sm font-extrabold shadow-md transition-all active:scale-[0.98]"
            >
              {submitting ? 'Processando...' : `Finalizar Venda (${paymentMethod}) — F4`}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
