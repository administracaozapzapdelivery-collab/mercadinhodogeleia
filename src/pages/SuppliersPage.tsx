import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

export function SuppliersPage() {
  const navigate = useNavigate();
  const { suppliers } = useErp();

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
