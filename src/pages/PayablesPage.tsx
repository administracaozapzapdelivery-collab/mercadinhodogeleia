import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { PayableAccount } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

type PayableFilter = 'all' | 'Pendente' | 'Vencido' | 'Pago';

export function PayablesPage() {
  const navigate = useNavigate();
  const { payables, payPayable, deletePayable } = useErp();
  const [filter, setFilter] = useState<PayableFilter>('all');
  const [viewItem, setViewItem] = useState<PayableAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayableAccount | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    let totalAmount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidCount = 0;
    let paidAmount = 0;

    for (const p of payables) {
      totalAmount += p.amount;
      if (p.status === 'Pendente') {
        pendingCount++;
        pendingAmount += p.amount;
      } else if (p.status === 'Vencido') {
        overdueCount++;
        overdueAmount += p.amount;
      } else if (p.status === 'Pago') {
        paidCount++;
        paidAmount += p.amount;
      }
    }

    return {
      totalCount: payables.length,
      totalAmount,
      pendingCount,
      pendingAmount,
      overdueCount,
      overdueAmount,
      paidCount,
      paidAmount,
    };
  }, [payables]);

  const filtered = useMemo(() => {
    if (filter === 'all') return payables;
    return payables.filter((p) => p.status === filter);
  }, [payables, filter]);

  const toggleFilter = (target: Exclude<PayableFilter, 'all'>) => {
    setFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Financeiro & Gestão"
        title="Contas a Pagar"
        subtitle="Controle de boletos, notas fiscais de fornecedores e despesas fixas."
        actions={
          <button
            type="button"
            onClick={() => navigate('/contas-a-pagar/nova')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Cadastrar Conta a Pagar</span>
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
                <span className="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Contas</span>
            </div>
            <StatusBadge label={`${stats.totalCount}`} tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {formatBRL(stats.totalAmount)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Soma de todos os títulos lançados
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('Pendente')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'Pendente'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Pendentes</span>
            </div>
            <StatusBadge label={`${stats.pendingCount} títulos`} tone="warning" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-amber-800 block tabular-nums">
              {formatBRL(stats.pendingAmount)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Aguardando vencimento / baixa
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('Vencido')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'Vencido'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">event_busy</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Vencidas</span>
            </div>
            <StatusBadge
              label={`${stats.overdueCount} títulos`}
              tone={stats.overdueCount > 0 ? 'danger' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.overdueCount > 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {formatBRL(stats.overdueAmount)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Contas em atraso para regularizar
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('Pago')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'Pago'
              ? 'border-tertiary ring-2 ring-tertiary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Pagas</span>
            </div>
            <StatusBadge label={`${stats.paidCount} títulos`} tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {formatBRL(stats.paidAmount)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Contas já quitadas
            </span>
          </div>
        </button>
      </section>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Descrição</th>
              <th className="px-space-lg py-3">Fornecedor</th>
              <th className="px-space-lg py-3">Vencimento</th>
              <th className="px-space-lg py-3 text-right">Valor</th>
              <th className="px-space-lg py-3">Status</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhuma conta encontrada para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
              <tr key={p.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-lg font-bold text-on-surface">{p.description}</td>
                <td className="px-space-lg py-3">{p.supplier}</td>
                <td className="px-space-lg py-3 tabular-nums">{p.dueDate}</td>
                <td className="px-space-lg py-3 text-right font-label-lg font-bold text-primary tabular-nums">
                  {formatBRL(p.amount)}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={p.status}
                    tone={p.status === 'Pago' ? 'success' : p.status === 'Pendente' ? 'warning' : 'danger'}
                  />
                </td>
                <td className="px-space-lg py-3 text-right">
                  <CrudActionButtons
                    extra={
                      p.status !== 'Pago' ? (
                        <button
                          type="button"
                          onClick={() => void payPayable(p.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-sm font-bold hover:opacity-90"
                        >
                          Baixar
                        </button>
                      ) : undefined
                    }
                    onView={() => setViewItem(p)}
                    onEdit={() => navigate(`/contas-a-pagar/${p.id}/editar`)}
                    onDelete={() => {
                      setDeleteErr(null);
                      setDeleteTarget(p);
                    }}
                  />
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!viewItem}
        title={`Conta a Pagar — ${viewItem?.description ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-container-low">
              <div className="col-span-2">
                <p className="font-label-sm text-on-surface-variant">Descrição</p>
                <p className="font-bold text-on-surface">{viewItem.description}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Fornecedor</p>
                <p className="font-bold text-on-surface">{viewItem.supplier}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Categoria</p>
                <p className="font-bold text-on-surface">{viewItem.category}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Vencimento</p>
                <p className="font-bold text-on-surface">{viewItem.dueDate}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Valor</p>
                <p className="font-bold text-primary">{formatBRL(viewItem.amount)}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Situação</p>
                <p className="font-bold text-on-surface">{viewItem.status}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <DeleteConfirmModal
        open={!!deleteTarget}
        itemLabel={deleteTarget?.description ?? ''}
        loading={deleting}
        error={deleteErr}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          setDeleteErr(null);
          try {
            await deletePayable(deleteTarget.id);
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
