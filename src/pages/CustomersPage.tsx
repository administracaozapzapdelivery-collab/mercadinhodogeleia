import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Customer } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';

interface FiadoEntry {
  id: string;
  type: string;
  amount: number;
  note: string;
  date: string;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { customers, refreshData } = useErp();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<FiadoEntry[]>([]);
  const [payAmount, setPayAmount] = useState('');

  async function openFiado(customer: Customer) {
    setSelected(customer);
    setPayAmount(String(customer.currentDebt || ''));
    const res = await fetch(`/api/customers/${customer.id}/fiado`);
    if (res.ok) setEntries(await res.json());
  }

  async function handleAbate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await fetch(`/api/customers/${selected.id}/fiado/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(payAmount) }),
    });
    await refreshData();
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Pessoas & Caderneta"
        title="Clientes e Controle de Crediário"
        subtitle="Acompanhe limites de crédito, saldos em aberto e receba pagamentos do crediário."
        actions={
          <button
            type="button"
            onClick={() => navigate('/clientes/novo')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
            <span>Cadastrar Cliente</span>
          </button>
        }
      />

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Cliente</th>
              <th className="px-space-lg py-3">Telefone</th>
              <th className="px-space-lg py-3 text-right">Limite</th>
              <th className="px-space-lg py-3 text-right">Saldo Devedor</th>
              <th className="px-space-lg py-3">Status</th>
              <th className="px-space-lg py-3 text-right">Caderneta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3">
                  <p className="font-label-lg font-bold text-on-surface">{c.name}</p>
                  <p className="font-body-sm text-on-surface-variant">{c.cpf}</p>
                </td>
                <td className="px-space-lg py-3">{c.phone}</td>
                <td className="px-space-lg py-3 text-right tabular-nums">{formatBRL(c.creditLimit)}</td>
                <td className="px-space-lg py-3 text-right font-label-lg font-bold text-primary tabular-nums">
                  {formatBRL(c.currentDebt)}
                </td>
                <td className="px-space-lg py-3">
                  <StatusBadge
                    label={c.status}
                    tone={
                      c.status === 'Em dia'
                        ? 'success'
                        : c.status === 'Atenção'
                        ? 'warning'
                        : 'danger'
                    }
                  />
                </td>
                <td className="px-space-lg py-3 text-right">
                  <button
                    type="button"
                    onClick={() => void openFiado(c)}
                    className="px-3 py-1.5 rounded-lg bg-primary-fixed text-primary-container font-label-sm font-bold hover:bg-primary-fixed-dim"
                  >
                    Receber / Extrato
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!selected}
        title={`Crediário — ${selected?.name ?? ''}`}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-container-low flex justify-between items-center">
              <span className="font-label-md">Saldo Devedor Atual</span>
              <span className="font-headline-sm font-bold text-primary tabular-nums">
                {formatBRL(selected.currentDebt)}
              </span>
            </div>

            <form onSubmit={handleAbate} className="flex gap-2">
              <input
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Valor a abater (R$)"
                className="flex-1 h-10 px-3 rounded-lg border border-slate-200"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-md font-bold"
              >
                Abater Dívida
              </button>
            </form>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {entries.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Nenhuma movimentação de crediário registrada.</p>
              ) : (
                entries.map((entry) => (
                  <div key={entry.id} className="flex justify-between p-2 rounded bg-surface-container-low text-body-sm">
                    <div>
                      <p className="font-bold">{entry.type === 'PAGAMENTO_ABATE' ? 'Pagamento' : 'Compra no Crediário'}</p>
                      <p className="text-on-surface-variant">{entry.date} • {entry.note}</p>
                    </div>
                    <span className="font-bold tabular-nums">{formatBRL(entry.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
