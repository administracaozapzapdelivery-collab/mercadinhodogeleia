import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Product } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

type ProductQuickFilter = 'all' | 'expired' | 'expiring' | 'low_stock' | 'out_of_stock';
type ProductSort = 'name' | 'stock_asc' | 'margin_desc' | 'expiry_asc';

const PAGE_SIZE = 20;

function toLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysUntilExpiry(expiryDate: string): number {
  const [y, m, d] = expiryDate.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const FILTER_LABELS: Record<Exclude<ProductQuickFilter, 'all'>, string> = {
  expired: 'Produtos Vencidos',
  expiring: 'Próximos a Vencer',
  low_stock: 'Estoque Baixo',
  out_of_stock: 'Sem Estoque',
};

export function ProductsPage() {
  const navigate = useNavigate();
  const { products, categories, suppliers, deleteProduct } = useErp();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<ProductSort>('name');
  const [quickFilter, setQuickFilter] = useState<ProductQuickFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [alertDays, setAlertDays] = useState(15);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockSelected, setRestockSelected] = useState<Record<string, boolean>>({});
  const [restockQtys, setRestockQtys] = useState<Record<string, number>>({});
  const [restockSupplierId, setRestockSupplierId] = useState('');
  const [restockCopied, setRestockCopied] = useState(false);
  const [viewItem, setViewItem] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const days = Number(data?.dias_alerta_validade);
        if (Number.isFinite(days) && days > 0) setAlertDays(days);
      })
      .catch(() => null);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStr = toLocalISODate(now);
    const limitDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + alertDays);
    const limitStr = toLocalISODate(limitDate);

    let expiredCount = 0;
    let expiringCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let totalCostValue = 0;
    let totalSaleValue = 0;
    let totalStockUnits = 0;
    const categories = new Set<string>();

    for (const p of products) {
      if (p.category) categories.add(p.category);
      if (p.expiryDate) {
        if (p.expiryDate < todayStr) expiredCount++;
        else if (p.expiryDate <= limitStr) expiringCount++;
      }
      if (p.stock <= 0) outOfStockCount++;
      if (p.stock <= p.minStock) lowStockCount++;

      const qty = Math.max(0, p.stock);
      totalStockUnits += qty;
      totalCostValue += p.costPrice * qty;
      totalSaleValue += p.salePrice * qty;
    }

    const avgMargin =
      totalSaleValue > 0 ? Math.round(((totalSaleValue - totalCostValue) / totalSaleValue) * 100) : 0;

    return {
      todayStr,
      limitStr,
      totalProducts: products.length,
      categoriesCount: categories.size,
      totalStockUnits,
      expiredCount,
      expiringCount,
      lowStockCount,
      outOfStockCount,
      totalCostValue,
      totalSaleValue,
      avgMargin,
    };
  }, [products, alertDays]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      if (!matchesSearch) return false;

      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;

      switch (quickFilter) {
        case 'expired':
          return Boolean(p.expiryDate && p.expiryDate < stats.todayStr);
        case 'expiring':
          return Boolean(
            p.expiryDate && p.expiryDate >= stats.todayStr && p.expiryDate <= stats.limitStr
          );
        case 'low_stock':
          return p.stock <= p.minStock;
        case 'out_of_stock':
          return p.stock <= 0;
        default:
          return true;
      }
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'stock_asc') return a.stock - b.stock;
      if (sortBy === 'margin_desc') {
        const ma = a.salePrice > 0 ? (a.salePrice - a.costPrice) / a.salePrice : 0;
        const mb = b.salePrice > 0 ? (b.salePrice - b.costPrice) / b.salePrice : 0;
        return mb - ma;
      }
      if (sortBy === 'expiry_asc') {
        if (!a.expiryDate && !b.expiryDate) return a.name.localeCompare(b.name);
        if (!a.expiryDate) return 1;
        if (!b.expiryDate) return -1;
        return a.expiryDate.localeCompare(b.expiryDate);
      }
      return a.name.localeCompare(b.name);
    });
  }, [products, search, categoryFilter, sortBy, quickFilter, stats.todayStr, stats.limitStr]);

  const toggleFilter = (target: Exclude<ProductQuickFilter, 'all'>) => {
    setQuickFilter((prev) => (prev === target ? 'all' : target));
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, sortBy, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginated = useMemo(
    () => filtered.slice(startIndex, startIndex + PAGE_SIZE),
    [filtered, startIndex]
  );

  const lowStockList = useMemo(
    () =>
      products
        .filter((p) => p.stock <= p.minStock)
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [products]
  );

  function openRestockModal() {
    const selectedMap: Record<string, boolean> = {};
    const qtyMap: Record<string, number> = {};
    for (const p of lowStockList) {
      selectedMap[p.id] = true;
      qtyMap[p.id] = Math.max(1, p.minStock * 2 - Math.max(0, p.stock));
    }
    setRestockSelected(selectedMap);
    setRestockQtys(qtyMap);
    setRestockCopied(false);
    setRestockOpen(true);
  }

  const chosenRestockItems = useMemo(
    () =>
      lowStockList
        .filter((p) => restockSelected[p.id])
        .map((p) => ({
          product: p,
          qty: Math.max(1, Number(restockQtys[p.id]) || 1),
        })),
    [lowStockList, restockSelected, restockQtys]
  );

  const restockEstimatedTotal = useMemo(
    () =>
      chosenRestockItems.reduce((acc, item) => acc + item.product.costPrice * item.qty, 0),
    [chosenRestockItems]
  );

  function buildWhatsAppMessage(): string {
    const supplier = suppliers.find((s) => s.id === restockSupplierId);
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const lines = [
      `*Lista de Reposição — Mercadinho do Geleia* (${todayStr})`,
      supplier ? `Fornecedor: *${supplier.name}*` : '',
      '',
    ].filter(Boolean);

    const byCategory = new Map<string, typeof chosenRestockItems>();
    for (const item of chosenRestockItems) {
      const list = byCategory.get(item.product.category) ?? [];
      list.push(item);
      byCategory.set(item.product.category, list);
    }

    for (const [cat, items] of byCategory.entries()) {
      lines.push(`*${cat}*`);
      for (const { product, qty } of items) {
        lines.push(`• ${product.name} — *${qty} ${product.unit}*`);
      }
      lines.push('');
    }

    lines.push(`Total de itens: ${chosenRestockItems.length}`);
    return lines.join('\n');
  }

  async function handleCopyRestock() {
    if (chosenRestockItems.length === 0) return;
    await navigator.clipboard.writeText(buildWhatsAppMessage());
    setRestockCopied(true);
    setTimeout(() => setRestockCopied(false), 3000);
  }

  function handleSendWhatsAppRestock() {
    if (chosenRestockItems.length === 0) return;
    const supplier = suppliers.find((s) => s.id === restockSupplierId);
    const digits = (supplier?.phone ?? '').replace(/\D/g, '');
    const phonePart = digits.length >= 10 ? `55${digits}` : '';
    const text = encodeURIComponent(buildWhatsAppMessage());
    window.open(`https://wa.me/${phonePart}?text=${text}`, '_blank', 'noopener,noreferrer');
  }

  function handleExportRestockPdf() {
    if (chosenRestockItems.length === 0) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const supplier = suppliers.find((s) => s.id === restockSupplierId);
    const todayStr = new Date().toLocaleDateString('pt-BR');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Mercadinho do Geleia — Lista de Reposição', 14, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Data: ${todayStr} • Itens selecionados: ${chosenRestockItems.length}`, 14, 25);
    if (supplier) {
      doc.text(`Fornecedor: ${supplier.name} (${supplier.phone || 'Sem telefone'})`, 14, 30);
    }

    let y = supplier ? 38 : 33;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Produto', 14, y);
    doc.text('Categoria', 100, y);
    doc.text('Atual/Mín', 138, y);
    doc.text('Comprar', 164, y);
    doc.text('Custo Est.', 184, y);
    y += 2;
    doc.line(14, y, 196, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    for (const { product, qty } of chosenRestockItems) {
      if (y > 275) {
        doc.addPage();
        y = 18;
      }
      doc.text(product.name.slice(0, 44), 14, y);
      doc.text(product.category.slice(0, 18), 100, y);
      doc.text(`${product.stock}/${product.minStock} ${product.unit}`, 138, y);
      doc.text(`${qty} ${product.unit}`, 164, y);
      doc.text(formatBRL(product.costPrice * qty), 184, y);
      y += 6;
    }

    y += 3;
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Custo Estimado Total: ${formatBRL(restockEstimatedTotal)}`, 14, y);

    doc.save(`lista-reposicao-${toLocalISODate(new Date())}.pdf`);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Catálogo & Estoque"
        title="Produtos e Estoque"
        subtitle="Gerencie preços de venda, margem, estoque mínimo e código de barras."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openRestockModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
              <span>Gerar Lista de Reposição ({stats.lowStockCount})</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/etiquetas')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
              <span>Gerar Etiquetas</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/produtos/novo')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Cadastrar Produto</span>
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'all'
              ? 'border-primary/40 ring-2 ring-primary/15'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Produtos</span>
            </div>
            <StatusBadge label="Catálogo" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.totalProducts} {stats.totalProducts === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.categoriesCount} {stats.categoriesCount === 1 ? 'categoria' : 'categorias'} •{' '}
              {Number.isInteger(stats.totalStockUnits)
                ? stats.totalStockUnits
                : stats.totalStockUnits.toFixed(2)}{' '}
              itens em estoque
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('expired')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'expired'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">event_busy</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Produtos Vencidos</span>
            </div>
            <StatusBadge
              label={stats.expiredCount > 0 ? 'Ação Imediata' : 'Em dia'}
              tone={stats.expiredCount > 0 ? 'danger' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.expiredCount > 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {stats.expiredCount} {stats.expiredCount === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.expiredCount > 0
                ? 'Validade expirada — retirar da gôndola'
                : 'Nenhum produto vencido no catálogo'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('expiring')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'expiring'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Próximos a Vencer</span>
            </div>
            <StatusBadge
              label={stats.expiringCount > 0 ? `Até ${alertDays}d` : 'Tranquilo'}
              tone={stats.expiringCount > 0 ? 'warning' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.expiringCount > 0 ? 'text-amber-800' : 'text-on-surface'
              }`}
            >
              {stats.expiringCount} {stats.expiringCount === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Vencimento nos próximos {alertDays} dias
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('low_stock')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'low_stock'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Estoque Baixo</span>
            </div>
            <StatusBadge
              label={stats.lowStockCount > 0 ? 'Repor' : 'Normal'}
              tone={stats.lowStockCount > 0 ? 'danger' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.lowStockCount > 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {stats.lowStockCount} {stats.lowStockCount === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Abaixo ou igual ao estoque mínimo
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('out_of_stock')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'out_of_stock'
              ? 'border-secondary ring-2 ring-secondary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[22px]">
                  production_quantity_limits
                </span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Sem Estoque</span>
            </div>
            <StatusBadge
              label={stats.outOfStockCount > 0 ? 'Zerado' : 'Abastecido'}
              tone={stats.outOfStockCount > 0 ? 'neutral' : 'success'}
            />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-on-surface block tabular-nums">
              {stats.outOfStockCount} {stats.outOfStockCount === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Itens indisponíveis para venda (0 un.)
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Valor em Estoque</span>
            </div>
            <StatusBadge label={`Margem ${stats.avgMargin}%`} tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {formatBRL(stats.totalCostValue)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Potencial de venda: {formatBRL(stats.totalSaleValue)}
            </span>
          </div>
        </div>
      </section>

      <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center gap-space-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, SKU ou código de barras..."
          className="flex-1 h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filtrar por categoria"
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="all">Todas as categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ProductSort)}
          aria-label="Ordenar produtos"
          className="h-10 px-3 rounded-lg border border-slate-200 bg-white text-on-surface font-body-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="name">Ordem: Nome (A-Z)</option>
          <option value="stock_asc">Ordem: Menor estoque</option>
          <option value="margin_desc">Ordem: Maior margem</option>
          <option value="expiry_asc">Ordem: Validade mais próxima</option>
        </select>
        {quickFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setQuickFilter('all')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-primary-fixed text-primary-container font-label-md font-bold hover:bg-primary-fixed/80 transition-colors"
          >
            <span>Filtro: {FILTER_LABELS[quickFilter]}</span>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">SKU</th>
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3">Categoria</th>
              <th className="px-space-lg py-3 text-right">Custo</th>
              <th className="px-space-lg py-3 text-right">Venda</th>
              <th className="px-space-lg py-3 text-right">Estoque</th>
              <th className="px-space-lg py-3">Situação</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhum produto encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              paginated.map((p) => {
                const isExpired = Boolean(p.expiryDate && p.expiryDate < stats.todayStr);
                const isExpiringSoon = Boolean(
                  p.expiryDate && p.expiryDate >= stats.todayStr && p.expiryDate <= stats.limitStr
                );
                const daysLeft = p.expiryDate ? getDaysUntilExpiry(p.expiryDate) : null;

                return (
                  <tr key={p.id} className="hover:bg-surface-container-low/50">
                    <td className="px-space-lg py-3 font-label-md text-secondary font-bold">{p.sku}</td>
                    <td className="px-space-lg py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-label-lg font-bold text-on-surface">{p.name}</p>
                        {p.adminOnly && (
                          <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary-container font-label-sm font-bold">
                            Somente Admin
                          </span>
                        )}
                      </div>
                      <p className="font-body-sm text-on-surface-variant">{p.barcode}</p>
                    </td>
                    <td className="px-space-lg py-3">{p.category}</td>
                    <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(p.costPrice)}</td>
                    <td className="px-space-lg py-3 text-right font-label-lg font-bold text-primary tabular-nums">
                      {formatBRL(p.salePrice)}
                    </td>
                    <td className="px-space-lg py-3 text-right font-bold tabular-nums">
                      {p.stock} {p.unit}
                    </td>
                    <td className="px-space-lg py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge
                          label={
                            p.stock <= 0
                              ? 'Sem Estoque'
                              : p.stock <= p.minStock
                                ? 'Estoque Crítico'
                                : 'Normal'
                          }
                          tone={p.stock <= p.minStock ? 'danger' : 'success'}
                        />
                        {isExpired && <StatusBadge label="Vencido" tone="danger" />}
                        {isExpiringSoon && daysLeft !== null && (
                          <StatusBadge
                            label={daysLeft === 0 ? 'Vence hoje' : `Vence em ${daysLeft}d`}
                            tone="warning"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-space-lg py-3 text-right">
                      <CrudActionButtons
                        extra={
                          <button
                            type="button"
                            onClick={() => navigate(`/etiquetas?productId=${p.id}`)}
                            className="w-8 h-8 rounded-lg bg-primary-fixed/60 text-primary-container hover:bg-primary-fixed inline-flex items-center justify-center transition-colors"
                            title="Gerar etiqueta"
                            aria-label="Gerar etiqueta"
                          >
                            <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                          </button>
                        }
                        onView={() => setViewItem(p)}
                        onEdit={() => navigate(`/produtos/${p.id}/editar`)}
                        onDelete={() => {
                          setDeleteErr(null);
                          setDeleteTarget(p);
                        }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-space-lg py-3 border-t border-surface-container bg-surface-container-low/40">
            <span className="font-body-sm text-on-surface-variant tabular-nums">
              Mostrando{' '}
              <strong className="text-on-surface">
                {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)}
              </strong>{' '}
              de <strong className="text-on-surface">{filtered.length}</strong>{' '}
              {filtered.length === 1 ? 'produto' : 'produtos'}
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-label-md font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-40 disabled:pointer-events-none"
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - safePage) <= 1
                  )
                  .reduce<(number | 'ellipsis')[]>((acc, page, idx, arr) => {
                    if (idx > 0 && page - arr[idx - 1] > 1) {
                      acc.push('ellipsis');
                    }
                    acc.push(page);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-on-surface-variant font-label-md"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={`min-w-[34px] h-8 px-2 rounded-lg font-label-md font-bold tabular-nums transition-colors ${
                          item === safePage
                            ? 'bg-primary text-white'
                            : 'border border-slate-200 bg-white text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}

                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white font-label-md font-bold text-on-surface hover:bg-surface-container-low disabled:opacity-40 disabled:pointer-events-none"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        open={!!viewItem}
        title={`Produto — ${viewItem?.name ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-label-sm text-on-surface-variant">SKU / Código</p>
                <p className="font-bold text-on-surface">{viewItem.sku} • {viewItem.barcode || 'Sem barras'}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Categoria</p>
                <p className="font-bold text-on-surface">{viewItem.category}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Preço de Custo</p>
                <p className="font-bold text-on-surface">{formatBRL(viewItem.costPrice)}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Preço de Venda</p>
                <p className="font-bold text-primary">{formatBRL(viewItem.salePrice)} / {viewItem.unit}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Estoque Atual / Mínimo</p>
                <p className="font-bold text-on-surface">{viewItem.stock} / {viewItem.minStock} {viewItem.unit}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Validade</p>
                <p className="font-bold text-on-surface">{viewItem.expiryDate || 'Não informada'}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={restockOpen}
        title={`Lista de Reposição — Estoque Baixo (${lowStockList.length})`}
        onClose={() => setRestockOpen(false)}
      >
        {lowStockList.length === 0 ? (
          <div className="py-6 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[36px] text-tertiary mb-2 block">
              check_circle
            </span>
            <p className="font-label-lg font-bold text-on-surface">Estoque em dia!</p>
            <p className="font-body-sm mt-1">Nenhum produto está abaixo ou igual ao estoque mínimo.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <select
                value={restockSupplierId}
                onChange={(e) => setRestockSupplierId(e.target.value)}
                aria-label="Selecionar fornecedor"
                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 bg-white font-body-sm"
              >
                <option value="">Fornecedor opcional (para WhatsApp / PDF)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `• ${s.phone}` : ''}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 text-body-sm">
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<string, boolean> = {};
                    const allSelected = chosenRestockItems.length === lowStockList.length;
                    for (const p of lowStockList) next[p.id] = !allSelected;
                    setRestockSelected(next);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm font-bold text-primary"
                >
                  {chosenRestockItems.length === lowStockList.length
                    ? 'Desmarcar todos'
                    : 'Marcar todos'}
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto divide-y divide-surface-container border border-slate-200 rounded-xl">
              {lowStockList.map((p) => {
                const checked = Boolean(restockSelected[p.id]);
                const qty = restockQtys[p.id] ?? 1;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between gap-2 p-2.5 text-body-sm ${
                      checked ? 'bg-white' : 'bg-surface-container-low/50 opacity-60'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setRestockSelected((prev) => ({ ...prev, [p.id]: e.target.checked }))
                        }
                        className="w-4 h-4 rounded"
                      />
                      <div className="min-w-0">
                        <p className="font-label-md font-bold text-on-surface truncate">{p.name}</p>
                        <p className="text-xs text-on-surface-variant">
                          {p.category} • Atual: {p.stock} / Mín: {p.minStock} {p.unit}
                        </p>
                      </div>
                    </label>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min={1}
                        value={qty}
                        disabled={!checked}
                        onChange={(e) =>
                          setRestockQtys((prev) => ({
                            ...prev,
                            [p.id]: Math.max(1, Number(e.target.value) || 1),
                          }))
                        }
                        aria-label={`Quantidade a comprar de ${p.name}`}
                        className="w-16 h-8 px-2 rounded-lg border border-slate-200 text-right font-bold tabular-nums"
                      />
                      <span className="text-xs text-on-surface-variant w-6">{p.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
              <span className="font-body-sm text-on-surface-variant">
                {chosenRestockItems.length} {chosenRestockItems.length === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              <span className="font-label-lg font-extrabold text-primary tabular-nums">
                Custo est.: {formatBRL(restockEstimatedTotal)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={chosenRestockItems.length === 0}
                onClick={() => void handleCopyRestock()}
                className="px-3.5 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-primary font-label-md font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {restockCopied ? 'check' : 'content_copy'}
                </span>
                <span>{restockCopied ? 'Copiado!' : 'Copiar Lista'}</span>
              </button>
              <button
                type="button"
                disabled={chosenRestockItems.length === 0}
                onClick={handleSendWhatsAppRestock}
                className="px-3.5 py-2 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-40 text-[#0F172A] font-label-md font-extrabold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">chat</span>
                <span>Enviar WhatsApp</span>
              </button>
              <button
                type="button"
                disabled={chosenRestockItems.length === 0}
                onClick={handleExportRestockPdf}
                className="px-3.5 py-2 rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-40 font-label-md font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                <span>Exportar PDF</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.name ?? ''}
        loading={deleting}
        error={deleteErr}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          setDeleteErr(null);
          try {
            await deleteProduct(deleteTarget.id);
            setDeleteTarget(null);
          } catch (err) {
            setDeleteErr((err as Error).message);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}
