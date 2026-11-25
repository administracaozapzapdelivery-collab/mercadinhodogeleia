import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Product } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

export function ProductsPage() {
  const navigate = useNavigate();
  const { products, deleteProduct } = useErp();
  const [search, setSearch] = useState('');
  const [viewItem, setViewItem] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
                  <CrudActionButtons
                    extra={
                      <button
                        type="button"
                        onClick={() => navigate(`/etiquetas?productId=${p.id}`)}
                        className="w-8 h-8 rounded-lg bg-primary-fixed/60 text-primary-container hover:bg-primary-fixed inline-flex items-center justify-center transition-colors"
                        title="Gerar etiqueta"
                        aria-label="Gerar etiqueta"
                      >
                        <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
                      </button>
                    }
                    onView={() => setViewItem(p)}
                    onEdit={() => navigate(`/produtos/${p.id}/editar`)}
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
        title={`Produto — ${viewItem?.name ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-label-sm text-on-surface-variant">SKU / Código</p>
                <p className="font-bold text-on-surface">{viewItem.sku} • {viewItem.barcode || 'Sem barras'}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Categoria</p>
                <p className="font-bold text-on-surface">{viewItem.category}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Preço de Custo</p>
                <p className="font-bold text-on-surface">{formatBRL(viewItem.costPrice)}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Preço de Venda</p>
                <p className="font-bold text-primary">{formatBRL(viewItem.salePrice)} / {viewItem.unit}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Estoque Atual / Mínimo</p>
                <p className="font-bold text-on-surface">{viewItem.stock} / {viewItem.minStock} {viewItem.unit}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Validade</p>
                <p className="font-bold text-on-surface">{viewItem.expiryDate || 'Não informada'}</p>
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
            await deleteProduct(deleteTarget.id);
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
