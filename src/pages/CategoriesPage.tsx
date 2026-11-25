import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import type { Category } from '../types/erp';
import { Modal, PageHeader } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

export function CategoriesPage() {
  const navigate = useNavigate();
  const { categories, deleteCategory } = useErp();
  const [viewItem, setViewItem] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Catálogo & Estoque"
        title="Categorias de Produtos"
        subtitle="Organize departamentos, metas de margem e agrupamentos do PDV."
        actions={
          <button
            type="button"
            onClick={() => navigate('/categorias/nova')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
            <span>Cadastrar Categoria</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-headline-sm font-bold text-primary">{cat.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-bold">
                  Margem alvo: {cat.marginTarget}%
                </span>
              </div>
              <p className="font-body-sm text-on-surface-variant mt-1">{cat.description}</p>
            </div>
            <div className="pt-2 border-t border-surface-container flex items-center justify-between text-body-sm">
              <div>
                <span className="text-on-surface-variant">Produtos: </span>
                <span className="font-label-lg font-bold text-on-surface tabular-nums">
                  {cat.productCount}
                </span>
              </div>
              <CrudActionButtons
                onView={() => setViewItem(cat)}
                onEdit={() => navigate(`/categorias/${cat.id}/editar`)}
                onDelete={() => {
                  setDeleteErr(null);
                  setDeleteTarget(cat);
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={!!viewItem}
        title={`Categoria — ${viewItem?.name ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="p-3.5 rounded-xl bg-surface-container-low space-y-2">
              <div>
                <p className="font-label-sm text-on-surface-variant">Nome</p>
                <p className="font-bold text-on-surface">{viewItem.name}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Descrição</p>
                <p className="text-on-surface">{viewItem.description || 'Sem descrição'}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <p className="font-label-sm text-on-surface-variant">Produtos vinculados</p>
                  <p className="font-bold text-primary">{viewItem.productCount}</p>
                </div>
                <div>
                  <p className="font-label-sm text-on-surface-variant">Margem alvo</p>
                  <p className="font-bold text-primary">{viewItem.marginTarget}%</p>
                </div>
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
            await deleteCategory(deleteTarget.id);
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
