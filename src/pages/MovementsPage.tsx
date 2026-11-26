import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

type MovementFilter = 'all' | 'Entrada' | 'Saída' | 'losses';

export function MovementsPage() {
  const navigate = useNavigate();
  const { movements } = useErp();
  const [filter, setFilter] = useState<MovementFilter>('all');

  const stats = useMemo(() => {
    let entriesCount = 0;
    let entriesQty = 0;
    let exitsCount = 0;
    let exitsQty = 0;
    let lossesCount = 0;
    let lossesQty = 0;

    for (const m of movements) {
      const absQty = Math.abs(m.quantity);
      if (m.type === 'Entrada') {
        entriesCount++;
        entriesQty += absQty;
      } else if (m.type === 'Saída') {
        exitsCount++;
        exitsQty += absQty;
      } else {
        lossesCount++;
        lossesQty += absQty;
      }
    }

    return {
      totalCount: movements.length,
      entriesCount,
      entriesQty,
      exitsCount,
      exitsQty,
      lossesCount,
      lossesQty,
    };
  }, [movements]);

  const filtered = useMemo(() => {
    if (filter === 'all') return movements;
    if (filter === 'losses') {
      return movements.filter((m) => m.type === 'Perda / Avaria' || m.type === 'Vencimento');
    }
    return movements.filter((m) => m.type === filter);
  }, [movements, filter]);

  const toggleFilter = (target: Exclude<MovementFilter, 'all'>) => {
    setFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Catálogo & Estoque"
        title="Movimentações e Perdas"
        subtitle="Entradas por NF-e, ajustes manuais, avarias e baixas por vencimento."
        actions={
          <button
            type="button"
            onClick={() => navigate('/movimentacoes-e-perdas/nova')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
            <span>Registrar Movimentação</span>
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
                <span className="material-symbols-outlined text-[22px]">swap_horiz</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Registros</span>
            </div>
            <StatusBadge label="Histórico" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.totalCount} {stats.totalCount === 1 ? 'registro' : 'registros'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Todas as movimentações de estoque
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('Entrada')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'Entrada'
              ? 'border-tertiary ring-2 ring-tertiary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">add_circle</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Entradas</span>
            </div>
            <StatusBadge label={`${stats.entriesCount} lanç.`} tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              +{stats.entriesQty} un.
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Compras, NF-e e reposições
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('Saída')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'Saída'
              ? 'border-secondary ring-2 ring-secondary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">remove_circle</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Saídas</span>
            </div>
            <StatusBadge label={`${stats.exitsCount} lanç.`} tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-secondary block tabular-nums">
              {stats.exitsQty} un.
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Ajustes e saídas manuais
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('losses')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'losses'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">report_problem</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Perdas / Vencidos</span>
            </div>
            <StatusBadge
              label={`${stats.lossesCount} lanç.`}
              tone={stats.lossesCount > 0 ? 'danger' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.lossesCount > 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {stats.lossesQty} un.
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Avarias e baixas por validade
            </span>
          </div>
        </button>
      </section>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Data</th>
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3">Tipo</th>
              <th className="px-space-lg py-3 text-right">Qtd</th>
              <th className="px-space-lg py-3">Motivo / Documento</th>
              <th className="px-space-lg py-3">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhuma movimentação encontrada para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
              <tr key={m.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 text-body-sm text-on-surface-variant">{m.date}</td>
                <td className="px-space-lg py-3 font-label-lg font-bold">{m.productName}</td>
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={m.type}
                    tone={
                      m.type === 'Entrada'
                        ? 'success'
                        : m.type === 'Saída'
                        ? 'info'
                        : 'danger'
                    }
                  />
                </td>
                <td className="px-space-lg py-3 text-right font-bold tabular-nums">
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </td>
                <td className="px-space-lg py-3 text-body-md">{m.reason}</td>
                <td className="px-space-lg py-3 text-body-md">{m.operator}</td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
