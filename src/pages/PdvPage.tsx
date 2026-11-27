import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { PaymentMethod, Product } from '../types/erp';
import { Modal, PasswordInput } from '../components/ui/SharedUI';
import { PrintableReceipt, type ReceiptData } from '../components/PrintableReceipt';
import { printReceiptDirect } from '../utils/printClient';
import { maskCpf, maskPhone, cpfError, phoneError } from '../utils/masks';

interface CartItem {
  product: Product;
  quantity: number;
}

interface ComandaItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OpenComanda {
  id: string;
  identificador: string;
  observacao: string;
  status: 'LIVRE' | 'ABERTA';
  cadastrada: boolean;
  createdAt: string;
  updatedAt: string;
  operator: string;
  items: ComandaItem[];
  total: number;
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
  const { products, customers, shifts, currentUser, company, login, logout, addCustomer, refreshData } = useErp();
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
  const [qtyMultiplier, setQtyMultiplier] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<string>('0');
  const [discountMode, setDiscountMode] = useState<'R$' | '%'>('R$');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<{ name: string; qty: number; unit: string; total: number } | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printConfirmOpen, setPrintConfirmOpen] = useState(false);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [authorizerPin, setAuthorizerPin] = useState('');
  const [pinReason, setPinReason] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [mpPixEnabled, setMpPixEnabled] = useState(false);
  const [pixGenerating, setPixGenerating] = useState(false);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixChecking, setPixChecking] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{
    paymentId: string;
    status: string;
    qrCode: string;
    qrCodeBase64: string;
    amount: number;
  } | null>(null);

  const [comandas, setComandas] = useState<OpenComanda[]>([]);
  const [comandasModalOpen, setComandasModalOpen] = useState(false);
  const [activeComanda, setActiveComanda] = useState<{ id: string; identificador: string } | null>(null);
  const [newComandaLabel, setNewComandaLabel] = useState('');
  const [newComandaNote, setNewComandaNote] = useState('');
  const [savingComanda, setSavingComanda] = useState(false);
  const [comandaError, setComandaError] = useState<string | null>(null);
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  const [priceCheckQuery, setPriceCheckQuery] = useState('');

  const loadComandas = useCallback(async () => {
    try {
      const res = await fetch('/api/comandas');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setComandas(data);
      }
    } catch {
      // ignora erro pontual de rede
    }
  }, []);

  useEffect(() => {
    void loadComandas();
  }, [loadComandas]);

  const todayBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const openShift = shifts.find((s) => s.status === 'Aberto' && s.openedAt?.startsWith(todayBr));

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config) {
          setMpPixEnabled(Boolean(data.config.mp_pix_ativo && data.config.has_mp_access_token));
        }
      })
      .catch(() => null);
  }, []);

  async function handleConfirmPrintReceipt(targetReceipt: ReceiptData) {
    setPrintingReceipt(true);
    setPrintError(null);
    try {
      const twoCopies = targetReceipt.paymentMethod === 'Crediário';
      const result = await printReceiptDirect({
        receipt: targetReceipt,
        twoCopies,
        store: company,
      });
      if (result.ok) {
        setPrintConfirmOpen(false);
        scannerRef.current?.focus();
        return;
      }
      if (result.fallbackBrowser) {
        setPrintConfirmOpen(false);
        setTimeout(() => {
          window.print();
          scannerRef.current?.focus();
        }, 120);
        return;
      }
      setPrintError(result.error || 'Não foi possível enviar para a impressora.');
    } catch {
      setPrintConfirmOpen(false);
      setTimeout(() => {
        window.print();
        scannerRef.current?.focus();
      }, 120);
    } finally {
      setPrintingReceipt(false);
    }
  }

  useEffect(() => {
    if (feedback?.type !== 'err') return;
    const timer = setTimeout(() => {
      setFeedback((prev) => (prev?.type === 'err' ? null : prev));
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  const filteredProducts = products.filter((p) => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q)
    );
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
  const rawDiscount = Math.max(0, Number(discount) || 0);
  const discountVal =
    discountMode === '%'
      ? Number(((subtotal * Math.min(100, rawDiscount)) / 100).toFixed(2))
      : rawDiscount;
  const total = Math.max(0, subtotal - discountVal);
  const itemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const cashVal = Number(cashReceived) || 0;
  const changeDue = paymentMethod === 'Dinheiro' && cashVal > total ? cashVal - total : 0;

  const selectedCustomer = customers.find((c) => c.id === customerId);

  const handleFinalizeSale = useCallback(async (overridePin?: string) => {
    if (cart.length === 0 || submitting) return;
    if (!openShift) {
      setFeedback({
        type: 'err',
        text: 'Nenhum caixa do dia aberto. Abra o caixa de hoje antes de realizar vendas.',
      });
      return;
    }
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

      if (activeComanda) {
        await fetch(`/api/comandas/${activeComanda.id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendaId: body.id }),
        }).catch(() => null);
        setActiveComanda(null);
        void loadComandas();
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
      setPrintError(null);
      setPrintConfirmOpen(true);

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
    openShift,
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
    activeComanda,
    loadComandas,
  ]);

  async function handleSaveNewComanda(e: React.FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || savingComanda) return;
    const label = newComandaLabel.trim();
    if (!label) {
      setComandaError('Informe o nome ou mesa da comanda.');
      return;
    }
    setSavingComanda(true);
    setComandaError(null);
    try {
      const res = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: label,
          observacao: newComandaNote.trim(),
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: i.product.salePrice,
          })),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setComandaError(body?.error ?? 'Erro ao salvar comanda.');
        return;
      }
      await loadComandas();
      setCart([]);
      setDiscount('0');
      setLastScanned(null);
      setNewComandaLabel('');
      setNewComandaNote('');
      setComandasModalOpen(false);
      setFeedback({ type: 'ok', text: `Comanda "${label}" salva e aberta!` });
      scannerRef.current?.focus();
    } finally {
      setSavingComanda(false);
    }
  }

  async function handleAssignToComanda(comandaId: string, label: string) {
    if (cart.length === 0 || savingComanda) return;
    setSavingComanda(true);
    setComandaError(null);
    try {
      const res = await fetch(`/api/comandas/${comandaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: i.product.salePrice,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setComandaError(body?.error ?? 'Erro ao lançar na comanda.');
        return;
      }
      await loadComandas();
      setCart([]);
      setDiscount('0');
      setLastScanned(null);
      setComandasModalOpen(false);
      setFeedback({ type: 'ok', text: `Itens lançados na comanda "${label}"!` });
      scannerRef.current?.focus();
    } finally {
      setSavingComanda(false);
    }
  }

  async function handleUpdateActiveComanda() {
    if (!activeComanda || cart.length === 0 || savingComanda) return;
    setSavingComanda(true);
    try {
      const res = await fetch(`/api/comandas/${activeComanda.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((i) => ({
            productId: i.product.id,
            quantity: i.quantity,
            unitPrice: i.product.salePrice,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFeedback({ type: 'err', text: body?.error ?? 'Erro ao atualizar comanda.' });
        return;
      }
      const label = activeComanda.identificador;
      await loadComandas();
      setCart([]);
      setDiscount('0');
      setLastScanned(null);
      setActiveComanda(null);
      setFeedback({ type: 'ok', text: `Comanda "${label}" atualizada!` });
      scannerRef.current?.focus();
    } finally {
      setSavingComanda(false);
    }
  }

  function handleLoadComanda(c: OpenComanda) {
    const loadedCart: CartItem[] = c.items.map((it) => {
      const found = products.find((p) => p.id === it.productId);
      const product: Product = found ?? {
        id: it.productId,
        sku: '',
        barcode: '',
        name: it.productName,
        category: 'Espetinhos e Jantinha',
        unit: (it.unit as Product['unit']) || 'un',
        costPrice: 0,
        salePrice: it.unitPrice,
        stock: 999,
        minStock: 0,
        abcClass: 'A',
      };
      return { product, quantity: it.quantity };
    });
    setCart(loadedCart);
    setActiveComanda({ id: c.id, identificador: c.identificador });
    setDiscount('0');
    setFeedback(null);
    setComandasModalOpen(false);
    scannerRef.current?.focus();
  }

  async function handleDeleteComanda(id: string) {
    await fetch(`/api/comandas/${id}`, { method: 'DELETE' });
    if (activeComanda?.id === id) {
      setActiveComanda(null);
    }
    await loadComandas();
  }

  async function handleStartPixPayment() {
    if (cart.length === 0 || pixGenerating || submitting) return;
    if (!openShift) {
      setFeedback({
        type: 'err',
        text: 'Nenhum caixa do dia aberto. Abra o caixa de hoje antes de realizar vendas.',
      });
      return;
    }
    setPixGenerating(true);
    setPixError(null);
    setPixCopied(false);
    try {
      const res = await fetch('/api/mercadopago/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total,
          description: `Venda PDV - Mercadinho e Lanchonete do Geleia (${itemsCount} itens)`,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.paymentId) {
        throw new Error(data?.error || 'Erro ao gerar QR Code PIX no Mercado Pago.');
      }
      setPixData({
        paymentId: data.paymentId,
        status: data.status || 'pending',
        qrCode: data.qrCode || '',
        qrCodeBase64: data.qrCodeBase64 || '',
        amount: total,
      });
      setCheckoutOpen(false);
      setPixModalOpen(true);
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setPixGenerating(false);
    }
  }

  const checkPixStatus = useCallback(
    async (paymentId: string) => {
      setPixChecking(true);
      try {
        const res = await fetch(`/api/mercadopago/pix/${paymentId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        setPixData((prev) => (prev ? { ...prev, status: data.status } : prev));
        if (data.status === 'approved') {
          setPixModalOpen(false);
          setPixData(null);
          await handleFinalizeSale();
        } else if (data.status === 'cancelled' || data.status === 'rejected') {
          setPixError(
            `Pagamento PIX ${data.status === 'cancelled' ? 'cancelado' : 'rejeitado'} no Mercado Pago.`
          );
        }
      } catch {
        // Ignora falha pontual de polling
      } finally {
        setPixChecking(false);
      }
    },
    [handleFinalizeSale]
  );

  useEffect(() => {
    if (!pixModalOpen || !pixData?.paymentId || pixData.status === 'approved') return;
    const timer = setInterval(() => {
      void checkPixStatus(pixData.paymentId);
    }, 3000);
    return () => clearInterval(timer);
  }, [pixModalOpen, pixData?.paymentId, pixData?.status, checkPixStatus]);

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
        if (!checkoutOpen && !crediarioModalOpen && !switchOpen && !printConfirmOpen) {
          openCheckoutModal();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        setCart([]);
        setLastScanned(null);
        setFeedback(null);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setPriceCheckQuery('');
        setPriceCheckOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [checkoutOpen, crediarioModalOpen, switchOpen, printConfirmOpen, openCheckoutModal]);

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
      <header className="h-14 shrink-0 bg-primary-container text-white px-3 sm:px-4 lg:px-6 flex items-center justify-between gap-2 shadow-md">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 h-8 rounded-lg bg-white/15 hover:bg-white/25 font-label-md font-semibold transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            <span>ERP</span>
          </button>
          <div className="hidden xl:flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-tertiary-fixed shrink-0">point_of_sale</span>
            <span className="font-headline-sm font-bold tracking-tight truncate">
              {company?.nome_fantasia || 'Mercadinho do Geleia'} — PDV 01
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
          <div className="hidden xl:flex items-center gap-1.5 px-3 h-8 rounded-full bg-white/10 text-xs font-semibold whitespace-nowrap shrink-0">
            <span>F2 Buscar</span>
            <span>•</span>
            <span>F4 Finalizar</span>
            <span>•</span>
            <span>F8 Limpar</span>
            <span>•</span>
            <span>F9 Preço</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setPriceCheckQuery('');
              setPriceCheckOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white font-label-sm font-extrabold uppercase whitespace-nowrap shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">price_check</span>
            <span>Consultar Preço</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setComandaError(null);
              void loadComandas();
              setComandasModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-900 font-label-sm font-extrabold uppercase whitespace-nowrap shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">receipt_long</span>
            <span>
              Comandas ({comandas.filter((c) => c.status === 'ABERTA').length}/{comandas.length})
            </span>
          </button>

          {openShift ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-full bg-[#A9F04D] text-[#0F172A] font-label-sm font-extrabold uppercase whitespace-nowrap shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#0F172A] shrink-0" />
              Caixa Aberto
            </span>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/fluxo-de-caixa/abertura-fechamento')}
              className="px-2.5 sm:px-3 h-8 rounded-full bg-error text-white font-label-sm font-bold uppercase whitespace-nowrap shrink-0"
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
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white font-label-sm font-bold whitespace-nowrap shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] shrink-0">person</span>
            <span className="max-w-[100px] lg:max-w-[150px] truncate">{currentUser?.nome ?? 'Operador'}</span>
            <span className="material-symbols-outlined text-[14px] shrink-0">swap_horiz</span>
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login?redirect=/pdv', { replace: true });
            }}
            title="Encerrar sessão do operador (mantém o caixa aberto)"
            className="inline-flex items-center gap-1 px-2.5 h-8 rounded-full bg-error/80 hover:bg-error text-white font-label-sm font-bold whitespace-nowrap shrink-0 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px] shrink-0">logout</span>
            <span>Sair</span>
          </button>
        </div>
      </header>

      {/* Split View: Esquerda (Catálogo & Scanner) | Direita (Cupom Fiscal) */}
      <div className="flex-1 min-h-0 flex flex-col xl:grid xl:grid-cols-12 gap-4 p-4">
        {/* Coluna Esquerda (7 cols ~58%) */}
        <section
          className={`${
            query.trim() ? 'flex-1 min-h-0' : 'shrink-0'
          } xl:col-span-7 flex flex-col gap-3 xl:min-h-0`}
        >
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

          {/* Busca por Nome / Identidade da Loja no PDV */}
          {query.trim() ? (
            <div className="flex-1 min-h-0 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface-container bg-surface-container-low flex items-center justify-between">
                <span className="font-label-md font-bold text-primary">
                  Resultados para &ldquo;{query.trim()}&rdquo; ({filteredProducts.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    scannerRef.current?.focus();
                  }}
                  className="text-xs font-bold text-secondary hover:underline"
                >
                  Limpar busca
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                {filteredProducts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-10 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[40px] text-outline-variant mb-2">
                      search_off
                    </span>
                    <p className="font-label-lg font-bold text-on-surface">
                      Nenhum produto encontrado
                    </p>
                    <p className="font-body-sm mt-0.5">
                      Verifique o nome, SKU ou código de barras digitado.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {filteredProducts.slice(0, 30).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          addToCart(p);
                          setQuery('');
                          scannerRef.current?.focus();
                        }}
                        className="text-left p-3 rounded-xl border border-slate-200 bg-surface-container-low/40 hover:bg-primary-fixed/30 hover:border-primary/40 transition-all flex flex-col justify-between gap-2"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-label-sm uppercase text-secondary font-bold truncate">
                              {p.category}
                            </span>
                            <span className="font-label-sm text-on-surface-variant tabular-nums shrink-0">
                              {p.stock} {p.unit}
                            </span>
                          </div>
                          <p className="font-label-md font-bold text-on-surface mt-0.5 line-clamp-2">
                            {p.name}
                          </p>
                          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                            {p.barcode || p.sku}
                          </p>
                        </div>
                        <div className="flex items-baseline justify-between pt-1.5 border-t border-surface-container">
                          <span className="font-headline-sm font-extrabold text-primary tabular-nums">
                            {formatBRL(p.salePrice)}
                          </span>
                          <span className="text-xs font-bold text-tertiary">+ Adicionar</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden xl:flex flex-1 min-h-0 items-center justify-center bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm p-8">
              <div className="text-center flex flex-col items-center">
                <div className="w-24 h-24 rounded-2xl bg-primary-container text-white flex flex-col items-center justify-center shadow-lg mb-5 ring-4 ring-tertiary-fixed/60">
                  <span className="material-symbols-outlined text-[42px] text-tertiary-fixed">
                    storefront
                  </span>
                </div>
                <h2 className="font-headline-md text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
                  Mercadinho e Lanchonete do Geleia
                </h2>
              </div>
            </div>
          )}
        </section>

        {/* Coluna Direita (5 cols ~42%) — Cupom Fiscal & Checkout */}
        <section className="flex-1 xl:col-span-5 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
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
            {activeComanda && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-amber-700 text-[18px]">
                    restaurant
                  </span>
                  <span className="font-label-md font-bold text-amber-900 truncate">
                    Comanda: {activeComanda.identificador}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveComanda(null)}
                  className="px-2 py-1 rounded bg-white border border-amber-200 text-amber-900 font-label-sm font-bold hover:bg-amber-100 shrink-0"
                >
                  Desvincular
                </button>
              </div>
            )}
            {feedback?.type === 'ok' && (
              <div className="p-3.5 rounded-xl border font-label-md font-bold flex items-center justify-between gap-2 bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary">
                <span>{feedback.text}</span>
                {lastReceipt && (
                  <button
                    type="button"
                    onClick={() => {
                      setPrintError(null);
                      setPrintConfirmOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-primary-container text-white font-label-sm font-bold shrink-0 flex items-center gap-1 hover:opacity-90"
                  >
                    <span className="material-symbols-outlined text-[16px]">print</span>
                    <span>Imprimir Cupom</span>
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
            <div className="flex items-center justify-between gap-3 text-body-sm flex-wrap">
              <div className="flex items-center gap-2">
                <label htmlFor="pdv-discount" className="font-label-sm uppercase text-on-surface-variant">
                  Desconto:
                </label>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                  {(['R$', '%'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setDiscountMode(mode);
                        setDiscount('0');
                      }}
                      className={`px-2 py-0.5 rounded-md text-xs font-bold transition-colors ${
                        discountMode === mode
                          ? 'bg-primary-container text-white'
                          : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <input
                  id="pdv-discount"
                  type="number"
                  min="0"
                  max={discountMode === '%' ? 100 : undefined}
                  step={discountMode === '%' ? '1' : '0.50'}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 h-8 px-2 rounded-lg border border-slate-200 bg-white font-bold tabular-nums text-right"
                />
                {discountMode === '%' && discountVal > 0 && (
                  <span className="text-xs font-semibold text-error tabular-nums">
                    (-{formatBRL(discountVal)})
                  </span>
                )}
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

            {cart.length > 0 && (
              <button
                type="button"
                disabled={savingComanda}
                onClick={() => {
                  if (activeComanda) {
                    void handleUpdateActiveComanda();
                  } else {
                    setComandaError(null);
                    void loadComandas();
                    setComandasModalOpen(true);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-950 border border-amber-300 font-label-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                <span>
                  {activeComanda
                    ? savingComanda
                      ? 'Salvando Comanda...'
                      : `Atualizar Comanda (${activeComanda.identificador})`
                    : 'Salvar em Comanda (Mesa / Cliente)'}
                </span>
              </button>
            )}
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

          {paymentMethod === 'PIX' && mpPixEnabled && (
            <div className="p-3.5 rounded-xl bg-secondary/10 border border-secondary/30 flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[22px] shrink-0">
                qr_code_2
              </span>
              <p className="font-body-sm text-on-surface">
                <strong>Somente PIX (Mercado Pago):</strong> ao confirmar, o QR Code será exibido na
                tela para o cliente pagar.
              </p>
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
              onClick={() => {
                if (paymentMethod === 'PIX' && mpPixEnabled) {
                  void handleStartPixPayment();
                } else {
                  void handleFinalizeSale();
                }
              }}
              disabled={
                submitting ||
                pixGenerating ||
                (paymentMethod === 'Crediário' && !selectedCustomer) ||
                (paymentMethod === 'Dinheiro' && cashReceived !== '' && cashVal < total)
              }
              className="px-5 py-2.5 rounded-xl bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-50 text-[#0F172A] font-headline-sm font-extrabold shadow-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">
                {paymentMethod === 'PIX' && mpPixEnabled ? 'qr_code_2' : 'check_circle'}
              </span>
              <span>
                {pixGenerating
                  ? 'Gerando QR Code...'
                  : submitting
                    ? 'Processando...'
                    : paymentMethod === 'PIX' && mpPixEnabled
                      ? 'Gerar QR Code PIX'
                      : `Confirmar Venda (${paymentMethod})`}
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
                    const nomeNorm = c.name.trim().toLowerCase();
                    if (nomeNorm === 'venda no balcão' || nomeNorm === 'vendas no balcão') {
                      return false;
                    }
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

      {/* Modal de Pagamento PIX (Mercado Pago — Somente PIX) */}
      <Modal
        open={pixModalOpen && Boolean(pixData)}
        title="Pagamento via PIX — Mercado Pago"
        onClose={() => {
          setPixModalOpen(false);
          setPixData(null);
          setPixError(null);
        }}
      >
        {pixData && (
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 text-secondary font-label-sm font-extrabold uppercase">
              <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
              <span>Somente PIX • Mercado Pago</span>
            </div>

            <div>
              <p className="font-label-sm text-on-surface-variant">Valor a Pagar</p>
              <p className="font-headline-lg text-3xl font-extrabold text-primary tabular-nums">
                {formatBRL(pixData.amount)}
              </p>
            </div>

            {pixData.qrCodeBase64 && (
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX Mercado Pago"
                  className="w-60 h-60 rounded-xl border-2 border-slate-200 p-2 bg-white shadow-sm"
                />
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-secondary font-label-md font-bold">
              <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
              <span>
                {pixChecking
                  ? 'Verificando pagamento...'
                  : 'Aguardando pagamento do cliente (atualiza a cada 3s)...'}
              </span>
            </div>

            {pixData.qrCode && (
              <div className="text-left bg-surface-container-low p-3 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm font-bold text-on-surface-variant uppercase">
                    PIX Copia e Cola
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(pixData.qrCode);
                      setPixCopied(true);
                      setTimeout(() => setPixCopied(false), 2000);
                    }}
                    className="text-xs font-bold text-primary-container hover:underline"
                  >
                    {pixCopied ? 'Copiado!' : 'Copiar código'}
                  </button>
                </div>
                <p className="font-mono text-[11px] break-all text-on-surface line-clamp-2">
                  {pixData.qrCode}
                </p>
              </div>
            )}

            {pixError && (
              <div className="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error font-label-md font-bold">
                {pixError}
              </div>
            )}

            <div className="flex flex-wrap justify-between gap-2 pt-2 border-t border-surface-container">
              <button
                type="button"
                onClick={() => {
                  setPixModalOpen(false);
                  setPixData(null);
                  setPixError(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 font-label-md font-bold hover:bg-surface-container-low"
              >
                Cancelar PIX
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pixChecking}
                  onClick={() => void checkPixStatus(pixData.paymentId)}
                  className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md font-bold disabled:opacity-50"
                >
                  Verificar Agora
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setPixModalOpen(false);
                    setPixData(null);
                    void handleFinalizeSale();
                  }}
                  className="px-4 py-2 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-md font-extrabold"
                >
                  Confirmar Recebimento
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={printConfirmOpen && Boolean(lastReceipt)}
        title="Venda Concluída"
        onClose={() => {
          setPrintConfirmOpen(false);
          setPrintError(null);
          scannerRef.current?.focus();
        }}
      >
        {lastReceipt && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-tertiary-fixed/30 border border-tertiary-fixed-dim flex items-center justify-between gap-3">
              <div>
                <p className="font-label-sm text-on-surface-variant">
                  Cupom {lastReceipt.cupom} • {lastReceipt.paymentMethod}
                </p>
                <p className="font-headline-sm font-extrabold text-tertiary">
                  {formatBRL(lastReceipt.total)}
                </p>
                {lastReceipt.paymentMethod === 'Dinheiro' &&
                  lastReceipt.changeDue !== undefined &&
                  lastReceipt.changeDue > 0 && (
                    <p className="font-label-md font-bold text-on-surface mt-0.5">
                      Troco: {formatBRL(lastReceipt.changeDue)}
                    </p>
                  )}
              </div>
              <span className="material-symbols-outlined text-[36px] text-tertiary">
                check_circle
              </span>
            </div>

            <p className="font-body-md font-semibold text-on-surface">
              Deseja imprimir o cupom desta venda agora?
            </p>
            <p className="font-body-sm text-on-surface-variant">
              {lastReceipt.paymentMethod === 'Crediário'
                ? 'Crediário: serão impressas 2 vias (1ª via com assinatura do cliente + 2ª via do cliente).'
                : 'Será impressa 1 via do cupom não fiscal (sem assinatura).'}
            </p>

            {printError && (
              <div className="p-3 rounded-lg bg-error-container/40 border border-error/30 text-error font-label-md font-bold">
                {printError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={printingReceipt}
                onClick={() => {
                  setPrintConfirmOpen(false);
                  setPrintError(null);
                  scannerRef.current?.focus();
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-200 font-label-md font-bold hover:bg-surface-container-low"
              >
                Não
              </button>
              <button
                type="button"
                disabled={printingReceipt}
                onClick={() => void handleConfirmPrintReceipt(lastReceipt)}
                className="px-5 py-2.5 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-60 text-[#0F172A] font-label-md font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>{printingReceipt ? 'Imprimindo...' : 'Sim, Imprimir'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de Comandas (Cadastradas + Em Aberto) */}
      <Modal
        open={comandasModalOpen}
        title={`Comandas (${comandas.filter((c) => c.status === 'ABERTA').length} em uso • ${comandas.length} disponíveis)`}
        onClose={() => {
          setComandasModalOpen(false);
          setComandaError(null);
        }}
      >
        <div className="space-y-4">
          {cart.length > 0 && !activeComanda && (
            <form
              onSubmit={handleSaveNewComanda}
              className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-label-md font-bold text-amber-950">
                  {comandas.some((c) => c.status === 'LIVRE')
                    ? `Selecione uma comanda livre abaixo ou abra uma avulsa (${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'} • ${formatBRL(total)})`
                    : `Abrir nova comanda avulsa (${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'} • ${formatBRL(total)})`}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={newComandaLabel}
                  onChange={(e) => setNewComandaLabel(e.target.value)}
                  placeholder="Ex: Mesa 02, João, Espetinho..."
                  className="h-10 px-3 rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <input
                  type="text"
                  value={newComandaNote}
                  onChange={(e) => setNewComandaNote(e.target.value)}
                  placeholder="Observação (opcional)"
                  className="h-10 px-3 rounded-lg border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              {comandaError && (
                <p className="font-label-sm font-bold text-error">{comandaError}</p>
              )}
              <button
                type="submit"
                disabled={savingComanda}
                className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-label-md font-extrabold"
              >
                {savingComanda ? 'Salvando...' : 'Abrir Comanda Avulsa e Liberar Caixa'}
              </button>
            </form>
          )}

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {comandas.length === 0 ? (
              <div className="py-8 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[34px] text-outline-variant mb-1 block">
                  receipt_long
                </span>
                <p className="font-label-md font-bold">Nenhuma comanda cadastrada ou aberta</p>
                <p className="font-body-sm mt-0.5">
                  Cadastre suas mesas/comandas no menu Comandas do ERP ou lance itens no caixa.
                </p>
              </div>
            ) : (
              comandas.map((c) => {
                const isLivre = c.status === 'LIVRE';
                return (
                  <div
                    key={c.id}
                    className={`p-3 rounded-xl border flex flex-col gap-2 ${
                      isLivre
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-label-lg font-bold text-primary">
                            {c.identificador}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full font-label-sm font-bold ${
                              isLivre
                                ? 'bg-tertiary-fixed/50 text-tertiary'
                                : 'bg-amber-200 text-amber-950'
                            }`}
                          >
                            {isLivre ? 'Livre' : 'Em Uso'}
                          </span>
                        </div>
                        <p className="font-body-sm text-on-surface-variant">
                          {isLivre
                            ? c.observacao || 'Disponível para novo atendimento'
                            : `${c.items.length} ${c.items.length === 1 ? 'item' : 'itens'} • Atualizada às ${c.updatedAt}${c.observacao ? ` • ${c.observacao}` : ''}`}
                        </p>
                      </div>
                      <span className="font-headline-sm font-extrabold text-primary tabular-nums">
                        {isLivre ? '—' : formatBRL(c.total)}
                      </span>
                    </div>

                    {!isLivre && (
                      <p className="font-body-sm text-on-surface-variant truncate">
                        {c.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                      </p>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {isLivre ? (
                        cart.length > 0 && !activeComanda ? (
                          <button
                            type="button"
                            disabled={savingComanda}
                            onClick={() => void handleAssignToComanda(c.id, c.identificador)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] text-[#0F172A] font-label-sm font-extrabold"
                          >
                            Lançar {itemsCount} {itemsCount === 1 ? 'item' : 'itens'} nesta Comanda
                          </button>
                        ) : (
                          <span className="font-body-sm text-on-surface-variant">
                            Adicione itens no caixa para lançar aqui
                          </span>
                        )
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleDeleteComanda(c.id)}
                            className="px-3 py-1.5 rounded-lg text-error bg-error-container/50 hover:bg-error-container font-label-sm font-bold"
                          >
                            {c.cadastrada ? 'Liberar Comanda' : 'Cancelar Comanda'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadComanda(c)}
                            className="px-3.5 py-1.5 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] text-[#0F172A] font-label-sm font-extrabold"
                          >
                            Abrir no Caixa / Adicionar ou Fechar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Consulta Rápida de Preço (F9) */}
      <Modal
        open={priceCheckOpen}
        title="Consultar Preço (F9)"
        onClose={() => {
          setPriceCheckOpen(false);
          setPriceCheckQuery('');
          scannerRef.current?.focus();
        }}
      >
        <div className="space-y-4">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-secondary text-[22px]">
              barcode_scanner
            </span>
            <input
              type="text"
              value={priceCheckQuery}
              onChange={(e) => setPriceCheckQuery(e.target.value)}
              placeholder="Bipe o código de barras ou digite o nome do produto..."
              className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-secondary/40 focus:border-secondary focus:outline-none font-body-md"
              autoFocus
            />
          </div>

          {(() => {
            const q = priceCheckQuery.trim().toLowerCase();
            if (!q) {
              return (
                <div className="py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[38px] text-outline-variant mb-2 block">
                    price_check
                  </span>
                  <p className="font-label-md font-bold text-on-surface">
                    Pronto para consultar
                  </p>
                  <p className="font-body-sm mt-0.5">
                    Bipe o código de barras ou digite o nome para visualizar o valor de venda.
                  </p>
                </div>
              );
            }
            const matches = products.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                p.barcode.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q)
            );
            if (matches.length === 0) {
              return (
                <div className="py-8 text-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-[38px] text-outline-variant mb-2 block">
                    search_off
                  </span>
                  <p className="font-label-md font-bold text-on-surface">
                    Produto não encontrado
                  </p>
                </div>
              );
            }
            return (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {matches.slice(0, 15).map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-surface-container-low/60 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-label-lg font-bold text-on-surface truncate">
                        {p.name}
                      </p>
                      <p className="font-body-sm text-on-surface-variant">
                        {p.category} • {p.barcode || p.sku} • Estoque: {p.stock} {p.unit}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <span className="font-numeric-total text-2xl font-extrabold text-primary tabular-nums block">
                          {formatBRL(p.salePrice)}
                        </span>
                        <span className="text-xs text-on-surface-variant">/ {p.unit}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(p);
                          setPriceCheckOpen(false);
                          setPriceCheckQuery('');
                          scannerRef.current?.focus();
                        }}
                        title="Adicionar ao caixa"
                        className="px-3 py-2 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] text-[#0F172A] font-label-sm font-extrabold"
                      >
                        + Caixa
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Modal>

      {lastReceipt && (
        <div className="print-only-container">
          <PrintableReceipt
            receipt={lastReceipt}
            store={company ?? {}}
            twoCopies={lastReceipt.paymentMethod === 'Crediário'}
          />
        </div>
      )}
    </div>
  );
}
