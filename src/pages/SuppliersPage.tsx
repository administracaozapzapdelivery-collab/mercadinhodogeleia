import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import type { Supplier } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

type SupplierFilter = 'all' | 'fast' | 'slow';

export function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers, deleteSupplier } = useErp();
  const [filter, setFilter] = useState<SupplierFilter>('all');
  const [viewItem, setViewItem] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    const categories = new Set<string>();
    let leadSum = 0;
    let minLead = Number.POSITIVE_INFINITY;
    let fastCount = 0;
    let slowCount = 0;

    for (const s of suppliers) {
      if (s.category) categories.add(s.category);
      leadSum += s.leadTimeDays;
      if (s.leadTimeDays < minLead) minLead = s.leadTimeDays;
      if (s.leadTimeDays <= 3) fastCount++;
      if (s.leadTimeDays > 7) slowCount++;
    }

    const total = suppliers.length;
    const avgLead = total > 0 ? Math.round(leadSum / total) : 0;

    return {
      total,
      categoriesCount: categories.size,
      avgLead,
      minLead: total > 0 ? minLead : 0,
      fastCount,
      slowCount,
    };
  }, [suppliers]);

  const filtered = useMemo(() => {
    if (filter === 'fast') return suppliers.filter((s) => s.leadTimeDays <= 3);
    if (filter === 'slow') return suppliers.filter((s) => s.leadTimeDays > 7);
    return suppliers;
  }, [suppliers, filter]);

  const toggleFilter = (target: Exclude<SupplierFilter, 'all'>) => {
    setFilter((prev) => (prev === target ? 'all' : target));
  };

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
                <span className="material-symbols-outlined text-[22px]">local_shipping</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Fornecedores</span>
            </div>
            <StatusBadge label="Parceiros" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.total} {stats.total === 1 ? 'fornecedor' : 'fornecedores'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.categoriesCount} {stats.categoriesCount === 1 ? 'categoria atendida' : 'categorias atendidas'}
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Prazo Médio</span>
            </div>
            <StatusBadge label="Entrega" tone="neutral" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-secondary block tabular-nums">
              {stats.avgLead} {stats.avgLead === 1 ? 'dia' : 'dias'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Menor prazo cadastrado: {stats.minLead}d
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => toggleFilter('fast')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'fast'
              ? 'border-tertiary ring-2 ring-tertiary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">bolt</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Entrega Rápida (≤ 3d)</span>
            </div>
            <StatusBadge label="Ágil" tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {stats.fastCount} {stats.fastCount === 1 ? 'fornecedor' : 'fornecedores'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Reposição expressa de estoque
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('slow')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'slow'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">hourglass_top</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Prazo Longo (&gt; 7d)</span>
            </div>
            <StatusBadge
              label={stats.slowCount > 0 ? 'Planejar' : 'Nenhum'}
              tone={stats.slowCount > 0 ? 'warning' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.slowCount > 0 ? 'text-amber-800' : 'text-on-surface'
              }`}
            >
              {stats.slowCount} {stats.slowCount === 1 ? 'fornecedor' : 'fornecedores'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Exigem pedido antecipado
            </span>
          </div>
        </button>
      </section>

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhum fornecedor encontrado para o filtro selecionado.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
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
              ))
            )}
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
