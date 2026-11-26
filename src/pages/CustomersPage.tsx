import React, { useMemo, useState } from 'react';
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

type CustomerQuickFilter = 'all' | 'with_debt' | 'em_dia' | 'atencao' | 'bloqueado';

const CUSTOMER_FILTER_LABELS: Record<Exclude<CustomerQuickFilter, 'all'>, string> = {
  with_debt: 'Com Saldo Devedor',
  em_dia: 'Em dia',
  atencao: 'Em Atenção',
  bloqueado: 'Bloqueados',
};

function isProtectedBalcaoCustomer(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return normalized === 'venda no balcão' || normalized === 'vendas no balcão';
}

export function CustomersPage() {
  const navigate = useNavigate();
  const { customers, deleteCustomer, refreshData } = useErp();
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<CustomerQuickFilter>('all');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [viewItem, setViewItem] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [entries, setEntries] = useState<FiadoEntry[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payError, setPayError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const stats = useMemo(() => {
    let totalDebt = 0;
    let totalLimit = 0;
    let withDebtCount = 0;
    let emDiaCount = 0;
    let atencaoCount = 0;
    let bloqueadoCount = 0;

    for (const c of customers) {
      totalDebt += c.currentDebt;
      totalLimit += c.creditLimit;
      if (c.currentDebt > 0) withDebtCount++;
      if (c.status === 'Em dia') emDiaCount++;
      else if (c.status === 'Atenção') atencaoCount++;
      else if (c.status === 'Bloqueado') bloqueadoCount++;
    }

    const availableCredit = Math.max(0, totalLimit - totalDebt);
    const creditUsagePct = totalLimit > 0 ? Math.min(100, Math.round((totalDebt / totalLimit) * 100)) : 0;

    return {
      totalCustomers: customers.length,
      totalDebt,
      totalLimit,
      availableCredit,
      creditUsagePct,
      withDebtCount,
      emDiaCount,
      atencaoCount,
      bloqueadoCount,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.cpf.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      switch (quickFilter) {
        case 'with_debt':
          return c.currentDebt > 0;
        case 'em_dia':
          return c.status === 'Em dia';
        case 'atencao':
          return c.status === 'Atenção';
        case 'bloqueado':
          return c.status === 'Bloqueado';
        default:
          return true;
      }
    });
  }, [customers, search, quickFilter]);

  const toggleFilter = (target: Exclude<CustomerQuickFilter, 'all'>) => {
    setQuickFilter((prev) => (prev === target ? 'all' : target));
  };

  async function openFiado(customer: Customer) {
    setSelected(customer);
    setPayError(null);
    setPayAmount(customer.currentDebt > 0 ? customer.currentDebt.toFixed(2) : '');
    const res = await fetch(`/api/customers/${customer.id}/fiado`);
    if (res.ok) setEntries(await res.json());
  }

  async function handleAbate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPayError('Informe um valor maior que zero para abater.');
      return;
    }
    setPaying(true);
    setPayError(null);
    try {
      const res = await fetch(`/api/customers/${selected.id}/fiado/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setPayError(body?.error ?? 'Não foi possível registrar o pagamento.');
        return;
      }
      await refreshData();
      setSelected(null);
    } finally {
      setPaying(false);
    }
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

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-space-md">
        <button
          type="button"
          onClick={() => setQuickFilter('all')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'all'
              ? 'border-primary/40 ring-2 ring-primary/15'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[22px]">groups</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Clientes</span>
            </div>
            <StatusBadge label="Cadastro" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.totalCustomers} {stats.totalCustomers === 1 ? 'cliente' : 'clientes'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              {stats.withDebtCount} {stats.withDebtCount === 1 ? 'com saldo em aberto' : 'com saldo em aberto'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('with_debt')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'with_debt'
              ? 'border-secondary ring-2 ring-secondary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">menu_book</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total a Receber</span>
            </div>
            <StatusBadge label="Caderneta" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-secondary block tabular-nums">
              {formatBRL(stats.totalDebt)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Limite total concedido: {formatBRL(stats.totalLimit)}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('em_dia')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'em_dia'
              ? 'border-tertiary ring-2 ring-tertiary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Clientes Em Dia</span>
            </div>
            <StatusBadge label="Regular" tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {stats.emDiaCount} {stats.emDiaCount === 1 ? 'cliente' : 'clientes'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Situação financeira regularizada
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('atencao')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'atencao'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">warning</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Em Atenção</span>
            </div>
            <StatusBadge
              label={stats.atencaoCount > 0 ? 'Cobrança' : 'Em dia'}
              tone={stats.atencaoCount > 0 ? 'warning' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.atencaoCount > 0 ? 'text-amber-800' : 'text-on-surface'
              }`}
            >
              {stats.atencaoCount} {stats.atencaoCount === 1 ? 'cliente' : 'clientes'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Saldo próximo do limite ou pendente
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('bloqueado')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            quickFilter === 'bloqueado'
              ? 'border-error ring-2 ring-error/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-error-container flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[22px]">block</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Bloqueados</span>
            </div>
            <StatusBadge
              label={stats.bloqueadoCount > 0 ? 'Restrito' : 'Nenhum'}
              tone={stats.bloqueadoCount > 0 ? 'danger' : 'success'}
            />
          </div>
          <div>
            <span
              className={`font-numeric-total text-2xl font-bold block tabular-nums ${
                stats.bloqueadoCount > 0 ? 'text-error' : 'text-on-surface'
              }`}
            >
              {stats.bloqueadoCount} {stats.bloqueadoCount === 1 ? 'cliente' : 'clientes'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Crediário suspenso no PDV
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Crédito Disponível</span>
            </div>
            <StatusBadge label={`Uso ${stats.creditUsagePct}%`} tone="neutral" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {formatBRL(stats.availableCredit)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Margem livre nos limites ativos
            </span>
          </div>
        </div>
      </section>

      <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center gap-space-sm">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, CPF ou telefone..."
          className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        {quickFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setQuickFilter('all')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 h-10 rounded-lg bg-primary-fixed text-primary-container font-label-md font-bold hover:bg-primary-fixed/80 transition-colors"
          >
            <span>Filtro: {CUSTOMER_FILTER_LABELS[quickFilter]}</span>
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
      </div>

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
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhum cliente encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const isProtected = isProtectedBalcaoCustomer(c.name);
                return (
                  <tr key={c.id} className="hover:bg-surface-container-low/50">
                    <td className="px-space-lg py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-label-lg font-bold text-on-surface">{c.name}</p>
                        {isProtected && (
                          <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-primary-container font-label-sm font-bold">
                            Padrão PDV
                          </span>
                        )}
                      </div>
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
                        onDelete={
                          isProtected
                            ? undefined
                            : () => {
                                setDeleteErr(null);
                                setDeleteTarget(c);
                              }
                        }
                      />
                    </td>
                  </tr>
                );
              })
            )}
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

            <form onSubmit={handleAbate} className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Valor a abater (R$)"
                  className="flex-1 min-w-[140px] h-10 px-3 rounded-lg border border-slate-200"
                />
                {selected.currentDebt > 0 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(selected.currentDebt.toFixed(2))}
                    className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md font-bold"
                  >
                    Quitar Tudo
                  </button>
                )}
                <button
                  type="submit"
                  disabled={paying}
                  className="px-4 py-2 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-md font-bold disabled:opacity-50"
                >
                  {paying ? 'Salvando...' : 'Abater Dívida'}
                </button>
              </div>
              {payError && (
                <p className="font-label-sm font-bold text-error">{payError}</p>
              )}
              {selected.currentDebt > 0 && selected.phone.replace(/\D/g, '').length >= 10 && (
                <a
                  href={`https://wa.me/55${selected.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Olá ${selected.name}, tudo bem? Passando para lembrar do seu saldo em aberto no crediário do Mercadinho do Geleia: ${formatBRL(selected.currentDebt)}.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-tertiary font-label-md font-bold hover:underline pt-1"
                >
                  <span className="material-symbols-outlined text-[18px]">chat</span>
                  <span>Enviar lembrete por WhatsApp</span>
                </a>
              )}
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
