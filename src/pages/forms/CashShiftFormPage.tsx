import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { formatBRL } from '../../data/mockData';
import { FormFooter, FormPageHeader } from '../../components/ui/FormLayout';

export function CashShiftFormPage() {
  const navigate = useNavigate();
  const { addShift, shifts, refreshData, currentUser, users } = useErp();
  const openShift = shifts.find((s) => s.status === 'Aberto');
  const isAdmin = currentUser?.perfil === 'ADMIN';
  const adminUsers = users.filter((u) => u.role === 'Administrador' && u.status === 'Ativo');

  const [mode, setMode] = useState<'abertura' | 'fechamento'>(isAdmin ? 'abertura' : 'fechamento');
  const [operator, setOperator] = useState(
    currentUser?.nome || adminUsers[0]?.name || 'Administrador'
  );
  const [register, setRegister] = useState('Caixa 01 (Balcão)');
  const [openingBalance, setOpeningBalance] = useState(200);
  const [countedCash, setCountedCash] = useState('1350.00');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (mode === 'abertura') {
      if (!isAdmin) {
        setErrorMsg('Somente Administrador pode abrir o caixa.');
        return;
      }
      try {
        await addShift({
          id: String(Date.now()),
          register,
          operator,
          openedAt: 'Agora',
          openingBalance,
          totalSales: 0,
          expectedBalance: openingBalance,
          status: 'Aberto',
        });
      } catch (err) {
        setErrorMsg((err as Error).message);
        return;
      }
    } else if (openShift) {
      const res = await fetch(`/api/shifts/${openShift.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: Number(countedCash) || 0, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || 'Erro ao fechar o caixa.');
        return;
      }
      await refreshData();
    }
    navigate('/fluxo-de-caixa');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Fluxo de Caixa"
        backTo="/fluxo-de-caixa"
        icon={mode === 'abertura' ? 'lock_open' : 'receipt_long'}
        title={
          mode === 'abertura'
            ? 'Abertura de Caixa — Mercadinho do Geleia'
            : 'Fechamento de Caixa — Conferência Cega'
        }
        subtitle={
          mode === 'abertura'
            ? 'Inicie o turno do operador e registre a contagem do fundo de troco.'
            : 'Conferência cega e fechamento operacional da gaveta com balanço automático.'
        }
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('abertura')}
          className={`px-4 py-2.5 rounded-lg font-label-md font-bold transition-colors ${
            mode === 'abertura'
              ? 'bg-primary-container text-white'
              : 'bg-surface-container-lowest border border-slate-200 text-on-surface'
          }`}
        >
          Abertura de Turno
        </button>
        <button
          type="button"
          onClick={() => setMode('fechamento')}
          className={`px-4 py-2.5 rounded-lg font-label-md font-bold transition-colors ${
            mode === 'fechamento'
              ? 'bg-primary-container text-white'
              : 'bg-surface-container-lowest border border-slate-200 text-on-surface'
          }`}
        >
          Fechamento de Turno (Conferência Cega)
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-lg"
      >
        {errorMsg && (
          <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md font-bold">
            {errorMsg}
          </div>
        )}

        {mode === 'abertura' && !isAdmin && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-label-md font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">lock</span>
            <span>Somente Administrador pode abrir o caixa.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
          <div>
            <label htmlFor="shift-op" className="block font-label-md mb-1">
              Administrador Responsável <span className="text-error">*</span>
            </label>
            <select
              id="shift-op"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              disabled={mode === 'abertura' && !isAdmin}
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white disabled:opacity-60"
            >
              {adminUsers.length > 0 ? (
                adminUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name} (Administrador)
                  </option>
                ))
              ) : (
                <option value={currentUser?.nome || 'Administrador'}>
                  {currentUser?.nome || 'Administrador'}
                </option>
              )}
            </select>
          </div>

          <div>
            <label htmlFor="shift-reg" className="block font-label-md mb-1">Terminal / Ponto de Venda</label>
            <select
              id="shift-reg"
              value={register}
              onChange={(e) => setRegister(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
            >
              <option value="Caixa 01 (Balcão)">Caixa 01 (Balcão)</option>
              <option value="Caixa 02 (Rápido)">Caixa 02 (Rápido)</option>
            </select>
          </div>
        </div>

        {mode === 'abertura' ? (
          <div className="space-y-3">
            <label htmlFor="shift-open" className="block font-label-md">
              Valor Inicial na Gaveta / Fundo de Troco (R$) <span className="text-error">*</span>
            </label>
            <input
              id="shift-open"
              type="number"
              step="0.01"
              required
              value={openingBalance}
              onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
              className="w-full h-11 px-3 rounded-lg border border-slate-200 font-bold tabular-nums"
            />
            <div className="flex flex-wrap gap-2">
              {[50, 100, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOpeningBalance((prev) => prev + val)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-md font-bold text-primary"
                >
                  + R$ {val}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setOpeningBalance(200)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 font-label-md text-on-surface-variant"
              >
                Restaurar Padrão
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-container-low border border-surface-container">
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Fundo Inicial</span>
                <p className="font-headline-sm font-bold text-primary tabular-nums">{formatBRL(200)}</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Vendas Dinheiro</span>
                <p className="font-headline-sm font-bold text-secondary tabular-nums">{formatBRL(1150)}</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">PIX / Cartões</span>
                <p className="font-headline-sm font-bold text-tertiary tabular-nums">{formatBRL(2270.9)}</p>
              </div>
            </div>

            <div>
              <label htmlFor="shift-count" className="block font-label-md mb-1">
                Contagem Física em Dinheiro na Gaveta (R$) <span className="text-error">*</span>
              </label>
              <input
                id="shift-count"
                type="number"
                step="0.01"
                required
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 font-bold tabular-nums"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="shift-notes" className="block font-label-md mb-1">Observação (Opcional)</label>
          <textarea
            id="shift-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 rounded-lg border border-slate-200"
          />
        </div>

        <FormFooter
          onCancel={() => navigate('/fluxo-de-caixa')}
          submitLabel={mode === 'abertura' ? 'Confirmar Abertura de Caixa' : 'Confirmar Fechamento'}
          submitIcon="check_circle"
        />
      </form>
    </div>
  );
}
