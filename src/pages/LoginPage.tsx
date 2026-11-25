import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { Modal, PasswordInput } from '../components/ui/SharedUI';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useErp();

  const [email, setEmail] = useState('everaldozs@gmail.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);

  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  async function handleLogin(targetPath: string) {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await login(email, password);
      setRemainingAttempts(null);
      navigate(targetPath, { replace: true });
    } catch (err) {
      const authErr = err as Error & { remainingAttempts?: number; maxAttempts?: number };
      setErrorMsg(authErr.message);
      setRemainingAttempts(
        typeof authErr.remainingAttempts === 'number' ? authErr.remainingAttempts : null
      );
      if (typeof authErr.maxAttempts === 'number') {
        setMaxAttempts(authErr.maxAttempts);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnlockWithPin(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);
    try {
      const res = await fetch('/api/auth/unlock-with-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, adminPin }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnlockError(body.error || 'Erro ao validar PIN.');
        return;
      }
      setUnlockModalOpen(false);
      setAdminPin('');
      setErrorMsg(null);
      setRemainingAttempts(null);
      setSuccessMsg(`Acesso desbloqueado por ${body.unlockedBy}. Digite sua senha e entre.`);
    } catch {
      setUnlockError('Falha de comunicação com o servidor.');
    } finally {
      setUnlocking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleLogin('/dashboard');
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-primary-container text-on-primary p-space-xl text-center">
          <div className="w-14 h-14 mx-auto rounded-xl bg-tertiary-fixed text-tertiary font-extrabold text-xl flex items-center justify-center shadow-md mb-3">
            MG
          </div>
          <h1 className="font-headline-lg text-headline-lg text-white">Mercadinho do Geleia</h1>
          <p className="font-body-sm text-on-primary-container mt-1">
            Identificação obrigatória do Operador / Gestor
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-space-xl space-y-space-md">
          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2 font-label-md font-bold">
              <span className="material-symbols-outlined text-[18px]">lock_open</span>
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container space-y-2">
              <div className="flex items-center gap-2 font-label-md font-bold">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{errorMsg}</span>
              </div>
              {remainingAttempts !== null && (
                <p className="font-body-sm font-medium pl-6">
                  {remainingAttempts > 0
                    ? `Você ainda tem ${remainingAttempts} ${remainingAttempts === 1 ? 'tentativa restante' : 'tentativas restantes'} (de ${maxAttempts}).`
                    : `0 de ${maxAttempts} tentativas restantes. Aguarde alguns minutos para tentar novamente.`}
                </p>
              )}
              {remainingAttempts === 0 && (
                <div className="pl-6 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUnlockError(null);
                      setAdminPin('');
                      setUnlockModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-label-sm font-bold shadow-sm transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_open</span>
                    <span>Desbloquear com PIN do Gestor</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block font-label-md text-on-surface mb-1">
              E-mail ou Usuário
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block font-label-md text-on-surface mb-1">
              Senha de Acesso
            </label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-11 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-60 text-white font-label-lg font-bold shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            <span>{submitting ? 'Autenticando...' : 'Entrar no Sistema'}</span>
          </button>

          <button
            type="button"
            disabled={submitting || !email || !password}
            onClick={() => void handleLogin('/pdv')}
            className="w-full h-11 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim disabled:opacity-50 text-tertiary font-label-lg font-bold transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
            <span>Autenticar e abrir PDV</span>
          </button>
        </form>
      </div>

      <Modal
        open={unlockModalOpen}
        title="Desbloquear Acesso com PIN"
        onClose={() => setUnlockModalOpen(false)}
      >
        <form onSubmit={handleUnlockWithPin} className="space-y-4">
          <p className="text-body-sm text-on-surface-variant">
            Informe o PIN de um <strong>Administrador</strong> ou <strong>Gerente</strong> para liberar o acesso de{' '}
            <strong>{email}</strong>.
          </p>
          {unlockError && (
            <div className="p-2.5 rounded-lg bg-error-container text-on-error-container font-label-sm font-bold">
              {unlockError}
            </div>
          )}
          <div>
            <label htmlFor="unlock-admin-pin" className="block font-label-md mb-1">
              PIN do Gestor / Administrador
            </label>
            <PasswordInput
              id="unlock-admin-pin"
              value={adminPin}
              onChange={(e) => setAdminPin(e.target.value)}
              placeholder="Digite o PIN (ex: 4 dígitos)"
              required
              autoFocus
              className="w-full h-10 px-3 rounded-lg border border-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setUnlockModalOpen(false)}
              className="px-4 py-2 rounded-lg bg-surface-container font-label-md font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={unlocking}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-label-md font-bold"
            >
              {unlocking ? 'Validando...' : 'Confirmar Desbloqueio'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
