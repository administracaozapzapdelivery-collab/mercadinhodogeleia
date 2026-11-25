import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { PayableAccount } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

export function PayablesPage() {
  const navigate = useNavigate();
  const { payables, payPayable, deletePayable } = useErp();
  const [viewItem, setViewItem] = useState<PayableAccount | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayableAccount | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
            {payables.map((p) => (
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
            ))}
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
