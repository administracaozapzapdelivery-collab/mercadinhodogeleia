import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Product } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

type ProductQuickFilter = 'all' | 'expired' | 'expiring' | 'low_stock' | 'out_of_stock';

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
  const { products, deleteProduct } = useErp();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<ProductQuickFilter>('all');
  const [alertDays, setAlertDays] = useState(15);
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
    return products.filter((p) => {
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      if (!matchesSearch) return false;

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
  }, [products, search, quickFilter, stats.todayStr, stats.limitStr]);

  const toggleFilter = (target: Exclude<ProductQuickFilter, 'all'>) => {
    setQuickFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Catálogo & Estoque"
        title="Produtos e Estoque"
        subtitle="Gerencie preços de venda, margem, estoque mínimo e código de barras."
        actions={
          <div className="flex items-center gap-2">
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

      <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center gap-space-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, SKU ou código de barras..."
          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
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
              filtered.map((p) => {
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
