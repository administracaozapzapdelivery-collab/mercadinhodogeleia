import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import { StatusBadge } from '../components/ui/SharedUI';

interface DashboardSummary {
  revenueToday: number;
  salesCount: number;
  avgTicket: number;
  criticalStockCount: number;
  fiadoTotal: number;
  fiadoCustomers: number;
  expiringCount: number;
  metaDiaria?: number;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { products, sales, currentUser } = useErp();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSummary(data);
      })
      .catch(() => null);
  }, [sales.length, products.length]);

  const criticalProducts = products.filter((p) => p.stock <= p.minStock);
  const revenue = summary?.revenueToday ?? 0;
  const avgTicket = summary?.avgTicket ?? 0;
  const salesCount = summary?.salesCount ?? 0;
  const fiadoTotal = summary?.fiadoTotal ?? 0;
  const metaDiaria = summary?.metaDiaria ?? 5800;
  const metaProgress = Math.min(100, Math.round((revenue / metaDiaria) * 100));

  return (
    <div className="flex flex-col gap-space-xl">
      <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed-dim" />
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              Turno Tarde • Caixa Operando
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-primary mt-space-xs">
            Olá, {currentUser?.nome ?? 'Geleia'}! Aqui está o resumo operacional de hoje.
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Visão unificada das vendas, reposição preventiva e caderneta em tempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            type="button"
            onClick={() => navigate('/pdv')}
            className="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg text-label-lg font-bold shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">barcode_scanner</span>
            <span>+ Nova Venda Rápida</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/movimentacoes-e-perdas/nova')}
            className="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low text-primary-container border border-slate-200 font-label-lg text-label-lg font-bold shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] text-tertiary-fixed-dim">post_add</span>
            <span>+ Entrada de Estoque / NF-e</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/fluxo-de-caixa/abertura-fechamento')}
            className="flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-label-md transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">lock_clock</span>
            <span>Fechamento de Turno</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[22px]">point_of_sale</span>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface-variant">Faturamento do Dia</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed/40 text-tertiary font-label-sm font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
              Hoje
            </span>
          </div>
          <div className="my-space-xs">
            <span className="font-numeric-total text-numeric-total text-primary block tabular-nums">
              {formatBRL(revenue)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {salesCount} {salesCount === 1 ? 'venda hoje' : 'vendas hoje'} • Meta: {formatBRL(metaDiaria)}
            </span>
          </div>
          <div className="mt-space-md pt-space-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-label-sm text-on-surface-variant">Progresso da meta</span>
              <span className="font-label-sm font-bold text-tertiary">{metaProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
              <div className="h-full rounded-full bg-tertiary-fixed-dim" style={{ width: `${metaProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface-variant">Ticket Médio</span>
            </div>
          </div>
          <div className="my-space-xs">
            <span className="font-numeric-total text-numeric-total text-secondary block tabular-nums">
              {formatBRL(avgTicket)}
            </span>
            <span className="font-body-sm text-on-surface-variant">{salesCount} vendas concluídas</span>
          </div>
          <div className="mt-space-md flex items-center justify-between bg-surface-container-low px-space-sm py-1.5 rounded-lg">
            <span className="font-body-sm text-on-surface-variant">Validade próxima:</span>
            <span className="font-label-md font-bold text-on-surface">{summary?.expiringCount ?? 0} itens</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface-variant">Estoque Crítico</span>
            </div>
            <StatusBadge label="Repor Hoje" tone="danger" />
          </div>
          <div className="my-space-xs">
            <span className="font-numeric-total text-numeric-total text-error block tabular-nums">
              {criticalProducts.length} produtos
            </span>
            <span className="font-body-sm text-on-surface-variant">Abaixo do estoque de segurança</span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/produtos')}
              className="font-label-md font-bold text-error underline hover:text-on-error-container flex items-center gap-1"
            >
              <span>Ver lista e repor</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-space-md">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-tertiary-container">
                <span className="material-symbols-outlined text-[22px]">menu_book</span>
              </div>
              <span className="font-label-lg text-label-lg text-on-surface-variant">Crediário a Receber</span>
            </div>
            <StatusBadge label="Caderneta" tone="success" />
          </div>
          <div className="my-space-xs">
            <span className="font-numeric-total text-numeric-total text-tertiary block tabular-nums">
              {formatBRL(fiadoTotal)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {summary?.fiadoCustomers ?? 0} clientes com saldo ativo
            </span>
          </div>
          <div className="mt-space-md pt-space-xs flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/clientes')}
              className="font-label-md font-bold text-primary underline flex items-center gap-1"
            >
              <span>Gerenciar caderneta</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-space-md">
        <div className="xl:col-span-2 bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-space-lg py-space-md border-b border-surface-container flex items-center justify-between">
            <h2 className="font-headline-sm text-primary font-bold">Últimas Vendas do Turno</h2>
            <button
              type="button"
              onClick={() => navigate('/vendas-e-cupons')}
              className="font-label-md text-secondary hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
                  <th className="px-space-lg py-3">Cupom</th>
                  <th className="px-space-lg py-3">Cliente</th>
                  <th className="px-space-lg py-3">Pagamento</th>
                  <th className="px-space-lg py-3 text-right">Total</th>
                  <th className="px-space-lg py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {sales.slice(0, 5).map((sale) => (
                  <tr key={sale.id} className="hover:bg-surface-container-low/50">
                    <td className="px-space-lg py-3 font-label-md font-bold text-primary">{sale.cupom}</td>
                    <td className="px-space-lg py-3 text-body-md">{sale.customer}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="px-space-lg py-space-md border-b border-surface-container flex items-center justify-between">
            <h2 className="font-headline-sm text-primary font-bold">Reposição Urgente</h2>
            <StatusBadge label={`${criticalProducts.length} itens`} tone="danger" />
          </div>
          <div className="p-space-lg space-y-space-sm flex-1">
            {criticalProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-surface-container-low border border-surface-container"
              >
                <div>
                  <p className="font-label-md font-bold text-on-surface">{product.name}</p>
                  <p className="font-body-sm text-on-surface-variant">
                    Mínimo: {product.minStock} {product.unit}
                  </p>
                </div>
                <span className="font-label-lg font-bold text-error tabular-nums">
                  {product.stock} {product.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
