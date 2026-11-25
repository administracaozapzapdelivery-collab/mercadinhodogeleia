import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';
import type { SystemUser } from '../types/erp';
import { Modal, PageHeader, PasswordInput, StatusBadge } from '../components/ui/SharedUI';

const permissionLabels: { key: string; label: string }[] = [
  { key: 'operar_pdv', label: 'Operar Frente de Caixa (PDV)' },
  { key: 'abrir_fechar_caixa', label: 'Abrir e Fechar Turnos de Caixa' },
  { key: 'cancelar_venda_desconto', label: 'Cancelar Vendas e Aplicar Descontos' },
  { key: 'editar_produtos', label: 'Cadastrar e Editar Produtos / Preços' },
  { key: 'registrar_perdas', label: 'Registrar Perdas e Movimentações' },
  { key: 'gerenciar_fiado', label: 'Gerenciar Crediário' },
  { key: 'acessar_financeiro_abc', label: 'Acessar Financeiro e Curva ABC' },
  { key: 'gerenciar_usuarios_config', label: 'Gerenciar Usuários e Configurações' },
];

export function UsersPage() {
  const navigate = useNavigate();
  const { users, updateUser, deleteUser, unlockUser } = useErp();

  const [viewUser, setViewUser] = useState<SystemUser | null>(null);
  const [editUser, setEditUser] = useState<SystemUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SystemUser | null>(null);

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<SystemUser['role']>('Operador de Caixa');
  const [editPin, setEditPin] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'Todos' | 'Ativo' | 'Inativo'>('Todos');

  const visibleUsers = users.filter((u) => statusFilter === 'Todos' || u.status === statusFilter);

  function openEditModal(u: SystemUser) {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPin(u.pin ?? '');
    setEditPassword('');
    setEditActive(u.status === 'Ativo');
    setEditPerms(u.permissions ?? {});
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    try {
      await updateUser(editUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        active: editActive,
        pin: editPin.trim() || undefined,
        password: editPassword.trim() || undefined,
        permissions: editPerms,
      });
      setEditUser(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    setDeleteError(null);
    try {
      await deleteUser(deleteTarget.id);
      setNotice(`Usuário "${deleteTarget.name}" excluído permanentemente.`);
      setDeleteTarget(null);
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      setDeleteError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivateFromModal() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await updateUser(deleteTarget.id, { active: false });
      setNotice(`Usuário "${deleteTarget.name}" marcado como Inativo.`);
      setDeleteTarget(null);
      setDeleteError(null);
      setTimeout(() => setNotice(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Sistema & Segurança"
        title="Usuários e Permissões"
        subtitle="Gerencie operadores de caixa, estoquistas, gerentes e níveis de acesso."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {(['Todos', 'Ativo', 'Inativo'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-2 rounded-lg font-label-md font-bold border transition-colors ${
                  statusFilter === st
                    ? 'bg-primary-container text-white border-primary-container'
                    : 'bg-surface-container-lowest text-on-surface border-slate-200 hover:bg-surface-container-low'
                }`}
              >
                {st}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate('/usuarios-e-permissoes/novo')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-tertiary-fixed hover:bg-tertiary-fixed-dim text-tertiary font-label-lg font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-[20px]">person_add</span>
              <span>Cadastrar Usuário</span>
            </button>
          </div>
        }
      />

      {notice && (
        <div className="p-3 rounded-xl bg-tertiary-fixed/40 border border-tertiary-fixed-dim text-tertiary font-label-md font-bold">
          {notice}
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase">
              <th className="px-space-lg py-3">Nome</th>
              <th className="px-space-lg py-3">E-mail</th>
              <th className="px-space-lg py-3">Perfil</th>
              <th className="px-space-lg py-3">Último Acesso</th>
              <th className="px-space-lg py-3">Status</th>
              <th className="px-space-lg py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {visibleUsers.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container-low/50">
                <td className="px-space-lg py-3 font-label-lg font-bold">{u.name}</td>
                <td className="px-space-lg py-3 text-body-sm text-on-surface-variant">{u.email}</td>
                <td className="px-space-lg py-3">
                  <StatusBadge label={u.role} tone="info" />
                </td>
                <td className="px-space-lg py-3 text-body-sm">{u.lastAccess}</td>
                <td className="px-space-lg py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge label={u.status} tone={u.status === 'Ativo' ? 'success' : 'neutral'} />
                    {u.isBlocked && (
                      <StatusBadge
                        label={u.blockedUntil ? `Bloqueado até ${u.blockedUntil}` : 'Bloqueado'}
                        tone="danger"
                      />
                    )}
                  </div>
                </td>
                <td className="px-space-lg py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    {u.isBlocked && (
                      <button
                        type="button"
                        onClick={async () => {
                          await unlockUser(u.id);
                          setNotice(`Usuário "${u.name}" desbloqueado com sucesso.`);
                          setTimeout(() => setNotice(null), 4000);
                        }}
                        title="Desbloquear acesso"
                        aria-label={`Desbloquear ${u.name}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-label-sm font-bold transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">lock_open</span>
                        <span>Desbloquear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setViewUser(u)}
                      title="Ver detalhes"
                      aria-label={`Ver ${u.name}`}
                      className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      title="Editar usuário"
                      aria-label={`Editar ${u.name}`}
                      className="p-2 rounded-lg text-orange-600 bg-orange-50 hover:bg-orange-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(u);
                      }}
                      title="Excluir usuário"
                      aria-label={`Excluir ${u.name}`}
                      className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Ver Informações do Usuário */}
      <Modal
        open={!!viewUser}
        title={`Detalhes do Usuário — ${viewUser?.name ?? ''}`}
        onClose={() => setViewUser(null)}
      >
        {viewUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-surface-container-low">
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Nome</span>
                <p className="font-label-lg font-bold">{viewUser.name}</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Perfil</span>
                <p className="font-label-lg font-bold text-primary">{viewUser.role}</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">E-mail</span>
                <p className="text-body-sm">{viewUser.email}</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">PIN Rápido</span>
                <p className="font-label-md font-bold">Protegido (oculto)</p>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Status</span>
                <div className="mt-0.5">
                  <StatusBadge label={viewUser.status} tone={viewUser.status === 'Ativo' ? 'success' : 'neutral'} />
                </div>
              </div>
              <div>
                <span className="font-label-sm uppercase text-on-surface-variant">Último Acesso</span>
                <p className="text-body-sm">{viewUser.lastAccess}</p>
              </div>
            </div>

            <div>
              <span className="font-label-sm uppercase text-on-surface-variant block mb-2">
                Permissões Ativas
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {permissionLabels.map((perm) => {
                  const enabled = !!viewUser.permissions?.[perm.key];
                  return (
                    <div
                      key={perm.key}
                      className={`px-2.5 py-1.5 rounded-lg text-body-sm flex items-center gap-1.5 ${
                        enabled
                          ? 'bg-tertiary-fixed/30 text-tertiary font-semibold'
                          : 'bg-surface-container-low text-on-surface-variant'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {enabled ? 'check_circle' : 'block'}
                      </span>
                      <span>{perm.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewUser(null)}
                className="px-4 py-2 rounded-lg bg-primary-container text-white font-label-md font-bold"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Editar Usuário */}
      <Modal
        open={!!editUser}
        title={`Editar Usuário — ${editUser?.name ?? ''}`}
        onClose={() => setEditUser(null)}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-usr-name" className="block font-label-md mb-1">Nome</label>
              <input
                id="edit-usr-name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="edit-usr-email" className="block font-label-md mb-1">E-mail</label>
              <input
                id="edit-usr-email"
                type="email"
                required
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="edit-usr-role" className="block font-label-md mb-1">Perfil</label>
              <select
                id="edit-usr-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as SystemUser['role'])}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Administrador">Administrador</option>
                <option value="Gerente">Gerente</option>
                <option value="Operador de Caixa">Operador de Caixa</option>
                <option value="Estoquista">Estoquista</option>
              </select>
            </div>
            <div>
              <label htmlFor="edit-usr-pin" className="block font-label-md mb-1">PIN Rápido (4 dígitos)</label>
              <input
                id="edit-usr-pin"
                maxLength={4}
                value={editPin}
                onChange={(e) => setEditPin(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="edit-usr-pass" className="block font-label-md mb-1">
                Nova Senha (opcional)
              </label>
              <PasswordInput
                id="edit-usr-pass"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Deixe vazio para manter"
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <label className="flex items-center gap-2 font-label-md pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="w-4 h-4 accent-primary-container"
              />
              Usuário Ativo
            </label>
          </div>

          <div className="pt-2 border-t border-surface-container">
            <span className="font-label-sm uppercase text-on-surface-variant block mb-2">
              Permissões do Sistema
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
              {permissionLabels.map((perm) => (
                <label key={perm.key} className="flex items-center gap-2 text-body-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editPerms[perm.key]}
                    onChange={(e) =>
                      setEditPerms((prev) => ({ ...prev, [perm.key]: e.target.checked }))
                    }
                    className="w-4 h-4 accent-primary-container"
                  />
                  <span>{perm.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="px-4 py-2 rounded-lg border border-slate-200 font-label-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#3DDB8F] text-[#0F172A] font-label-md font-bold"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirmação de Exclusão */}
      <Modal
        open={!!deleteTarget}
        title="Confirmar Exclusão"
        onClose={() => setDeleteTarget(null)}
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="font-body-md text-on-surface">
              Tem certeza que deseja excluir o usuário <strong>{deleteTarget.name}</strong> (
              {deleteTarget.email})?
            </p>
            <p className="font-body-sm text-on-surface-variant">
              Caso este usuário possua vendas ou turnos vinculados, ele será desativado para preservar o histórico fiscal.
            </p>
            {deleteError && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md">
                {deleteError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 font-label-md"
              >
                Cancelar
              </button>
              {deleteError ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDeactivateFromModal()}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-label-md font-bold"
                >
                  Desativar Usuário
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConfirmDelete()}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-label-md font-bold"
                >
                  {saving ? 'Excluindo...' : 'Sim, Excluir'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
