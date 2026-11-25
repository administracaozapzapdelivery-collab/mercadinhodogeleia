import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/SharedUI';
import { maskCnpj, maskPhone, cnpjError, phoneError } from '../utils/masks';

type SettingsTab = 'geral' | 'pdv' | 'estoque' | 'backup';

const tabs: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'geral', label: 'Dados da Loja', icon: 'storefront' },
  { id: 'pdv', label: 'PDV e Impressora Térmica', icon: 'print' },
  { id: 'estoque', label: 'Regras de Estoque e Crediário', icon: 'rule' },
  { id: 'backup', label: 'Backup e Segurança', icon: 'backup' },
];

interface ConfigState {
  nome_fantasia: string;
  cnpj: string;
  telefone_whatsapp: string;
  largura_bobina: string;
  impressao_automatica: string;
  dias_alerta_validade: number;
  limite_fiado_padrao: number;
  exigir_abertura_caixa: boolean;
  registrar_log_auditoria: boolean;
  meta_diaria_faturamento: number;
}

interface BackupRow {
  id: number;
  nome_arquivo: string;
  tipo: string;
  created_at: string;
}

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral');
  const [savedNotice, setSavedNotice] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [cfg, setCfg] = useState<ConfigState>({
    nome_fantasia: 'Mercadinho do Geleia',
    cnpj: '48.123.456/0001-99',
    telefone_whatsapp: '(11) 99444-1234',
    largura_bobina: '80mm',
    impressao_automatica: 'SEMPRE',
    dias_alerta_validade: 15,
    limite_fiado_padrao: 200,
    exigir_abertura_caixa: true,
    registrar_log_auditoria: true,
    meta_diaria_faturamento: 5800,
  });

  const cnpjErr = submitted && cfg.cnpj ? cnpjError(cfg.cnpj) : '';
  const phoneErr = submitted && cfg.telefone_whatsapp ? phoneError(cfg.telefone_whatsapp) : '';

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config) setCfg((prev) => ({ ...prev, ...data.config }));
        if (data?.backups) setBackups(data.backups);
      })
      .catch(() => null);
  }, []);

  async function handleSave() {
    setSubmitted(true);
    const cErr = cfg.cnpj ? cnpjError(cfg.cnpj) : '';
    const pErr = cfg.telefone_whatsapp ? phoneError(cfg.telefone_whatsapp) : '';
    if (cErr || pErr) {
      setActiveTab('geral');
      return;
    }
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  }

  async function handleBackupNow() {
    const res = await fetch('/api/backups', { method: 'POST' });
    if (res.ok) {
      const row = await res.json();
      setBackups((prev) => [row, ...prev]);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Sistema"
        title="Configurações do Sistema"
        subtitle="Parâmetros persistidos no PostgreSQL (configuracoes id = 1) e histórico de backups."
        actions={
          <button
            type="button"
            onClick={() => void handleSave()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container hover:bg-primary text-white font-label-lg font-bold shadow-sm"
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            <span>Salvar Alterações</span>
          </button>
        }
      />

      {savedNotice && (
        <div className="p-3 rounded-xl bg-tertiary-fixed/40 border border-tertiary-fixed-dim text-tertiary font-label-md font-bold">
          Configurações salvas no PostgreSQL com sucesso!
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-label-md font-bold transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-container text-white shadow-sm'
                : 'bg-surface-container-lowest border border-slate-200 text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="bg-surface-container-lowest p-space-xl rounded-xl border border-slate-200/80 shadow-sm">
        {activeTab === 'geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-md mb-1">Nome Fantasia</label>
              <input
                value={cfg.nome_fantasia}
                onChange={(e) => setCfg({ ...cfg, nome_fantasia: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-label-md mb-1">CNPJ</label>
              <input
                value={cfg.cnpj ?? ''}
                onChange={(e) => setCfg({ ...cfg, cnpj: maskCnpj(e.target.value) })}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className={`w-full h-10 px-3 rounded-lg border ${cnpjErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {cnpjErr && <p className="font-body-sm text-error mt-1">{cnpjErr}</p>}
            </div>
            <div>
              <label className="block font-label-md mb-1">Telefone / WhatsApp</label>
              <input
                value={cfg.telefone_whatsapp ?? ''}
                onChange={(e) => setCfg({ ...cfg, telefone_whatsapp: maskPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className={`w-full h-10 px-3 rounded-lg border ${phoneErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {phoneErr && <p className="font-body-sm text-error mt-1">{phoneErr}</p>}
            </div>
            <div>
              <label className="block font-label-md mb-1">Meta Diária de Faturamento (R$)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={cfg.meta_diaria_faturamento}
                onChange={(e) => setCfg({ ...cfg, meta_diaria_faturamento: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
              <p className="font-body-sm text-on-surface-variant mt-1">Exibida no card "Faturamento do Dia" no Dashboard.</p>
            </div>
          </div>
        )}

        {activeTab === 'pdv' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-md mb-1">Impressora Térmica Padrão</label>
              <select
                value={cfg.largura_bobina}
                onChange={(e) => setCfg({ ...cfg, largura_bobina: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="80mm">Bobina Térmica 80mm</option>
                <option value="58mm">Bobina Térmica 58mm</option>
              </select>
            </div>
            <div>
              <label className="block font-label-md mb-1">Impressão Automática ao Finalizar</label>
              <select
                value={cfg.impressao_automatica}
                onChange={(e) => setCfg({ ...cfg, impressao_automatica: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="SEMPRE">Sempre imprimir</option>
                <option value="PERGUNTAR">Perguntar antes</option>
                <option value="NUNCA">Nunca</option>
              </select>
            </div>
            <label className="flex items-center gap-2 font-label-md">
              <input
                type="checkbox"
                checked={cfg.exigir_abertura_caixa}
                onChange={(e) => setCfg({ ...cfg, exigir_abertura_caixa: e.target.checked })}
                className="w-4 h-4 accent-primary-container"
              />
              Exigir caixa aberto para vender no PDV
            </label>
          </div>
        )}

        {activeTab === 'estoque' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-label-md mb-1">Alerta de Validade (dias antes)</label>
              <input
                type="number"
                value={cfg.dias_alerta_validade}
                onChange={(e) => setCfg({ ...cfg, dias_alerta_validade: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-label-md mb-1">Limite Padrão para Novos Clientes (Crediário)</label>
              <input
                type="number"
                value={cfg.limite_fiado_padrao}
                onChange={(e) => setCfg({ ...cfg, limite_fiado_padrao: Number(e.target.value) })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200"
              />
            </div>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-label-md">
                <input
                  type="checkbox"
                  checked={cfg.registrar_log_auditoria}
                  onChange={(e) => setCfg({ ...cfg, registrar_log_auditoria: e.target.checked })}
                  className="w-4 h-4 accent-primary-container"
                />
                Registrar logs de auditoria em ações críticas
              </label>
              <button
                type="button"
                onClick={() => void handleBackupNow()}
                className="px-4 py-2 rounded-lg bg-secondary text-white font-label-md font-bold"
              >
                Executar Backup Manual Agora
              </button>
            </div>
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="p-2.5 rounded-lg bg-surface-container-low flex justify-between text-body-sm">
                  <span className="font-bold">{b.nome_arquivo}</span>
                  <span>{b.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
