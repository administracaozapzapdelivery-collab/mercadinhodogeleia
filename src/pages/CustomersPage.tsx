import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import type { Customer } from '../types/erp';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';
import { CrudActionButtons, DeleteConfirmModal } from '../components/ui/CrudActions';

interface FiadoEntry {
  id: string;
  type: string;
  amount: number;
  note: string;
  date: string;
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { customers, deleteCustomer, refreshData } = useErp();
  const [selected, setSelected] = useState<Customer | null>(null);
  const [viewItem, setViewItem] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
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
              <th className="px-space-lg py-3 text-right">Ações</th>
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
                <td className="px-space-lg py-3 text-right">
                  <CrudActionButtons
                    onView={() => setViewItem(c)}
                    onEdit={() => navigate(`/clientes/${c.id}/editar`)}
                    onDelete={() => {
                      setDeleteErr(null);
                      setDeleteTarget(c);
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
        title={`Cliente — ${viewItem?.name ?? ''}`}
        onClose={() => setViewItem(null)}
      >
        {viewItem && (
          <div className="space-y-3 font-body-md">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-label-sm text-on-surface-variant">Nome Completo</p>
                <p className="font-bold text-on-surface">{viewItem.name}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">CPF</p>
                <p className="font-bold text-on-surface">{viewItem.cpf || 'Não informado'}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Telefone / WhatsApp</p>
                <p className="font-bold text-on-surface">{viewItem.phone}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Situação</p>
                <p className="font-bold text-on-surface">{viewItem.status}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Limite de Crédito</p>
                <p className="font-bold text-primary">{formatBRL(viewItem.creditLimit)}</p>
              </div>
              <div>
                <p className="font-label-sm text-on-surface-variant">Saldo Devedor</p>
                <p className="font-bold text-error">{formatBRL(viewItem.currentDebt)}</p>
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
            await deleteCustomer(deleteTarget.id);
            setDeleteTarget(null);
          } catch (err) {
            setDeleteErr((err as Error).message);
          } finally {
            setDeleting(false);
          }
        }}
      />

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
