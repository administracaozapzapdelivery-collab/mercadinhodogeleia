import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { PageHeader } from '../components/ui/SharedUI';

export function CategoriesPage() {
  const navigate = useNavigate();
  const { categories } = useErp();

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
              <span className="text-on-surface-variant">Produtos vinculados</span>
              <span className="font-label-lg font-bold text-on-surface tabular-nums">
                {cat.productCount}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
