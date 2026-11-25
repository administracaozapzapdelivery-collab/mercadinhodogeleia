import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import { PasswordInput } from '../components/ui/SharedUI';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useErp();

  const [email, setEmail] = useState('everaldozs@gmail.com');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(3);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/dashboard';

  async function handleLogin(targetPath: string) {
    setErrorMsg(null);
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleLogin(redirectTo);
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
          {errorMsg && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container space-y-1">
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
    </div>
  );
}
