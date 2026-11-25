import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import type { Supplier } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

export function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers, deleteSupplier } = useErp();
  const [viewItem, setViewItem] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Pessoas & Parceiros"
        title="Fornecedores"
        subtitle="Cadastro de distribuidores, prazos de entrega e contatos comerciais."
        actions={
          <button
            type="button"
            onClick={() => navigate('/fornecedores/novo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Cadastrar Fornecedor</span>
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Fornecedor</th>
              <th className="px-space-lg py-3">CNPJ</th>
              <th className="px-space-lg py-3">Contato</th>
              <th className="px-space-lg py-3">Categoria</th>
              <th className="px-space-lg py-3 text-right">Prazo Entrega</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-lg font-bold text-on-surface">{s.name}</td>
                <td className="px-space-lg py-3 text-body-sm text-on-surface-variant">{s.cnpj}</td>
                <td className="px-space-lg py-3">
                  <p className="text-body-md">{s.contact}</p>
                  <p className="text-body-sm text-on-surface-variant">{s.phone}</p>
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge label={s.category} tone="info" />
                </td>
                <td className="px-space-lg py-3 text-right font-bold">{s.leadTimeDays} dias</td>
                <td className="px-space-lg py-3 text-right">
                  <CrudActionButtons
                    onView={() => setViewItem(s)}
                    onEdit={() => navigate(`/fornecedores/${s.id}/editar`)}
                    onDelete={() => {
                      setDeleteErr(null);
                      setDeleteTarget(s);
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
        title={`Fornecedor — ${viewItem?.name ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-label-sm text-on-surface-variant">Empresa</p>
                <p className="font-bold text-on-surface">{viewItem.name}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">CNPJ</p>
                <p className="font-bold text-on-surface">{viewItem.cnpj || 'Não informado'}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Vendedor / Contato</p>
                <p className="font-bold text-on-surface">{viewItem.contact || 'Não informado'}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Telefone / WhatsApp</p>
                <p className="font-bold text-on-surface">{viewItem.phone}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Categoria</p>
                <p className="font-bold text-primary">{viewItem.category}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Prazo de Entrega</p>
                <p className="font-bold text-on-surface">{viewItem.leadTimeDays} dias</p>
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
            await deleteSupplier(deleteTarget.id);
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
