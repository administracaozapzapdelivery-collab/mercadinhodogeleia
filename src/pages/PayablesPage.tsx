import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

export function PayablesPage() {
  const navigate = useNavigate();
  const { payables, payPayable } = useErp();

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
                  {p.status !== 'Pago' && (
                    <button
                      type="button"
                      onClick={() => void payPayable(p.id)}
                      className="px-3 py-1 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-sm font-bold"
                    >
                      Dar Baixa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
