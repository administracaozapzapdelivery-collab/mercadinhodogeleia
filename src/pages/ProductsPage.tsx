import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

export function ProductsPage() {
  const navigate = useNavigate();
  const { products, deleteProduct } = useErp();
  const [search, setSearch] = useState('');

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search)
  );

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Catálogo & Estoque"
        title="Produtos e Estoque"
        subtitle="Gerencie preços de venda, margem, estoque mínimo e código de barras."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/etiquetas')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
              <span>Gerar Etiquetas</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/produtos/novo')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Cadastrar Produto</span>
            </button>
          </div>
        }
      />

      <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, SKU ou código de barras..."
          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">SKU</th>
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3">Categoria</th>
              <th className="px-space-lg py-3 text-right">Custo</th>
              <th className="px-space-lg py-3 text-right">Venda</th>
              <th className="px-space-lg py-3 text-right">Estoque</th>
              <th className="px-space-lg py-3">Situação</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-md text-secondary font-bold">{p.sku}</td>
                <td className="px-space-lg py-3">
                  <div className="flex items-center gap-2">
                    <p className="font-label-lg font-bold text-on-surface">{p.name}</p>
                    {p.adminOnly && (
                      <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary-container font-label-sm font-bold">
                        Somente Admin
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-on-surface-variant">{p.barcode}</p>
                </td>
                <td className="px-space-lg py-3">{p.category}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(p.costPrice)}</td>
                <td className="px-space-lg py-3 text-right font-label-lg font-bold text-primary tabular-nums">
                  {formatBRL(p.salePrice)}
                </td>
                <td className="px-space-lg py-3 text-right font-bold tabular-nums">
                  {p.stock} {p.unit}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={p.stock <= p.minStock ? 'Estoque Crítico' : 'Normal'}
                    tone={p.stock <= p.minStock ? 'danger' : 'success'}
                  />
                </td>
                <td className="px-space-lg py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/etiquetas?productId=${p.id}`)}
                      className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-sm font-bold"
                      title="Gerar etiqueta deste produto"
                    >
                      Etiqueta
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteProduct(p.id)}
                      className="px-2.5 py-1 rounded-lg bg-error-container text-on-error-container font-label-sm font-bold hover:opacity-80"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
