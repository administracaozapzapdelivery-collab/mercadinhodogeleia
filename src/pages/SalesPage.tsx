import { useMemo, useState } from 'react';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Sale } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { ReceiptModal } from '../components/ReceiptModal';

interface SaleItemRow {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

type PeriodFilter = 'Todos' | 'Dia' | 'Semana' | 'Mês';

function parseSaleDate(dateStr: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(dateStr.trim());
  if (!match) return null;
  const [, dd, mm, yyyy, hh = '00', min = '00'] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
}

function getPeriodBoundaries(now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const dayStart = new Date(y, m, d, 0, 0, 0, 0);
  const weekStart = new Date(y, m, d - now.getDay(), 0, 0, 0, 0);
  const monthStart = new Date(y, m, 1, 0, 0, 0, 0);
  const quarterStart = new Date(y, Math.floor(m / 3) * 3, 1, 0, 0, 0, 0);
  const semesterStart = new Date(y, m < 6 ? 0 : 6, 1, 0, 0, 0, 0);
  const yearStart = new Date(y, 0, 1, 0, 0, 0, 0);

  return { dayStart, weekStart, monthStart, quarterStart, semesterStart, yearStart };
}

export function SalesPage() {
  const { sales, refreshData } = useErp();
  const [filter, setFilter] = useState<'Todas' | 'Concluída' | 'Cancelada'>('Todas');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('Todos');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItemRow[]>([]);
  const [adminPin, setAdminPin] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const periodStats = useMemo(() => {
    const { dayStart, weekStart, monthStart, quarterStart, semesterStart, yearStart } =
      getPeriodBoundaries(new Date());

    const acc = {
      dia: { total: 0, count: 0 },
      semana: { total: 0, count: 0 },
      mes: { total: 0, count: 0 },
      trimestre: { total: 0, count: 0 },
      semestre: { total: 0, count: 0 },
      anual: { total: 0, count: 0 },
    };

    for (const s of sales) {
      if (s.status !== 'Concluída') continue;
      const dt = parseSaleDate(s.date);
      if (!dt) continue;
      const val = Number(s.total) || 0;
      if (dt >= dayStart) {
        acc.dia.total += val;
        acc.dia.count += 1;
      }
      if (dt >= weekStart) {
        acc.semana.total += val;
        acc.semana.count += 1;
      }
      if (dt >= monthStart) {
        acc.mes.total += val;
        acc.mes.count += 1;
      }
      if (dt >= quarterStart) {
        acc.trimestre.total += val;
        acc.trimestre.count += 1;
      }
      if (dt >= semesterStart) {
        acc.semestre.total += val;
        acc.semestre.count += 1;
      }
      if (dt >= yearStart) {
        acc.anual.total += val;
        acc.anual.count += 1;
      }
    }

    return [
      {
        key: 'dia',
        label: 'Dia (Hoje)',
        icon: 'today',
        filterKey: 'Dia' as PeriodFilter,
        cardClass: 'bg-violet-100 border-violet-200 hover:bg-violet-200/70',
        titleClass: 'text-violet-800',
        valueClass: 'text-violet-950',
        subClass: 'text-violet-700',
        ...acc.dia,
      },
      {
        key: 'semana',
        label: 'Semana',
        icon: 'date_range',
        filterKey: 'Semana' as PeriodFilter,
        cardClass: 'bg-sky-100 border-sky-200 hover:bg-sky-200/70',
        titleClass: 'text-sky-800',
        valueClass: 'text-sky-950',
        subClass: 'text-sky-700',
        ...acc.semana,
      },
      {
        key: 'mes',
        label: 'Mês',
        icon: 'calendar_month',
        filterKey: 'Mês' as PeriodFilter,
        cardClass: 'bg-emerald-100 border-emerald-200 hover:bg-emerald-200/70',
        titleClass: 'text-emerald-800',
        valueClass: 'text-emerald-950',
        subClass: 'text-emerald-700',
        ...acc.mes,
      },
      {
        key: 'trimestre',
        label: 'Trimestre',
        icon: 'calendar_view_month',
        filterKey: null,
        cardClass: 'bg-amber-100 border-amber-200',
        titleClass: 'text-amber-800',
        valueClass: 'text-amber-950',
        subClass: 'text-amber-700',
        ...acc.trimestre,
      },
      {
        key: 'semestre',
        label: 'Semestre',
        icon: 'event_note',
        filterKey: null,
        cardClass: 'bg-indigo-100 border-indigo-200',
        titleClass: 'text-indigo-800',
        valueClass: 'text-indigo-950',
        subClass: 'text-indigo-700',
        ...acc.semestre,
      },
      {
        key: 'anual',
        label: 'Anual',
        icon: 'calendar_today',
        filterKey: null,
        cardClass: 'bg-teal-100 border-teal-200',
        titleClass: 'text-teal-800',
        valueClass: 'text-teal-950',
        subClass: 'text-teal-700',
        ...acc.anual,
      },
    ];
  }, [sales]);

  const filtered = useMemo(() => {
    const { dayStart, weekStart, monthStart } = getPeriodBoundaries(new Date());
    return sales.filter((s) => {
      if (filter !== 'Todas' && s.status !== filter) return false;
      if (periodFilter === 'Todos') return true;
      const dt = parseSaleDate(s.date);
      if (!dt) return false;
      if (periodFilter === 'Dia') return dt >= dayStart;
      if (periodFilter === 'Semana') return dt >= weekStart;
      if (periodFilter === 'Mês') return dt >= monthStart;
      return true;
    });
  }, [sales, filter, periodFilter]);

  async function openSaleDetails(sale: Sale) {
    setSelectedSale(sale);
    setCancelError(null);
    setAdminPin('');
    const res = await fetch(`/api/sales/${sale.id}/items`);
    if (res.ok) {
      setSaleItems(await res.json());
    } else {
      setSaleItems([]);
    }
  }

  async function handleCancelSale() {
    if (!selectedSale) return;
    setCancelError(null);
    const res = await fetch(`/api/sales/${selectedSale.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPin }),
    });
    const body = await res.json();
    if (!res.ok) {
      setCancelError(body.error || 'Erro ao cancelar venda.');
      return;
    }
    await refreshData();
    setSelectedSale(null);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Frente de Caixa & Fiscal"
        title="Vendas e Cupons"
        subtitle="Histórico de cupons emitidos, detalhes de itens e cancelamento com estorno."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-slate-200/80">
              {(['Todos', 'Dia', 'Semana', 'Mês'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1.5 rounded-md font-label-md font-bold transition-colors ${
                    periodFilter === period
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                  }`}
                >
                  {period === 'Todos' ? 'Todo período' : period}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {(['Todas', 'Concluída', 'Cancelada'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  className={`px-3 py-2 rounded-lg font-label-md font-bold transition-colors ${
                    filter === status
                      ? 'bg-primary-container text-white'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-space-md">
        {periodStats.map((card) => {
          const isActive = card.filterKey !== null && periodFilter === card.filterKey;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                if (card.filterKey) {
                  setPeriodFilter((prev) => (prev === card.filterKey ? 'Todos' : card.filterKey!));
                }
              }}
              className={`text-left p-4 rounded-xl border shadow-sm transition-all ${card.cardClass} ${
                card.filterKey ? 'cursor-pointer' : 'cursor-default'
              } ${isActive ? 'ring-2 ring-primary border-primary' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-label-sm uppercase tracking-wider font-bold ${card.titleClass}`}>
                  {card.label}
                </span>
                <span className={`material-symbols-outlined text-[18px] ${card.titleClass}`}>
                  {card.icon}
                </span>
              </div>
              <div className={`font-headline-sm font-extrabold tabular-nums ${card.valueClass}`}>
                {formatBRL(card.total)}
              </div>
              <div className={`font-body-sm mt-0.5 font-medium ${card.subClass}`}>
                {card.count} {card.count === 1 ? 'venda' : 'vendas'}
              </div>
            </button>
          );
        })}
      </section>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Cupom</th>
              <th className="px-space-lg py-3">Data / Hora</th>
              <th className="px-space-lg py-3">Cliente</th>
              <th className="px-space-lg py-3">Operador</th>
              <th className="px-space-lg py-3">Pagamento</th>
              <th className="px-space-lg py-3 text-right">Total</th>
              <th className="px-space-lg py-3">Status</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.map((sale) => (
              <tr key={sale.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-md font-bold text-primary">{sale.cupom}</td>
                <td className="px-space-lg py-3 text-body-sm text-on-surface-variant">{sale.date}</td>
                <td className="px-space-lg py-3 text-body-md">{sale.customer}</td>
                <td className="px-space-lg py-3 text-body-md">
                  <div>{sale.operator}</div>
                  {sale.authorizedBy && (
                    <div className="font-label-sm text-[11px] text-amber-700 font-semibold">
                      Autorizado por: {sale.authorizedBy}
                    </div>
                  )}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge label={sale.paymentMethod} tone="info" />
                </td>
                <td className="px-space-lg py-3 text-right font-label-lg font-bold tabular-nums">
                  {formatBRL(sale.total)}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={sale.status}
                    tone={sale.status === 'Concluída' ? 'success' : 'danger'}
                  />
                </td>
                <td className="px-space-lg py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void openSaleDetails(sale)}
                    className="px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm font-bold text-primary"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selectedSale}
        title={`Cupom ${selectedSale?.cupom ?? ''}`}
        onClose={() => setSelectedSale(null)}
      >
        {selectedSale && (
          <div className="space-y-4">
            {selectedSale.authorizedBy && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-body-sm">
                <strong>Autorização especial:</strong> liberada por{' '}
                <strong>{selectedSale.authorizedBy}</strong>
                {selectedSale.authorizationReason
                  ? ` (${selectedSale.authorizationReason})`
                  : ''}
                .
              </div>
            )}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {saleItems.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Nenhum item detalhado registrado.</p>
              ) : (
                saleItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between p-2.5 rounded-lg bg-surface-container-low"
                  >
                    <div>
                      <p className="font-label-md font-bold">{item.productName}</p>
                      <p className="font-body-sm text-on-surface-variant">
                        {item.quantity} x {formatBRL(item.unitPrice)}
                      </p>
                    </div>
                    <span className="font-label-lg font-bold tabular-nums">
                      {formatBRL(item.subtotal)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReceiptOpen(true)}
                className="px-4 py-2 rounded-lg bg-primary-container text-white font-label-md font-bold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>Imprimir Cupom (2 Vias)</span>
              </button>
            </div>

            {selectedSale.status === 'Concluída' && (
              <div className="pt-3 border-t border-surface-container space-y-2">
                {cancelError && (
                  <p className="text-error font-label-sm font-bold">{cancelError}</p>
                )}
                <label htmlFor="admin-pin" className="block font-label-sm uppercase text-on-surface-variant">
                  PIN Administrador para Cancelar e Estornar (padrão demo: 1234)
                </label>
                <div className="flex gap-2">
                  <input
                    id="admin-pin"
                    type="password"
                    maxLength={4}
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="PIN"
                    className="w-28 h-10 px-3 rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCancelSale()}
                    className="px-4 py-2 rounded-lg bg-error text-white font-label-md font-bold"
                  >
                    Cancelar Venda
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ReceiptModal
        open={receiptOpen}
        receipt={
          selectedSale
            ? {
                cupom: selectedSale.cupom,
                date: selectedSale.date,
                operator: selectedSale.operator,
                paymentMethod: selectedSale.paymentMethod,
                items: saleItems.map((item) => ({
                  name: item.productName,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  subtotal: item.subtotal,
                })),
                subtotal: saleItems.reduce((acc, i) => acc + i.subtotal, 0) || selectedSale.total,
                discount: Math.max(
                  0,
                  (saleItems.reduce((acc, i) => acc + i.subtotal, 0) || selectedSale.total) -
                    selectedSale.total
                ),
                total: selectedSale.total,
                customer:
                  selectedSale.customer && selectedSale.customer !== 'Consumidor Final'
                    ? { name: selectedSale.customer }
                    : undefined,
              }
            : null
        }
        onClose={() => setReceiptOpen(false)}
      />
    </div>
  );
}
