import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { PaymentMethod, Product } from '../types/erp';
import { Modal, PasswordInput } from '../components/ui/SharedUI';
import { ReceiptModal, type ReceiptData } from '../components/ReceiptModal';
import { maskCpf, maskPhone, cpfError, phoneError } from '../utils/masks';

interface CartItem {
  product: Product;
  quantity: number;
}

const paymentMethods: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: 'PIX', label: 'PIX', icon: 'qr_code_2' },
  { id: 'Débito', label: 'Débito', icon: 'credit_card' },
  { id: 'Crédito', label: 'Crédito', icon: 'payments' },
  { id: 'Dinheiro', label: 'Dinheiro', icon: 'attach_money' },
  { id: 'Crediário', label: 'Crediário', icon: 'menu_book' },
];

export function PdvPage() {
  const navigate = useNavigate();
  const { products, categories, customers, shifts, currentUser, company, login, logout, addCustomer, refreshData } = useErp();
  const scannerRef = useRef<HTMLInputElement>(null);

  const [switchOpen, setSwitchOpen] = useState(false);
  const [opEmail, setOpEmail] = useState('');
  const [opPass, setOpPass] = useState('');
  const [opError, setOpError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const [crediarioModalOpen, setCrediarioModalOpen] = useState(false);
  const [crediarioTab, setCrediarioTab] = useState<'buscar' | 'cadastrar'>('buscar');
  const [cliSearch, setCliSearch] = useState('');
  const [newCliName, setNewCliName] = useState('');
  const [newCliPhone, setNewCliPhone] = useState('');
  const [newCliCpf, setNewCliCpf] = useState('');
  const [newCliLimit, setNewCliLimit] = useState('300');
  const [savingCli, setSavingCli] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [qtyMultiplier, setQtyMultiplier] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<{ name: string; qty: number; unit: string; total: number } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [authorizerPin, setAuthorizerPin] = useState('');
  const [pinReason, setPinReason] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const openShift = shifts.find((s) => s.status === 'Aberto');

  useEffect(() => {
    if (feedback?.type !== 'err') return;
    const timer = setTimeout(() => {
      setFeedback((prev) => (prev?.type === 'err' ? null : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'Todos' || p.category === selectedCategory;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const addToCart = useCallback(
    (product: Product, customQty?: number) => {
      const qtyToAdd = customQty ?? qtyMultiplier;
      setFeedback(null);
      setLastScanned({
        name: product.name,
        qty: qtyToAdd,
        unit: product.unit,
        total: product.salePrice * qtyToAdd,
      });
      setCart((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id ? { ...item, quantity: item.quantity + qtyToAdd } : item
          );
        }
        return [...prev, { product, quantity: qtyToAdd }];
      });
      setQtyMultiplier(1);
    },
    [qtyMultiplier]
  );

  function handleScannerKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;

    // Suporta formato multiplicador: 3*7894900011517
    let mult = qtyMultiplier;
    let code = raw;
    if (raw.includes('*')) {
      const [mPart, cPart] = raw.split('*');
      const parsed = Number(mPart);
      if (parsed > 0 && cPart) {
        mult = parsed;
        code = cPart.trim();
      }
    }

    const exact = products.find(
      (p) => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase()
    );
    if (exact) {
      addToCart(exact, mult);
      setQuery('');
      return;
    }

    if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0], mult);
      setQuery('');
    }
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

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }

  const subtotal = cart.reduce((acc, item) => acc + item.product.salePrice * item.quantity, 0);
  const discountVal = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountVal);
  const itemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cashVal = Number(cashReceived) || 0;
  const changeDue = paymentMethod === 'Dinheiro' && cashVal > total ? cashVal - total : 0;

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleFinalizeSale = useCallback(async (overridePin?: string) => {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setFeedback(null);
    setPinError(null);
    const cupomNum = `#00${Math.floor(4822 + Math.random() * 5000)}`;
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cupom: cupomNum,
          paymentMethod,
          discount: discountVal,
          customerId: paymentMethod === 'Crediário' ? customerId : undefined,
          operatorId: currentUser?.id,
          authorizerPin: overridePin || undefined,
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            salePrice: i.product.salePrice,
          })),
        }),
      });
      const rawText = await res.text();
      let body: Record<string, any> = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error('Resposta inválida do servidor. Verifique se a API está rodando.');
      }
      if (!res.ok) {
        if (body?.requiresPin) {
          setPinReason(body.reason || 'Limite insuficiente ou cliente bloqueado no Crediário');
          if (overridePin) {
            setPinError(body.error || 'PIN inválido ou sem permissão.');
          } else {
            setAuthorizerPin('');
          }
          setPinModalOpen(true);
          return;
        }
        throw new Error(
          body.error ||
            (res.status >= 500
              ? 'Erro ao conectar com o servidor da API. Verifique se o backend está ativo.'
              : 'Erro ao finalizar venda')
        );
      }

      await refreshData();
      const receiptPayload: ReceiptData = {
        cupom: cupomNum,
        date: new Date().toLocaleString('pt-BR'),
        operator: currentUser?.nome ?? 'Operador',
        paymentMethod,
        items: cart.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          unit: i.product.unit,
          unitPrice: i.product.salePrice,
          subtotal: i.product.salePrice * i.quantity,
        })),
        subtotal,
        discount: discountVal,
        total,
        cashReceived: paymentMethod === 'Dinheiro' ? cashVal : undefined,
        changeDue: paymentMethod === 'Dinheiro' ? changeDue : undefined,
        customer:
          paymentMethod === 'Crediário' && selectedCustomer
            ? {
                name: selectedCustomer.name,
                cpf: selectedCustomer.cpf,
                phone: selectedCustomer.phone,
                previousDebt: selectedCustomer.currentDebt,
                newDebt: selectedCustomer.currentDebt + total,
                creditLimit: selectedCustomer.creditLimit,
              }
            : undefined,
      };
      setLastReceipt(receiptPayload);
      if (paymentMethod === 'Crediário') {
        setReceiptOpen(true);
      }

      const trocoInfo = changeDue > 0 ? ` • Troco: ${formatBRL(changeDue)}` : '';
      const authInfo = body.authorizedBy ? ` • Autorizado por ${body.authorizedBy}` : '';
      setFeedback({
        type: 'ok',
        text: `Cupom ${cupomNum} (${formatBRL(total)}) finalizado via ${paymentMethod}${trocoInfo}${authInfo}!`,
      });
      setCart([]);
      setDiscount('0');
      setCashReceived('');
      setLastScanned(null);
      setCheckoutOpen(false);
      setPinModalOpen(false);
      setAuthorizerPin('');
      scannerRef.current?.focus();
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  }, [
    cart,
    submitting,
    paymentMethod,
    discountVal,
    subtotal,
    customerId,
    selectedCustomer,
    currentUser?.id,
    currentUser?.nome,
    refreshData,
    total,
    cashVal,
    changeDue,
  ]);

  const openCheckoutModal = useCallback(() => {
    if (cart.length === 0 || submitting) return;
    setFeedback(null);
    setCheckoutOpen(true);
  }, [cart.length, submitting]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault();
        scannerRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (!checkoutOpen && !crediarioModalOpen && !switchOpen && !receiptOpen) {
          openCheckoutModal();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        setCart([]);
        setLastScanned(null);
        setFeedback(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkoutOpen, crediarioModalOpen, switchOpen, receiptOpen, openCheckoutModal]);

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      {/* Toast Flutuante de Erro */}
      {feedback?.type === 'err' && (
        <div
          role="alert"
          className="fixed top-5 right-5 z-[80] max-w-md w-[calc(100%-2.5rem)] sm:w-auto flex items-center gap-3 px-4 py-3.5 rounded-xl bg-error text-white shadow-2xl border border-white/20 animate-in fade-in slide-in-from-top-2"
        >
          <span className="material-symbols-outlined text-[22px] shrink-0">error</span>
          <span className="font-label-md font-bold flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
            aria-label="Fechar aviso"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Header Profissional do PDV */}
      <header className="h-14 shrink-0 bg-primary-container text-white px-4 lg:px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 font-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>ERP</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary-fixed">point_of_sale</span>
            <span className="font-headline-sm font-bold tracking-tight">
              {company?.nome_fantasia || 'Mercadinho do Geleia'} — PDV 01
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold">
            <span>F2 Buscar</span>
            <span>•</span>
            <span>F4 Finalizar</span>
            <span>•</span>
            <span>F8 Limpar</span>
          </div>

          {openShift ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#A9F04D] text-[#0F172A] font-label-sm font-extrabold uppercase">
              <span className="w-2 h-2 rounded-full bg-[#0F172A]" />
              Caixa Aberto
            </span>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/fluxo-de-caixa/abertura-fechamento')}
              className="px-3 py-1 rounded-full bg-error text-white font-label-sm font-bold uppercase"
            >
              Caixa Fechado (Abrir)
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setOpError(null);
              setOpEmail('');
              setOpPass('');
              setSwitchOpen(true);
            }}
            title="Trocar Operador nesta aba"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 text-white font-label-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">person</span>
            <span>{currentUser?.nome ?? 'Operador'}</span>
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login?redirect=/pdv', { replace: true });
            }}
            title="Encerrar sessão do operador (mantém o caixa aberto)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error/80 hover:bg-error text-white font-label-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Split View: Esquerda (Catálogo & Scanner) | Direita (Cupom Fiscal) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* Coluna Esquerda (7 cols ~58%) */}
        <section className="lg:col-span-7 flex flex-col gap-3 min-h-0">
          {/* Barra de Scanner + Multiplicador */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-secondary text-[22px]">
                  barcode_scanner
                </span>
                <input
                  ref={scannerRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleScannerKeyDown}
                  placeholder="Bipe o EAN, digite Qtd*Código (ex: 3*789...) ou busque o produto..."
                  className="w-full h-12 pl-11 pr-4 rounded-lg border-2 border-secondary/40 focus:border-secondary focus:ring-4 focus:ring-tertiary-fixed/40 focus:outline-none font-body-md"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-slate-200">
                <span className="px-2 font-label-sm text-on-surface-variant uppercase">Qtd:</span>
                {[1, 2, 5, 10].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQtyMultiplier(q)}
                    className={`px-2.5 py-1.5 rounded-md font-label-md font-bold transition-colors ${
                      qtyMultiplier === q
                        ? 'bg-primary-container text-white'
                        : 'bg-white text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {q}x
                  </button>
                ))}
              </div>
            </div>

            {/* Visor do Último Item Bipado */}
            {lastScanned && (
              <div className="px-3 py-2 rounded-lg bg-primary-fixed/40 border border-primary-fixed flex items-center justify-between text-on-primary-fixed">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-[18px] text-primary-container">
                    check_circle
                  </span>
                  <span className="font-label-md font-bold truncate">
                    Último item: {lastScanned.qty} {lastScanned.unit} × {lastScanned.name}
                  </span>
                </div>
                <span className="font-label-lg font-extrabold text-primary tabular-nums shrink-0">
                  {formatBRL(lastScanned.total)}
                </span>
              </div>
            )}
          </div>

          {/* Filtros de Categoria */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedCategory('Todos')}
              className={`px-3.5 py-1.5 rounded-full font-label-md font-bold whitespace-nowrap transition-colors ${
                selectedCategory === 'Todos'
                  ? 'bg-primary-container text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-on-surface hover:bg-surface-container-low'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-1.5 rounded-full font-label-md font-bold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-secondary text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-on-surface hover:bg-surface-container-low'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Grade de Produtos Rápidos */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredProducts.map((product) => {
                const lowStock = product.stock <= product.minStock;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addToCart(product)}
                    className="bg-surface-container-lowest p-3.5 rounded-xl border border-slate-200 hover:border-primary-container hover:shadow-md text-left transition-all active:scale-[0.98] flex flex-col justify-between min-h-[118px]"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-label-sm text-secondary uppercase font-bold">
                        {product.category}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-label-sm font-bold tabular-nums ${
                          lowStock
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {product.stock} {product.unit}
                      </span>
                    </div>

                    <p className="font-label-lg font-bold text-on-surface mt-1 line-clamp-2">
                      {product.name}
                    </p>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-container">
                      <span className="font-headline-sm font-extrabold text-primary tabular-nums">
                        {formatBRL(product.salePrice)}
                      </span>
                      <span className="w-7 h-7 rounded-lg bg-tertiary-fixed/50 text-tertiary flex items-center justify-center font-bold">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Coluna Direita (5 cols ~42%) — Cupom Fiscal & Checkout */}
        <section className="lg:col-span-5 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-container bg-surface-container-low flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary-container">receipt_long</span>
              <div>
                <h2 className="font-headline-sm font-bold text-primary leading-tight">Cupom Fiscal</h2>
                <span className="font-body-sm text-on-surface-variant">{itemsCount} itens lançados</span>
              </div>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCart([]);
                  setLastScanned(null);
                }}
                className="px-2.5 py-1 rounded-lg text-error bg-error-container/50 hover:bg-error-container font-label-sm font-bold"
              >
                Limpar (F8)
              </button>
            )}
          </div>

          {/* Lista de Itens do Cupom */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {feedback?.type === 'ok' && (
              <div className="p-3.5 rounded-xl border font-label-md font-bold flex items-center justify-between gap-2 bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary">
                <span>{feedback.text}</span>
                {lastReceipt && (
                  <button
                    type="button"
                    onClick={() => setReceiptOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-white font-label-sm font-bold shrink-0 flex items-center gap-1 hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Imprimir (2 Vias)</span>
                  </button>
                )}
              </div>
            )}

            {cart.length === 0 && feedback?.type !== 'ok' && (
              <div className="h-full flex flex-col items-center justify-center text-center py-10 text-on-surface-variant">
                <span className="material-symbols-outlined text-[42px] text-outline-variant mb-2">
                  shopping_cart
                </span>
                <p className="font-label-lg font-bold text-on-surface">Caixa Livre</p>
                <p className="font-body-sm mt-0.5">
                  Bipe um código de barras ou clique em um produto ao lado.
                </p>
              </div>
            )}

            {cart.map((item, idx) => (
              <div
                key={item.product.id}
                className="p-2.5 rounded-lg border border-slate-200 bg-surface-container-low/50 flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="font-label-sm text-on-surface-variant font-bold pt-0.5 tabular-nums">
                      {String(idx + 1).padStart(3, '0')}
                    </span>
                    <span className="font-label-md font-bold text-on-surface truncate">
                      {item.product.name}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product.id)}
                    className="text-on-surface-variant hover:text-error p-0.5"
                    title="Remover item"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pl-7">
                  <span className="font-body-sm text-on-surface-variant tabular-nums">
                    {formatBRL(item.product.salePrice)} / {item.product.unit}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, -1)}
                        className="w-7 h-7 rounded bg-white border border-slate-200 font-bold hover:bg-surface-container"
                      >
                        -
                      </button>
                      <span className="w-7 text-center font-label-md font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(item.product.id, 1)}
                        className="w-7 h-7 rounded bg-white border border-slate-200 font-bold hover:bg-surface-container"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-label-lg font-extrabold text-primary tabular-nums min-w-[78px] text-right">
                      {formatBRL(item.product.salePrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Rodapé de Pagamento e Total */}
          <div className="p-4 border-t border-surface-container bg-surface-container-low space-y-3 shrink-0">
            {/* Desconto & Subtotal */}
            <div className="flex items-center justify-between gap-3 text-body-sm">
              <div className="flex items-center gap-2">
                <label htmlFor="pdv-discount" className="font-label-sm uppercase text-on-surface-variant">
                  Desconto (R$):
                </label>
                <input
                  id="pdv-discount"
                  type="number"
                  min="0"
                  step="0.50"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 h-8 px-2 rounded-lg border border-slate-200 bg-white font-bold tabular-nums text-right"
                />
              </div>
              <span className="text-on-surface-variant tabular-nums">
                Subtotal: <strong>{formatBRL(subtotal)}</strong>
              </span>
            </div>

            {/* Total e Botão Finalizar (abre modal de pagamento) */}
            <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
              <span className="font-headline-sm font-bold text-on-surface">TOTAL A PAGAR</span>
              <span className="font-numeric-total text-primary tabular-nums">{formatBRL(total)}</span>
            </div>

            <button
              type="button"
              onClick={openCheckoutModal}
              disabled={cart.length === 0 || submitting}
              className="w-full py-3.5 rounded-xl bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-50 text-[#0F172A] font-headline-sm font-extrabold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">payments</span>
              <span>
                {submitting ? 'Processando...' : 'Finalizar Venda — F4'}
              </span>
            </button>
          </div>
        </section>
      </div>

      {/* Modal Central de Pagamento / Fechamento de Venda */}
      <Modal
        open={checkoutOpen}
        title="Fechar Venda — Escolher Pagamento"
        onClose={() => setCheckoutOpen(false)}
      >
        <div className="space-y-4">
          {/* Resumo do Valor */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-slate-200 flex items-center justify-between">
            <div>
              <p className="font-label-sm text-on-surface-variant uppercase">
                {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} • Subtotal {formatBRL(subtotal)}
                {discountVal > 0 ? ` • Desconto -${formatBRL(discountVal)}` : ''}
              </p>
              <p className="font-headline-sm font-bold text-on-surface mt-0.5">TOTAL A PAGAR</p>
            </div>
            <span className="font-numeric-total text-primary tabular-nums text-2xl font-extrabold">
              {formatBRL(total)}
            </span>
          </div>

          {/* Formas de Pagamento */}
          <div>
            <p className="font-label-md font-bold text-on-surface mb-2">Forma de Pagamento</p>
            <div className="grid grid-cols-5 gap-2">
              {paymentMethods.map((method) => {
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method.id);
                      if (method.id === 'Crediário' && !selectedCustomer) {
                        setCrediarioTab('buscar');
                        setCliSearch('');
                        setCrediarioModalOpen(true);
                      }
                    }}
                    className={`py-2.5 px-1 rounded-xl flex flex-col items-center gap-1 font-label-sm font-bold transition-all ${
                      active
                        ? 'bg-secondary text-white shadow-md'
                        : 'bg-white border border-slate-200 text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{method.icon}</span>
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo de Valor Recebido e Troco (Dinheiro) */}
          {paymentMethod === 'Dinheiro' && (
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="modal-pdv-cash" className="font-label-md font-bold text-on-surface">
                  Valor Recebido (R$):
                </label>
                <input
                  id="modal-pdv-cash"
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-36 h-11 px-3 rounded-lg border border-slate-200 font-bold text-lg tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashReceived(total.toFixed(2))}
                    className="px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold text-primary hover:bg-surface-container-high"
                  >
                    Exato
                  </button>
                  {[20, 50, 100, 200].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCashReceived(String(v))}
                      className="px-2.5 py-1 rounded-lg bg-surface-container text-xs font-bold text-primary hover:bg-surface-container-high"
                    >
                      R$ {v}
                    </button>
                  ))}
                </div>
                <div className="text-right">
                  <span className="font-label-sm text-on-surface-variant block">TROCO</span>
                  <span className="font-headline-sm font-extrabold text-tertiary tabular-nums">
                    {formatBRL(changeDue)}
                  </span>
                </div>
              </div>

              {cashReceived !== '' && cashVal < total && (
                <p className="font-body-sm text-error font-semibold">
                  Valor recebido ({formatBRL(cashVal)}) é menor que o total ({formatBRL(total)}).
                </p>
              )}
            </div>
          )}

          {/* Cliente do Crediário */}
          {paymentMethod === 'Crediário' && (
            <div className="space-y-2">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-3">
                {selectedCustomer ? (
                  <div className="min-w-0">
                    <p className="font-label-lg font-bold text-primary truncate">
                      {selectedCustomer.name}
                    </p>
                    <p className="font-body-sm text-on-surface-variant">
                      Saldo: {formatBRL(selectedCustomer.currentDebt)} / Limite:{' '}
                      {formatBRL(selectedCustomer.creditLimit)}
                    </p>
                  </div>
                ) : (
                  <span className="font-body-sm text-error font-semibold">
                    Selecione ou cadastre o cliente para lançar no Crediário
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCrediarioTab('buscar');
                    setCliSearch('');
                    setCrediarioModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-primary-fixed text-primary-container font-label-md font-bold shrink-0 hover:bg-primary-fixed-dim"
                >
                  {selectedCustomer ? 'Trocar' : 'Selecionar'}
                </button>
              </div>
              {selectedCustomer &&
                (selectedCustomer.status === 'Bloqueado' ||
                  selectedCustomer.creditLimit - selectedCustomer.currentDebt < total ||
                  selectedCustomer.creditLimit - selectedCustomer.currentDebt <= 0) && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-body-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0">
                      lock
                    </span>
                    <span>
                      Disponível:{' '}
                      <strong>
                        {formatBRL(selectedCustomer.creditLimit - selectedCustomer.currentDebt)}
                      </strong>{' '}
                      — exigirá <strong>PIN de autorização</strong> ao confirmar.
                    </span>
                  </div>
                )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
            <button
              type="button"
              onClick={() => setCheckoutOpen(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 font-label-md font-bold hover:bg-surface-container-low"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => void handleFinalizeSale()}
              disabled={
                submitting ||
                (paymentMethod === 'Crediário' && !selectedCustomer) ||
                (paymentMethod === 'Dinheiro' && cashReceived !== '' && cashVal < total)
              }
              className="px-5 py-2.5 rounded-xl bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-50 text-[#0F172A] font-headline-sm font-extrabold shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>
                {submitting ? 'Processando...' : `Confirmar Venda (${paymentMethod})`}
              </span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de Autorização por PIN (Limite Negativo / Baixo / Bloqueado) */}
      <Modal
        open={pinModalOpen}
        title="Autorização Necessária (PIN)"
        onClose={() => {
          setPinModalOpen(false);
          setPinError(null);
          setAuthorizerPin('');
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleFinalizeSale(authorizerPin);
          }}
          className="space-y-4"
        >
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
            <div className="flex items-center gap-2 font-label-md font-bold text-amber-800">
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span>{pinReason || 'Autorização de Gerente / Administrador'}</span>
            </div>
            {selectedCustomer && (
              <p className="font-body-sm">
                Cliente: <strong>{selectedCustomer.name}</strong> • Disponível:{' '}
                <strong>
                  {formatBRL(selectedCustomer.creditLimit - selectedCustomer.currentDebt)}
                </strong>{' '}
                • Compra: <strong>{formatBRL(total)}</strong>
              </p>
            )}
          </div>

          {pinError && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md font-bold">
              {pinError}
            </div>
          )}

          <div>
            <label htmlFor="pdv-auth-pin" className="block font-label-md font-bold mb-1">
              PIN Rápido do Gerente ou Proprietário *
            </label>
            <input
              id="pdv-auth-pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              required
              autoFocus
              value={authorizerPin}
              onChange={(e) => setAuthorizerPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full h-12 px-4 rounded-xl border border-slate-200 text-center text-2xl tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <p className="font-body-sm text-on-surface-variant mt-1">
              A liberação ficará registrada na venda e nos logs de auditoria com o nome do autorizador.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
            <button
              type="button"
              onClick={() => {
                setPinModalOpen(false);
                setPinError(null);
                setAuthorizerPin('');
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 font-label-md font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || authorizerPin.length < 4}
              className="px-5 py-2 rounded-lg bg-primary-container text-white font-label-md font-bold disabled:opacity-50"
            >
              {submitting ? 'Autorizando...' : 'Autorizar e Concluir Venda'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={switchOpen}
        title="Identificar / Trocar Operador do PDV"
        onClose={() => setSwitchOpen(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setOpError(null);
            setSwitching(true);
            try {
              await login(opEmail, opPass);
              setSwitchOpen(false);
              scannerRef.current?.focus();
            } catch (err) {
              setOpError((err as Error).message);
            } finally {
              setSwitching(false);
            }
          }}
          className="space-y-4"
        >
          {opError && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md font-bold">
              {opError}
            </div>
          )}
          <p className="font-body-sm text-on-surface-variant">
            A troca vale apenas para esta aba do navegador (não desconecta outras abas abertas).
          </p>
          <div>
            <label htmlFor="pdv-op-email" className="block font-label-md mb-1">
              E-mail do Operador
            </label>
            <input
              id="pdv-op-email"
              type="email"
              required
              value={opEmail}
              onChange={(e) => setOpEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200"
            />
          </div>
          <div>
            <label htmlFor="pdv-op-pass" className="block font-label-md mb-1">
              Senha
            </label>
            <PasswordInput
              id="pdv-op-pass"
              required
              value={opPass}
              onChange={(e) => setOpPass(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSwitchOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 font-label-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={switching}
              className="px-4 py-2 rounded-lg bg-primary-container text-white font-label-md font-bold"
            >
              {switching ? 'Validando...' : 'Confirmar Operador'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Central de Crediário (Buscar ou Cadastrar Cliente) */}
      <Modal
        open={crediarioModalOpen}
        title="Crediário — Selecionar ou Cadastrar Cliente"
        onClose={() => setCrediarioModalOpen(false)}
      >
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-surface-container pb-3">
            <button
              type="button"
              onClick={() => setCrediarioTab('buscar')}
              className={`flex-1 py-2 rounded-lg font-label-md font-bold transition-colors ${
                crediarioTab === 'buscar'
                  ? 'bg-primary-container text-white'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              Buscar Cliente
            </button>
            <button
              type="button"
              onClick={() => setCrediarioTab('cadastrar')}
              className={`flex-1 py-2 rounded-lg font-label-md font-bold transition-colors ${
                crediarioTab === 'cadastrar'
                  ? 'bg-primary-container text-white'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              }`}
            >
              + Cadastrar Novo
            </button>
          </div>

          {crediarioTab === 'buscar' ? (
            <div className="space-y-3">
              <input
                type="text"
                value={cliSearch}
                onChange={(e) => setCliSearch(e.target.value)}
                placeholder="Buscar por nome, telefone ou CPF..."
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
                autoFocus
              />

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(() => {
                  const filtered = customers.filter((c) => {
                    const q = cliSearch.trim().toLowerCase();
                    return (
                      !q ||
                      c.name.toLowerCase().includes(q) ||
                      c.phone.includes(q) ||
                      c.cpf.includes(q)
                    );
                  });
                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-on-surface-variant">
                        <span className="material-symbols-outlined text-[32px] text-outline-variant mb-2 block">person_search</span>
                        <p className="font-label-md font-bold">Nenhum cliente encontrado</p>
                        <p className="font-body-sm mt-1">Use a aba "＋ Cadastrar Novo" para adicionar.</p>
                      </div>
                    );
                  }
                  return filtered.map((c) => {
                    const disp = Math.max(0, c.creditLimit - c.currentDebt);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCustomerId(c.id);
                          setCrediarioModalOpen(false);
                        }}
                        className={`w-full p-3 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 ${
                          customerId === c.id
                            ? 'border-primary-container bg-primary-fixed/30'
                            : 'border-slate-200 hover:bg-surface-container-low'
                        }`}
                      >
                        <div>
                          <p className="font-label-lg font-bold text-on-surface">{c.name}</p>
                          <p className="font-body-sm text-on-surface-variant">
                            {c.phone} {c.cpf ? `• ${c.cpf}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-label-sm font-bold text-tertiary block tabular-nums">
                            Disp: {formatBRL(disp)}
                          </span>
                          <span className="font-body-sm text-on-surface-variant tabular-nums">
                            Deve: {formatBRL(c.currentDebt)}
                          </span>
                        </div>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const pErr = phoneError(newCliPhone, true);
                const cErr = cpfError(newCliCpf);
                if (pErr || cErr) {
                  setCliError(pErr || cErr);
                  return;
                }
                setSavingCli(true);
                setCliError(null);
                try {
                  const created = await addCustomer({
                    id: String(Date.now()),
                    name: newCliName.trim(),
                    phone: newCliPhone.trim(),
                    cpf: newCliCpf.trim(),
                    creditLimit: Number(newCliLimit) || 300,
                    currentDebt: 0,
                    status: 'Em dia',
                    lastPurchase: 'Hoje',
                  });
                  setCustomerId(created.id);
                  setNewCliName('');
                  setNewCliPhone('');
                  setNewCliCpf('');
                  setCrediarioModalOpen(false);
                } catch (err) {
                  setCliError((err as Error).message);
                } finally {
                  setSavingCli(false);
                }
              }}
              className="space-y-3"
            >
              {cliError && (
                <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md font-bold">
                  {cliError}
                </div>
              )}
              <div>
                <label htmlFor="pdv-new-cli-name" className="block font-label-md mb-1">
                  Nome Completo *
                </label>
                <input
                  id="pdv-new-cli-name"
                  required
                  value={newCliName}
                  onChange={(e) => setNewCliName(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pdv-new-cli-phone" className="block font-label-md mb-1">
                    Telefone / WhatsApp *
                  </label>
                  <input
                    id="pdv-new-cli-phone"
                    required
                    value={newCliPhone}
                    onChange={(e) => setNewCliPhone(maskPhone(e.target.value))}
                    placeholder="(11) 90000-0000"
                    maxLength={15}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label htmlFor="pdv-new-cli-cpf" className="block font-label-md mb-1">
                    CPF (Opcional)
                  </label>
                  <input
                    id="pdv-new-cli-cpf"
                    value={newCliCpf}
                    onChange={(e) => setNewCliCpf(maskCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pdv-new-cli-limit" className="block font-label-md mb-1">
                  Limite de Crédito (R$) *
                </label>
                <input
                  id="pdv-new-cli-limit"
                  type="number"
                  step="10"
                  required
                  value={newCliLimit}
                  onChange={(e) => setNewCliLimit(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCrediarioTab('buscar')}
                  className="px-4 py-2 rounded-lg border border-slate-200 font-label-md"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={savingCli}
                  className="px-4 py-2 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-md font-bold"
                >
                  {savingCli ? 'Salvando...' : 'Salvar e Selecionar'}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      <ReceiptModal
        open={receiptOpen}
        receipt={lastReceipt}
        onClose={() => {
          setReceiptOpen(false);
          scannerRef.current?.focus();
        }}
      />
    </div>
  );
}
