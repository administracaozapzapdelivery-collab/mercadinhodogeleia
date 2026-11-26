import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import type { Category } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

type CategoryQuickFilter = 'all' | 'empty';

export function CategoriesPage() {
  const navigate = useNavigate();
  const { categories, deleteCategory } = useErp();
  const [quickFilter, setQuickFilter] = useState<CategoryQuickFilter>('all');
  const [viewItem, setViewItem] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const stats = useMemo(() => {
    let totalProducts = 0;
    let marginSum = 0;
    let activeCount = 0;
    let emptyCount = 0;
    let topMarginCat: Category | null = null;

    for (const cat of categories) {
      totalProducts += cat.productCount;
      marginSum += cat.marginTarget;
      if (cat.productCount > 0) activeCount++;
      else emptyCount++;
      if (!topMarginCat || cat.marginTarget > topMarginCat.marginTarget) {
        topMarginCat = cat;
      }
    }

    const totalCategories = categories.length;
    const avgProducts = totalCategories > 0 ? Math.round(totalProducts / totalCategories) : 0;
    const avgMargin = totalCategories > 0 ? Math.round(marginSum / totalCategories) : 0;

    return {
      totalCategories,
      activeCount,
      emptyCount,
      totalProducts,
      avgProducts,
      avgMargin,
      topMarginCat,
    };
  }, [categories]);

  const filtered = useMemo(() => {
    if (quickFilter === 'empty') {
      return categories.filter((c) => c.productCount === 0);
    }
    return categories;
  }, [categories, quickFilter]);

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

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
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
                <span className="material-symbols-outlined text-[22px]">category</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Categorias</span>
            </div>
            <StatusBadge label="Catálogo" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.totalCategories} {stats.totalCategories === 1 ? 'categoria' : 'categorias'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.activeCount} com produtos vinculados
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">inventory_2</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Produtos Vinculados</span>
            </div>
            <StatusBadge label="Mix" tone="neutral" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-secondary block tabular-nums">
              {stats.totalProducts} {stats.totalProducts === 1 ? 'produto' : 'produtos'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Média de {stats.avgProducts} por categoria
            </span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">percent</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Margem Alvo Média</span>
            </div>
            <StatusBadge label="Meta" tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {stats.avgMargin}%
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.topMarginCat
                ? `Maior alvo: ${stats.topMarginCat.name} (${stats.topMarginCat.marginTarget}%)`
                : 'Nenhuma categoria cadastrada'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setQuickFilter((prev) => (prev === 'empty' ? 'all' : 'empty'))}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'empty'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">folder_off</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Sem Produtos</span>
            </div>
            <StatusBadge
              label={stats.emptyCount > 0 ? 'Vazias' : 'Completas'}
              tone={stats.emptyCount > 0 ? 'warning' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.emptyCount > 0 ? 'text-amber-800' : 'text-on-surface'
              }`}
            >
              {stats.emptyCount} {stats.emptyCount === 1 ? 'categoria' : 'categorias'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.emptyCount > 0
                ? 'Departamentos sem itens vinculados'
                : 'Todas as categorias possuem produtos'}
            </span>
          </div>
        </button>
      </section>

      {quickFilter === 'empty' && (
        <div className="flex items-center justify-between bg-surface-container-lowest px-space-md py-2.5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="font-body-sm text-on-surface-variant">
            Exibindo apenas categorias sem produtos vinculados ({filtered.length})
          </span>
          <button
            type="button"
            onClick={() => setQuickFilter('all')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-fixed text-primary-container font-label-md font-bold hover:bg-primary-fixed/80 transition-colors"
          >
            <span>Mostrar todas</span>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-space-md">
        {filtered.length === 0 ? (
          <div className="col-span-full bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm text-center text-on-surface-variant">
            Nenhuma categoria encontrada para o filtro selecionado.
          </div>
        ) : (
          filtered.map((cat) => (
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
          ))
        )}
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
