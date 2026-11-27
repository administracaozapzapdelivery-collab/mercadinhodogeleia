import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatBRL } from '../data/mockData';
import { Modal, PageHeader, StatusBadge } from '../components/ui/SharedUI';

interface ComandaItem {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ComandaRow {
  id: string;
  identificador: string;
  observacao: string;
  status: 'LIVRE' | 'ABERTA';
  cadastrada: boolean;
  createdAt: string;
  updatedAt: string;
  operator: string;
  items: ComandaItem[];
  total: number;
}

type ComandaFilter = 'all' | 'LIVRE' | 'ABERTA';

export function ComandasPage() {
  const [comandas, setComandas] = useState<ComandaRow[]>([]);
  const [filter, setFilter] = useState<ComandaFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [identificador, setIdentificador] = useState('');
  const [observacao, setObservacao] = useState('');
  const [prefixo, setPrefixo] = useState('MESA');
  const [inicio, setInicio] = useState('1');
  const [fim, setFim] = useState('10');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComandas = useCallback(async () => {
    const res = await fetch('/api/comandas');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) setComandas(data);
    }
  }, []);

  useEffect(() => {
    void loadComandas();
  }, [loadComandas]);

  const stats = useMemo(() => {
    let livres = 0;
    let abertas = 0;
    let totalConsumo = 0;

    for (const c of comandas) {
      if (c.status === 'ABERTA') {
        abertas++;
        totalConsumo += c.total;
      } else {
        livres++;
      }
    }

    return {
      total: comandas.length,
      livres,
      abertas,
      totalConsumo,
    };
  }, [comandas]);

  const filtered = useMemo(() => {
    if (filter === 'all') return comandas;
    return comandas.filter((c) => c.status === filter);
  }, [comandas, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload =
        mode === 'batch'
          ? {
              cadastrada: true,
              prefixo: prefixo.trim(),
              inicio: Number(inicio),
              fim: Number(fim),
              observacao: observacao.trim(),
            }
          : {
              cadastrada: true,
              identificador: identificador.trim(),
              observacao: observacao.trim(),
            };

      const res = await fetch('/api/comandas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? 'Erro ao cadastrar comanda.');
        return;
      }
      setIdentificador('');
      setObservacao('');
      setModalOpen(false);
      await loadComandas();
    } finally {
      setSaving(false);
    }
  }

  async function handleClearOrRemove(c: ComandaRow, archive: boolean) {
    await fetch(`/api/comandas/${c.id}${archive ? '?mode=archive' : ''}`, {
      method: 'DELETE',
    });
    await loadComandas();
  }

  const toggleFilter = (target: Exclude<ComandaFilter, 'all'>) => {
    setFilter((prev) => (prev === target ? 'all' : target));
  };

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Atendimento & Noite"
        title="Comandas e Mesas"
        subtitle="Cadastre as comandas fixas (ex: MESA 01 a 10) para ficarem sempre disponíveis no PDV."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('batch');
                setError(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">library_add</span>
              <span>Gerar em Lote</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('single');
                setError(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
              <span>Cadastrar Comanda</span>
            </button>
          </div>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'all'
              ? 'border-primary/40 ring-2 ring-primary/15'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[22px]">restaurant</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total de Comandas</span>
            </div>
            <StatusBadge label="PDV" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-primary block tabular-nums">
              {stats.total} {stats.total === 1 ? 'comanda' : 'comandas'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Disponíveis na frente de caixa
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('LIVRE')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'LIVRE'
              ? 'border-tertiary ring-2 ring-tertiary/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-tertiary-fixed/50 flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[22px]">check_circle</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Livres</span>
            </div>
            <StatusBadge label="Disponíveis" tone="success" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-tertiary block tabular-nums">
              {stats.livres} {stats.livres === 1 ? 'comanda' : 'comandas'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Prontas para novo atendimento
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => toggleFilter('ABERTA')}
          className={`text-left bg-surface-container-lowest p-space-md rounded-xl border shadow-sm transition-all flex flex-col justify-between ${
            filter === 'ABERTA'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
                <span className="material-symbols-outlined text-[22px]">receipt_long</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Em Uso</span>
            </div>
            <StatusBadge
              label={stats.abertas > 0 ? 'Consumindo' : 'Vazias'}
              tone={stats.abertas > 0 ? 'warning' : 'neutral'}
            />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-amber-800 block tabular-nums">
              {stats.abertas} {stats.abertas === 1 ? 'comanda' : 'comandas'}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Com itens lançados no momento
            </span>
          </div>
        </button>

        <div className="bg-surface-container-lowest p-space-md rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-space-sm">
              <div className="w-10 h-10 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[22px]">payments</span>
              </div>
              <span className="font-label-lg text-on-surface-variant">Total em Consumo</span>
            </div>
            <StatusBadge label="Em aberto" tone="info" />
          </div>
          <div>
            <span className="font-numeric-total text-2xl font-bold text-secondary block tabular-nums">
              {formatBRL(stats.totalConsumo)}
            </span>
            <span className="font-body-sm text-on-surface-variant">
              Soma das comandas em uso
            </span>
          </div>
        </div>
      </section>

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Comanda / Mesa</th>
              <th className="px-space-lg py-3">Status</th>
              <th className="px-space-lg py-3">Itens</th>
              <th className="px-space-lg py-3 text-right">Consumo Atual</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-space-lg py-8 text-center text-on-surface-variant">
                  Nenhuma comanda cadastrada. Clique em &ldquo;Cadastrar Comanda&rdquo; ou &ldquo;Gerar em Lote&rdquo;.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-surface-container-low/50">
                  <td className="px-space-lg py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-label-lg font-bold text-primary">{c.identificador}</span>
                      {!c.cadastrada && (
                        <StatusBadge label="Avulsa" tone="neutral" />
                      )}
                    </div>
                    {c.observacao && (
                      <p className="font-body-sm text-on-surface-variant">{c.observacao}</p>
                    )}
                  </td>
                  <td className="px-space-lg py-3">
                    <StatusBadge
                      label={c.status === 'ABERTA' ? 'Em Uso' : 'Livre'}
                      tone={c.status === 'ABERTA' ? 'warning' : 'success'}
                    />
                  </td>
                  <td className="px-space-lg py-3 font-body-sm text-on-surface-variant">
                    {c.items.length === 0
                      ? 'Nenhum item lançado'
                      : c.items.map((it) => `${it.quantity}x ${it.productName}`).join(', ')}
                  </td>
                  <td className="px-space-lg py-3 text-right font-label-lg font-bold text-primary tabular-nums">
                    {c.status === 'ABERTA' ? formatBRL(c.total) : '—'}
                  </td>
                  <td className="px-space-lg py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {c.status === 'ABERTA' && (
                        <button
                          type="button"
                          onClick={() => void handleClearOrRemove(c, false)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-label-sm font-bold"
                        >
                          Liberar
                        </button>
                      )}
                      {c.cadastrada && (
                        <button
                          type="button"
                          onClick={() => void handleClearOrRemove(c, true)}
                          title="Remover comanda do cadastro"
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={mode === 'batch' ? 'Gerar Comandas em Lote' : 'Cadastrar Nova Comanda'}
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex gap-2 p-1 rounded-lg bg-surface-container-low border border-slate-200">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 rounded-md font-label-md font-bold transition-colors ${
                mode === 'single' ? 'bg-primary text-white' : 'text-on-surface-variant'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex-1 py-2 rounded-md font-label-md font-bold transition-colors ${
                mode === 'batch' ? 'bg-primary text-white' : 'text-on-surface-variant'
              }`}
            >
              Em Lote (Ex: 01 a 10)
            </button>
          </div>

          {mode === 'single' ? (
            <div>
              <label htmlFor="cmd-name" className="block font-label-md mb-1">
                Nome / Número da Comanda <span className="text-error">*</span>
              </label>
              <input
                id="cmd-name"
                required
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ex: MESA 01, COMANDA 05, BALCÃO"
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
                autoFocus
              />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="cmd-pref" className="block font-label-md mb-1">Prefixo</label>
                <input
                  id="cmd-pref"
                  value={prefixo}
                  onChange={(e) => setPrefixo(e.target.value)}
                  placeholder="MESA"
                  className="w-full h-11 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label htmlFor="cmd-ini" className="block font-label-md mb-1">De</label>
                <input
                  id="cmd-ini"
                  type="number"
                  min={1}
                  required
                  value={inicio}
                  onChange={(e) => setInicio(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200"
                />
              </div>
              <div>
                <label htmlFor="cmd-fim" className="block font-label-md mb-1">Até</label>
                <input
                  id="cmd-fim"
                  type="number"
                  min={1}
                  required
                  value={fim}
                  onChange={(e) => setFim(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-slate-200"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="cmd-obs" className="block font-label-md mb-1">Observação (opcional)</label>
            <input
              id="cmd-obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Área externa / Espetinhos"
              className="w-full h-11 px-3 rounded-lg border border-slate-200"
            />
          </div>

          {error && <p className="font-label-sm font-bold text-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 font-label-md font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] text-[#0F172A] font-label-md font-extrabold disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar Comanda(s)'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
