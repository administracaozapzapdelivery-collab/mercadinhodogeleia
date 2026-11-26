import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

interface ExpiringItem {
  id: string;
  name: string;
  category: string;
  expiryDate: string;
  stock: number;
  unit: string;
}

type ExpiryFilter = 'all' | 'expired' | 'urgent';

function getDaysUntilExpiry(expiryDate: string): number {
  const [y, m, d] = expiryDate.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function ExpiryAlertsPage() {
  const navigate = useNavigate();
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);
  const [filter, setFilter] = useState<ExpiryFilter>('all');

  useEffect(() => {
    fetch('/api/products/expiring')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExpiring(data))
      .catch(() => setExpiring([]));
  }, []);

  const enriched = useMemo(() => {
    return expiring.map((item) => ({
      ...item,
      daysLeft: getDaysUntilExpiry(item.expiryDate),
    }));
  }, [expiring]);

  const stats = useMemo(() => {
    let expiredCount = 0;
    let urgentCount = 0;
    let totalUnits = 0;

    for (const item of enriched) {
      if (item.daysLeft < 0) expiredCount++;
      else if (item.daysLeft <= 7) urgentCount++;
      totalUnits += Math.max(0, item.stock);
    }

    return {
      total: enriched.length,
      expiredCount,
      urgentCount,
      totalUnits,
    };
  }, [enriched]);

  const filtered = useMemo(() => {
    if (filter === 'expired') return enriched.filter((i) => i.daysLeft < 0);
    if (filter === 'urgent') return enriched.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 7);
    return enriched;
  }, [enriched, filter]);

  const toggleFilter = (target: Exclude<ExpiryFilter, 'all'>) => {
    setFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Prevenção de Perdas"
        title="Alerta de Validade"
        subtitle="Produtos vencidos ou dentro da janela configurada em dias_alerta_validade."
        actions={
          <button
            type="button"
            onClick={() => navigate('/movimentacoes-e-perdas/nova')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">assignment_return</span>
            <span>Registrar Baixa / Perda</span>
          </button>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'all'
              ? 'border-primary/40 ring-2 ring-primary/15'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[22px]">notifications_active</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total em Alerta</span>
            </div>
            <StatusBadge label="Monitorados" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.total} {stats.total === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Vencidos ou próximos do vencimento
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('expired')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'expired'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">event_busy</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Já Vencidos</span>
            </div>
            <StatusBadge
              label={stats.expiredCount > 0 ? 'Retirar' : 'Em dia'}
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
              Data de validade já expirada
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('urgent')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'urgent'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Vencem em até 7d</span>
            </div>
            <StatusBadge
              label={stats.urgentCount > 0 ? 'Atenção' : 'Tranquilo'}
              tone={stats.urgentCount > 0 ? 'warning' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.urgentCount > 0 ? 'text-amber-800' : 'text-on-surface'
              }`}
            >
              {stats.urgentCount} {stats.urgentCount === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Avaliar promoção ou giro rápido
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant">
                <span className="material-symbols-outlined text-[22px]">inventory</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Unidades em Risco</span>
            </div>
            <StatusBadge label="Estoque" tone="neutral" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-on-surface block tabular-nums">
              {Number.isInteger(stats.totalUnits) ? stats.totalUnits : stats.totalUnits.toFixed(2)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Quantidade total nos itens em alerta
            </span>
          </div>
        </div>
      </section>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3">Categoria</th>
              <th className="px-space-lg py-3">Validade</th>
              <th className="px-space-lg py-3 text-right">Estoque Atual</th>
              <th className="px-space-lg py-3">Prioridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-space-lg py-8 text-center text-on-surface-variant">
                  {expiring.length === 0
                    ? 'Nenhum produto próximo do vencimento dentro da janela configurada.'
                    : 'Nenhum produto encontrado para o filtro selecionado.'}
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-surface-container-low/50">
                  <td className="px-space-lg py-3 font-label-lg font-bold text-on-surface">{p.name}</td>
                  <td className="px-space-lg py-3">{p.category}</td>
                  <td className="px-space-lg py-3 font-label-md font-bold tabular-nums">
                    {p.expiryDate}
                  </td>
                  <td className="px-space-lg py-3 text-right tabular-nums">
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-space-lg py-3">
                    {p.daysLeft < 0 ? (
                      <StatusBadge
                        label={
                          p.daysLeft === -1
                            ? 'Venceu ontem'
                            : `Vencido há ${Math.abs(p.daysLeft)}d`
                        }
                        tone="danger"
                      />
                    ) : p.daysLeft === 0 ? (
                      <StatusBadge label="Vence hoje" tone="danger" />
                    ) : (
                      <StatusBadge label={`Vence em ${p.daysLeft}d`} tone="warning" />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
