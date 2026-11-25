import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import type { SystemUser } from '../../types/erp';
import { FormFooter, FormPageHeader } from '../../components/ui/FormLayout';
import { PasswordInput } from '../../components/ui/SharedUI';

const permissionRows = [
  {
    id: 'operar_pdv',
    icon: 'point_of_sale',
    title: 'Operar Frente de Caixa (PDV)',
    desc: 'Permite bipar mercadorias, registrar pagamentos e emitir comprovantes fiscais.',
    defaultOn: true,
  },
  {
    id: 'abrir_fechar_caixa',
    icon: 'lock_clock',
    title: 'Abrir e Fechar Turnos de Caixa',
    desc: 'Registro de fundo de troco (suprimento) e conferência de sangria periódica.',
    defaultOn: true,
  },
  {
    id: 'cancelar_venda_desconto',
    icon: 'remove_shopping_cart',
    title: 'Cancelar Vendas e Aplicar Descontos',
    desc: 'Exige autorização para abater valores ou anular cupom fiscal iniciado.',
    defaultOn: false,
  },
  {
    id: 'editar_produtos',
    icon: 'sell',
    title: 'Cadastrar e Editar Produtos / Preços',
    desc: 'Acesso para etiquetagem de gôndolas e cadastro rápido de mercadorias.',
    defaultOn: false,
  },
  {
    id: 'registrar_perdas',
    icon: 'production_quantity_limits',
    title: 'Registrar Perdas e Movimentações',
    desc: 'Lançar quebras de hortifrúti, avarias de transporte ou consumo interno.',
    defaultOn: false,
  },
  {
    id: 'gerenciar_fiado',
    icon: 'menu_book',
    title: 'Gerenciar Crediário',
    desc: 'Consultar limites, registrar recebimentos e controlar caderneta de clientes.',
    defaultOn: false,
  },
  {
    id: 'acessar_financeiro_abc',
    icon: 'analytics',
    title: 'Acessar Financeiro e Curva ABC',
    desc: 'Visualizar contas a pagar, faturamento e relatórios gerenciais.',
    defaultOn: false,
  },
  {
    id: 'gerenciar_usuarios_config',
    icon: 'admin_panel_settings',
    title: 'Gerenciar Usuários e Configurações',
    desc: 'Criar ou editar usuários, permissões e parâmetros da loja.',
    defaultOn: false,
  },
];

export function UserFormPage() {
  const navigate = useNavigate();
  const { addUser } = useErp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SystemUser['role']>('Operador de Caixa');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [perms, setPerms] = useState<Record<string, boolean>>(
    Object.fromEntries(permissionRows.map((r) => [r.id, r.defaultOn]))
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await addUser({
        id: String(Date.now()),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        status: 'Ativo',
        lastAccess: 'Recém-criado',
        password: password.trim(),
        pin: pin.trim(),
        permissions: perms,
      });
      navigate('/usuarios-e-permissoes');
    } catch (err) {
      setErrorMsg((err as Error).message || 'Erro ao cadastrar usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Usuários e Permissões"
        backTo="/usuarios-e-permissoes"
        icon="admin_panel_settings"
        title="Cadastrar / Editar Usuário"
        subtitle="Defina os dados de autenticação, perfil e atribua privilégios para frente de caixa (PDV) e ERP."
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container font-label-md font-bold">
            {errorMsg}
          </div>
        )}
        {/* 1. Dados de Identificação e Acesso */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">1. Dados de Identificação e Acesso</h2>
            <p className="font-body-sm text-on-surface-variant">Credenciais Primárias</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div>
              <label htmlFor="usr-name" className="block font-label-md mb-1">
                Nome do Colaborador <span className="text-error">*</span>
              </label>
              <input
                id="usr-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="usr-email" className="block font-label-md mb-1">
                E-mail ou Usuário de Login <span className="text-error">*</span>
              </label>
              <input
                id="usr-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="usr-role" className="block font-label-md mb-1">
                Perfil de Acesso Primário <span className="text-error">*</span>
              </label>
              <select
                id="usr-role"
                value={role}
                onChange={(e) => setRole(e.target.value as SystemUser['role'])}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Operador de Caixa">Operador de Caixa (Frente de Loja)</option>
                <option value="Estoquista">Estoquista</option>
                <option value="Gerente">Gerente</option>
                <option value="Administrador">Administrador</option>
              </select>
            </div>

            <div>
              <label htmlFor="usr-pass" className="block font-label-md mb-1">
                Senha de Acesso (ERP/Web) <span className="text-error">*</span>
              </label>
              <PasswordInput
                id="usr-pass"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="usr-pin" className="block font-label-md mb-1">
                PIN Rápido (4 dígitos) <span className="text-error">*</span>
              </label>
              <input
                id="usr-pin"
                maxLength={4}
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Ex: 1234"
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
              <p className="font-body-sm text-on-surface-variant mt-1">
                Usado no PDV para liberar transações rápidas, descontos e cancelamentos.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Matriz de Permissões */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">2. Matriz de Permissões Específicas</h2>
          </div>

          <div className="divide-y divide-surface-container">
            {permissionRows.map((row) => (
              <label
                key={row.id}
                className="py-3.5 flex items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary-container mt-0.5">
                    {row.icon}
                  </span>
                  <div>
                    <p className="font-label-lg font-bold text-on-surface">{row.title}</p>
                    <p className="font-body-sm text-on-surface-variant">{row.desc}</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!!perms[row.id]}
                  onChange={(e) => setPerms((p) => ({ ...p, [row.id]: e.target.checked }))}
                  className="w-5 h-5 accent-primary-container rounded"
                />
              </label>
            ))}
          </div>

          <FormFooter
            onCancel={() => navigate('/usuarios-e-permissoes')}
            submitLabel="Salvar Usuário"
            submitIcon="check"
          />
        </section>
      </form>
    </div>
  );
}
