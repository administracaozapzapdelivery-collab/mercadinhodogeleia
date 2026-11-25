import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

export function MovementsPage() {
  const navigate = useNavigate();
  const { movements } = useErp();

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
            {movements.map((m) => (
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
