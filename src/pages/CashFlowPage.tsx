import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

export function CashFlowPage() {
  const navigate = useNavigate();
  const { shifts } = useErp();

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Financeiro & Gestão"
        title="Fluxo de Caixa e Turnos"
        subtitle="Abertura, conferência de gaveta e fechamento por operador."
        actions={
          <button
            type="button"
            onClick={() => navigate('/fluxo-de-caixa/abertura-fechamento')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">lock_open</span>
            <span>Abertura / Fechamento de Caixa</span>
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Terminal</th>
              <th className="px-space-lg py-3">Operador</th>
              <th className="px-space-lg py-3">Abertura</th>
              <th className="px-space-lg py-3 text-right">Fundo Inicial</th>
              <th className="px-space-lg py-3 text-right">Vendas Turno</th>
              <th className="px-space-lg py-3 text-right">Saldo Esperado</th>
              <th className="px-space-lg py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {shifts.map((s) => (
              <tr key={s.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-lg font-bold text-primary">{s.register}</td>
                <td className="px-space-lg py-3">{s.operator}</td>
                <td className="px-space-lg py-3 text-body-sm text-on-surface-variant">{s.openedAt}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(s.openingBalance)}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(s.totalSales)}</td>
                <td className="px-space-lg py-3 text-right font-label-lg font-bold tabular-nums">
                  {formatBRL(s.expectedBalance)}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge label={s.status} tone={s.status === 'Aberto' ? 'success' : 'neutral'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
