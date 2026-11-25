import { useEffect, useState } from 'react';
import { formatBRL } from '../data/mockData';
import { PageHeader, StatusBadge } from '../components/ui/SharedUI';

interface AbcItem {
  productId: string;
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  grossProfit: number;
  sharePct: number;
  cumulativePct: number;
  abcClass: 'A' | 'B' | 'C';
}

export function ReportsPage() {
  const [items, setItems] = useState<AbcItem[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetch('/api/reports/abc')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setItems(data.items);
          setTotalRevenue(data.totalRevenue);
        }
      })
      .catch(() => null);
  }, []);

  const totalProfit = items.reduce((acc, i) => acc + i.grossProfit, 0);

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Inteligência Comercial"
        title="Relatórios e Curva ABC"
        subtitle="Classificação real baseada em venda_itens (Classe A: até 80%, B: 80%–95%, C: 95%–100%)."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm">
          <span className="font-label-sm uppercase text-secondary">Faturamento Analisado</span>
          <p className="font-numeric-display text-primary mt-1 tabular-nums">
            {formatBRL(totalRevenue)}
          </p>
        </div>
        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm">
          <span className="font-label-sm uppercase text-secondary">Lucro Bruto Real</span>
          <p className="font-numeric-display text-tertiary mt-1 tabular-nums">
            {formatBRL(totalProfit)}
          </p>
        </div>
        <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm">
          <span className="font-label-sm uppercase text-secondary">Produtos Classe A</span>
          <p className="font-numeric-display text-secondary mt-1 tabular-nums">
            {items.filter((i) => i.abcClass === 'A').length} itens
          </p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Classe ABC</th>
              <th className="px-space-lg py-3">Produto</th>
              <th className="px-space-lg py-3 text-right">Qtd Vendida</th>
              <th className="px-space-lg py-3 text-right">Faturamento</th>
              <th className="px-space-lg py-3 text-right">Lucro Bruto</th>
              <th className="px-space-lg py-3 text-right">% Acumulado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {items.map((item) => (
              <tr key={item.productId} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={`Classe ${item.abcClass}`}
                    tone={item.abcClass === 'A' ? 'success' : item.abcClass === 'B' ? 'info' : 'neutral'}
                  />
                </td>
                <td className="px-space-lg py-3 font-label-lg font-bold">{item.name}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{item.qtySold}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(item.revenue)}</td>
                <td className="px-space-lg py-3 text-right font-bold text-tertiary tabular-nums">
                  {formatBRL(item.grossProfit)}
                </td>
                <td className="px-space-lg py-3 text-right tabular-nums">{item.cumulativePct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
