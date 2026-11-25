import { useEffect, useState } from 'react';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

interface ExpiringItem {
  id: string;
  name: string;
  category: string;
  expiryDate: string;
  stock: number;
  unit: string;
}

export function ExpiryAlertsPage() {
  const [expiring, setExpiring] = useState<ExpiringItem[]>([]);

  useEffect(() => {
    fetch('/api/products/expiring')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExpiring(data))
      .catch(() => setExpiring([]));
  }, []);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Prevenção de Perdas"
        title="Alerta de Validade"
        subtitle="Produtos filtrados automaticamente por data_validade <= CURRENT_DATE + configuracoes.dias_alerta_validade."
      />

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3">Categoria</th>
              <th className="px-space-lg py-3">Validade</th>
              <th className="px-space-lg py-3 text-right">Estoque Atual</th>
              <th className="px-space-lg py-3">Prioridade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {expiring.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhum produto próximo do vencimento dentro da janela configurada.
                </td>
              </tr>
            ) : (
              expiring.map((p) => (
                <tr key={p.id} className="hover:bg-surface-container-low/50">
                  <td className="px-space-lg py-3 font-label-lg font-bold text-on-surface">{p.name}</td>
                  <td className="px-space-lg py-3">{p.category}</td>
                  <td className="px-space-lg py-3 font-label-md font-bold tabular-nums">
                    {p.expiryDate}
                  </td>
                  <td className="px-space-lg py-3 text-right tabular-nums">
                    {p.stock} {p.unit}
                  </td>
                  <td className="px-space-lg py-3">
                    <StatusBadge label="Vencimento Próximo" tone="danger" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
