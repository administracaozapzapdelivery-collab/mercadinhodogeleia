import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/SharedUI';
import { PrintableReceipt, type ReceiptData } from '../components/PrintableReceipt';
import {
  fetchAvailablePrinters,
  printTestDirect,
  type PrinterOption,
} from '../utils/printClient';
import { maskCnpj, maskPhone, cnpjError, phoneError } from '../utils/masks';

type SettingsTab = 'geral' | 'pdv' | 'mercadopago' | 'estoque' | 'backup';

const tabs: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'geral', label: 'Dados da Loja', icon: 'storefront' },
  { id: 'pdv', label: 'PDV e Impressora Térmica', icon: 'print' },
  { id: 'mercadopago', label: 'Mercado Pago (PIX)', icon: 'qr_code_2' },
  { id: 'estoque', label: 'Regras de Estoque e Crediário', icon: 'rule' },
  { id: 'backup', label: 'Backup e Segurança', icon: 'backup' },
];

interface ConfigState {
  nome_fantasia: string;
  cnpj: string;
  telefone_whatsapp: string;
  nome_impressora: string;
  largura_bobina: string;
  impressao_automatica: string;
  dias_alerta_validade: number;
  limite_fiado_padrao: number;
  exigir_abertura_caixa: boolean;
  registrar_log_auditoria: boolean;
  meta_diaria_faturamento: number;
  mp_pix_ativo: boolean;
  mp_public_key: string;
  mp_access_token?: string;
  mp_access_token_masked?: string;
  has_mp_access_token?: boolean;
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
    nome_impressora: 'VOX(U) 1',
    largura_bobina: '80mm',
    impressao_automatica: 'SEMPRE',
    dias_alerta_validade: 15,
    limite_fiado_padrao: 200,
    exigir_abertura_caixa: true,
    registrar_log_auditoria: true,
    meta_diaria_faturamento: 5800,
    mp_pix_ativo: true,
    mp_public_key: '',
    mp_access_token: '',
  });
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [printersSupported, setPrintersSupported] = useState<boolean>(true);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testPrintStatus, setTestPrintStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingPrint, setTestingPrint] = useState(false);
  const [testingMp, setTestingMp] = useState(false);
  const [mpTestStatus, setMpTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [webhookCopied, setWebhookCopied] = useState(false);

  const cnpjErr = submitted && cfg.cnpj ? cnpjError(cfg.cnpj) : '';
  const phoneErr = submitted && cfg.telefone_whatsapp ? phoneError(cfg.telefone_whatsapp) : '';

  const loadPrinters = () => {
    setLoadingPrinters(true);
    fetchAvailablePrinters()
      .then((data) => {
        setPrintersSupported(data.supported);
        setPrinters(data.printers);
      })
      .catch(() => null)
      .finally(() => setLoadingPrinters(false));
  };

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config) setCfg((prev) => ({ ...prev, ...data.config }));
        if (data?.backups) setBackups(data.backups);
      })
      .catch(() => null);
    loadPrinters();
  }, []);

  async function handleTestPrint() {
    setTestingPrint(true);
    setTestPrintStatus(null);
    try {
      const result = await printTestDirect({
        printerName: cfg.nome_impressora,
        width: cfg.largura_bobina === '58mm' ? '58mm' : '80mm',
        store: {
          nome_fantasia: cfg.nome_fantasia,
          cnpj: cfg.cnpj,
          telefone: cfg.telefone_whatsapp,
        },
      });
      if (result.ok) {
        setTestPrintStatus({
          ok: true,
          text: `Página de teste enviada direto para "${result.printerName}" (${result.widthMm})!`,
        });
        return;
      }

      // Fallback para impressão via navegador caso o agente local não esteja ativo
      setTestPrintStatus({
        ok: true,
        text: 'Agente local não detectado — abrindo janela de impressão do navegador.',
      });
      setTimeout(() => {
        window.print();
      }, 120);
    } catch (err) {
      setTestPrintStatus({ ok: false, text: (err as Error).message });
    } finally {
      setTestingPrint(false);
    }
  }

  const testReceiptData: ReceiptData = {
    cupom: 'TESTE-0001',
    date: new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date()),
    operator: 'Administrador',
    paymentMethod: 'Dinheiro',
    items: [
      { name: 'Teste de Impressão Térmica', quantity: 1, unit: 'un', unitPrice: 1.0, subtotal: 1.0 },
    ],
    subtotal: 1.0,
    discount: 0,
    total: 1.0,
    cashReceived: 1.0,
    changeDue: 0,
  };

  async function handleTestMp() {
    setTestingMp(true);
    setMpTestStatus(null);
    try {
      const res = await fetch('/api/mercadopago/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: cfg.mp_access_token?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMpTestStatus({
          ok: true,
          text: `Conexão validada! Conta Mercado Pago: ${data.nickname || data.email || data.userId}`,
        });
      } else {
        setMpTestStatus({
          ok: false,
          text: data.error || 'Não foi possível validar o Access Token.',
        });
      }
    } catch (err) {
      setMpTestStatus({ ok: false, text: (err as Error).message });
    } finally {
      setTestingMp(false);
    }
  }

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
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-label-md">Impressora Térmica Padrão (Windows)</label>
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    className="text-xs font-bold text-primary-container hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">refresh</span>
                    <span>{loadingPrinters ? 'Atualizando...' : 'Atualizar lista'}</span>
                  </button>
                </div>
                {printers.length > 0 ? (
                  <select
                    value={cfg.nome_impressora ?? 'VOX(U) 1'}
                    onChange={(e) => setCfg({ ...cfg, nome_impressora: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
                  >
                    {!printers.some((p) => p.name === cfg.nome_impressora) && cfg.nome_impressora && (
                      <option value={cfg.nome_impressora}>{cfg.nome_impressora} (Salva)</option>
                    )}
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                        {p.isDefault ? ' (Padrão do Windows)' : ''} — {p.portName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={cfg.nome_impressora ?? 'VOX(U) 1'}
                    onChange={(e) => setCfg({ ...cfg, nome_impressora: e.target.value })}
                    placeholder="VOX(U) 1"
                    className="w-full h-10 px-3 rounded-lg border border-slate-200"
                  />
                )}
                <p className="font-body-sm text-on-surface-variant mt-1">
                  {printersSupported
                    ? 'Impressão direta ESC/POS via Spooler do Windows (sem abrir janela do navegador).'
                    : 'Servidor remoto detectado: será usado o diálogo de impressão do navegador.'}
                </p>
              </div>

              <div>
                <label className="block font-label-md mb-1">Largura da Bobina</label>
                <select
                  value={cfg.largura_bobina}
                  onChange={(e) => setCfg({ ...cfg, largura_bobina: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white"
                >
                  <option value="80mm">Bobina Térmica 80mm (48 colunas)</option>
                  <option value="58mm">Bobina Térmica 58mm (32 colunas)</option>
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 font-label-md">
                <input
                  type="checkbox"
                  checked={cfg.exigir_abertura_caixa}
                  onChange={(e) => setCfg({ ...cfg, exigir_abertura_caixa: e.target.checked })}
                  className="w-4 h-4 accent-primary-container"
                />
                Exigir caixa aberto para vender no PDV
              </label>

              <button
                type="button"
                onClick={() => void handleTestPrint()}
                disabled={testingPrint}
                className="px-4 py-2 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-50 text-[#0F172A] font-label-md font-extrabold flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
                <span>{testingPrint ? 'Imprimindo...' : 'Imprimir Página de Teste'}</span>
              </button>
            </div>

            {testPrintStatus && (
              <div
                className={`p-3 rounded-xl border font-label-md font-bold ${
                  testPrintStatus.ok
                    ? 'bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary'
                    : 'bg-error-container/40 border-error/30 text-error'
                }`}
              >
                {testPrintStatus.text}
              </div>
            )}

            <div className="print-only-container">
              <PrintableReceipt
                receipt={testReceiptData}
                store={{
                  nome_fantasia: cfg.nome_fantasia,
                  cnpj: cfg.cnpj,
                  telefone: cfg.telefone_whatsapp,
                }}
                twoCopies={false}
                bobinaWidth={cfg.largura_bobina === '58mm' ? '58mm' : '80mm'}
              />
            </div>
          </div>
        )}

        {activeTab === 'mercadopago' && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-secondary/10 border border-secondary/30 flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary text-[24px] shrink-0">
                qr_code_2
              </span>
              <div>
                <h3 className="font-label-lg font-extrabold text-secondary">
                  Integração Exclusiva para PIX (Somente PIX)
                </h3>
                <p className="font-body-sm text-on-surface-variant mt-0.5">
                  Quando o cliente escolher <strong>PIX</strong> no PDV, o sistema gera o QR Code do
                  Mercado Pago na tela e confirma o pagamento automaticamente. Não habilita cartão
                  ou boleto.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2.5 font-label-md font-bold">
              <input
                type="checkbox"
                checked={cfg.mp_pix_ativo}
                onChange={(e) => setCfg({ ...cfg, mp_pix_ativo: e.target.checked })}
                className="w-4 h-4 accent-primary-container"
              />
              Ativar geração automática de QR Code PIX no PDV
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-label-md mb-1">Public Key (Produção)</label>
                <input
                  value={cfg.mp_public_key ?? ''}
                  onChange={(e) => setCfg({ ...cfg, mp_public_key: e.target.value })}
                  placeholder="APP_USR-..."
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-label-md mb-1">Access Token (Produção)</label>
                <input
                  type="password"
                  value={cfg.mp_access_token ?? ''}
                  onChange={(e) => setCfg({ ...cfg, mp_access_token: e.target.value })}
                  placeholder={
                    cfg.has_mp_access_token
                      ? `Salvo: ${cfg.mp_access_token_masked} (digite para alterar)`
                      : 'APP_USR-...'
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 font-mono text-xs"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="font-label-md font-bold text-on-surface">
                  URL de Webhook (Mercado Pago Developers)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const isLocal =
                      window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';
                    const base = isLocal
                      ? 'https://mercadinhodogeleia.vercel.app'
                      : window.location.origin;
                    const url = `${base}/api/mercadopago/webhook`;
                    void navigator.clipboard?.writeText(url);
                    setWebhookCopied(true);
                    setTimeout(() => setWebhookCopied(false), 2000);
                  }}
                  className="text-xs font-bold text-primary-container hover:underline"
                >
                  {webhookCopied ? 'URL copiada!' : 'Copiar URL'}
                </button>
              </div>
              <input
                readOnly
                value={`${
                  typeof window !== 'undefined' &&
                  window.location.hostname !== 'localhost' &&
                  window.location.hostname !== '127.0.0.1'
                    ? window.location.origin
                    : 'https://mercadinhodogeleia.vercel.app'
                }/api/mercadopago/webhook`}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white font-mono text-xs text-on-surface"
              />
              <p className="font-body-sm text-on-surface-variant">
                No painel <strong>Mercado Pago Developers → Webhooks → Modo Produção</strong>, cole
                esta URL e marque o evento <strong>Pagamentos (payment)</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <p className="font-body-sm text-on-surface-variant">
                {cfg.has_mp_access_token
                  ? 'Credenciais de produção salvas no banco de dados.'
                  : 'Informe as credenciais de produção e clique em Salvar Alterações.'}
              </p>
              <button
                type="button"
                onClick={() => void handleTestMp()}
                disabled={testingMp}
                className="px-4 py-2 rounded-lg bg-secondary hover:opacity-90 disabled:opacity-50 text-white font-label-md font-bold flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>{testingMp ? 'Validando...' : 'Testar Conexão Mercado Pago'}</span>
              </button>
            </div>

            {mpTestStatus && (
              <div
                className={`p-3 rounded-xl border font-label-md font-bold ${
                  mpTestStatus.ok
                    ? 'bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary'
                    : 'bg-error-container/40 border-error/30 text-error'
                }`}
              >
                {mpTestStatus.text}
              </div>
            )}
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
