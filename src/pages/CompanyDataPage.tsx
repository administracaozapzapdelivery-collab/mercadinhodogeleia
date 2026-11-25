import { useEffect, useState, type FormEvent } from 'react';
import { useErp } from '../context/ErpContext';
import type { CompanyData } from '../types/erp';
import { PageHeader } from '../components/ui/SharedUI';
import { maskCnpj, maskCpf, maskPhone, cnpjError, cpfError, phoneError } from '../utils/masks';

const emptyCompany: CompanyData = {
  nome_fantasia: 'Mercadinho do Geleia',
  razao_social: '',
  cnpj: '',
  inscricao_estadual: '',
  nome_proprietario: '',
  cpf_proprietario: '',
  telefone: '',
  whatsapp: '',
  email: '',
  cep: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  uf: '',
  mensagem_cupom: 'Obrigado pela preferência! Volte sempre.',
};

export function CompanyDataPage() {
  const { company, updateCompany } = useErp();
  const [form, setForm] = useState<CompanyData>(emptyCompany);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const cnpjErr = submitted ? cnpjError(form.cnpj) : '';
  const cpfPropErr = submitted ? cpfError(form.cpf_proprietario) : '';
  const telErr = submitted ? phoneError(form.telefone, true) : '';
  const wppErr = submitted && form.whatsapp ? phoneError(form.whatsapp) : '';

  useEffect(() => {
    if (company) {
      setForm({
        ...emptyCompany,
        ...company,
      });
    } else {
      fetch('/api/company')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setForm({ ...emptyCompany, ...data });
        })
        .catch(() => {});
    }
  }, [company]);

  function setField<K extends keyof CompanyData>(key: K, value: CompanyData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (cnpjError(form.cnpj) || cpfError(form.cpf_proprietario) || phoneError(form.telefone, true) || (form.whatsapp ? phoneError(form.whatsapp) : '')) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateCompany(form);
      setFeedback({
        type: 'ok',
        text: 'Dados da empresa salvos no banco de dados! O PDV e os cupons já estão atualizados.',
      });
    } catch (err) {
      setFeedback({ type: 'err', text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <PageHeader
        badge="Identidade & Cupom PDV"
        title="Dados da Empresa"
        subtitle="Informações oficiais do estabelecimento e do proprietário exibidas no PDV e nos cupons de venda."
      />

      {feedback && (
        <div
          className={`p-4 rounded-xl border font-label-md font-bold ${
            feedback.type === 'ok'
              ? 'bg-tertiary-fixed/40 border-tertiary-fixed-dim text-tertiary'
              : 'bg-error-container border-error/30 text-on-error-container'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Identificação da Empresa */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-container pb-3">
            <span className="material-symbols-outlined text-primary-container">storefront</span>
            <h2 className="font-headline-sm font-bold text-primary">Identificação da Empresa</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-fantasia" className="block font-label-md mb-1">
                Nome Fantasia *
              </label>
              <input
                id="emp-fantasia"
                required
                value={form.nome_fantasia}
                onChange={(e) => setField('nome_fantasia', e.target.value)}
                placeholder="Ex: Mercadinho do Geleia"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div>
              <label htmlFor="emp-razao" className="block font-label-md mb-1">
                Razão Social
              </label>
              <input
                id="emp-razao"
                value={form.razao_social}
                onChange={(e) => setField('razao_social', e.target.value)}
                placeholder="Ex: Mercadinho do Geleia Ltda"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div>
              <label htmlFor="emp-cnpj" className="block font-label-md mb-1">
                CNPJ *
              </label>
              <input
                id="emp-cnpj"
                required
                value={form.cnpj}
                onChange={(e) => setField('cnpj', maskCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className={`w-full h-11 px-3 rounded-lg border ${cnpjErr ? 'border-error ring-1 ring-error' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-secondary`}
              />
              {cnpjErr && <p className="font-body-sm text-error mt-1">{cnpjErr}</p>}
            </div>

            <div>
              <label htmlFor="emp-ie" className="block font-label-md mb-1">
                Inscrição Estadual (IE)
              </label>
              <input
                id="emp-ie"
                value={form.inscricao_estadual}
                onChange={(e) => setField('inscricao_estadual', e.target.value)}
                placeholder="Opcional ou Isento"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
        </section>

        {/* Dados do Proprietário e Contato */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-container pb-3">
            <span className="material-symbols-outlined text-primary-container">badge</span>
            <h2 className="font-headline-sm font-bold text-primary">
              Proprietário e Contatos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-prop" className="block font-label-md mb-1">
                Nome Completo do Proprietário *
              </label>
              <input
                id="emp-prop"
                required
                value={form.nome_proprietario}
                onChange={(e) => setField('nome_proprietario', e.target.value)}
                placeholder="Nome completo do responsável"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div>
              <label htmlFor="emp-cpf-prop" className="block font-label-md mb-1">
                CPF do Proprietário
              </label>
              <input
                id="emp-cpf-prop"
                value={form.cpf_proprietario}
                onChange={(e) => setField('cpf_proprietario', maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`w-full h-11 px-3 rounded-lg border ${cpfPropErr ? 'border-error ring-1 ring-error' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-secondary`}
              />
              {cpfPropErr && <p className="font-body-sm text-error mt-1">{cpfPropErr}</p>}
            </div>

            <div>
              <label htmlFor="emp-tel" className="block font-label-md mb-1">
                Telefone *
              </label>
              <input
                id="emp-tel"
                required
                value={form.telefone}
                onChange={(e) => setField('telefone', maskPhone(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
                className={`w-full h-11 px-3 rounded-lg border ${telErr ? 'border-error ring-1 ring-error' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-secondary`}
              />
              {telErr && <p className="font-body-sm text-error mt-1">{telErr}</p>}
            </div>

            <div>
              <label htmlFor="emp-wpp" className="block font-label-md mb-1">
                WhatsApp
              </label>
              <input
                id="emp-wpp"
                value={form.whatsapp}
                onChange={(e) => setField('whatsapp', maskPhone(e.target.value))}
                placeholder="(00) 90000-0000"
                maxLength={15}
                className={`w-full h-11 px-3 rounded-lg border ${wppErr ? 'border-error ring-1 ring-error' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-secondary`}
              />
              {wppErr && <p className="font-body-sm text-error mt-1">{wppErr}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="emp-email" className="block font-label-md mb-1">
                E-mail Comercial
              </label>
              <input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contato@mercadinhodogeleia.com.br"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
        </section>

        {/* Endereço e Cupom */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 border-b border-surface-container pb-3">
            <span className="material-symbols-outlined text-primary-container">location_on</span>
            <h2 className="font-headline-sm font-bold text-primary">Endereço e Cupom PDV</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="emp-cep" className="block font-label-md mb-1">
                CEP
              </label>
              <input
                id="emp-cep"
                value={form.cep}
                onChange={(e) => setField('cep', e.target.value)}
                placeholder="00000-000"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="emp-end" className="block font-label-md mb-1">
                Endereço (Rua / Av.)
              </label>
              <input
                id="emp-end"
                value={form.endereco}
                onChange={(e) => setField('endereco', e.target.value)}
                placeholder="Rua das Flores"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-1">
              <label htmlFor="emp-num" className="block font-label-md mb-1">
                Número
              </label>
              <input
                id="emp-num"
                value={form.numero}
                onChange={(e) => setField('numero', e.target.value)}
                placeholder="123"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="emp-bairro" className="block font-label-md mb-1">
                Bairro
              </label>
              <input
                id="emp-bairro"
                value={form.bairro}
                onChange={(e) => setField('bairro', e.target.value)}
                placeholder="Centro"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-3">
              <label htmlFor="emp-cidade" className="block font-label-md mb-1">
                Cidade
              </label>
              <input
                id="emp-cidade"
                value={form.cidade}
                onChange={(e) => setField('cidade', e.target.value)}
                placeholder="Cidade"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-1">
              <label htmlFor="emp-uf" className="block font-label-md mb-1">
                UF
              </label>
              <input
                id="emp-uf"
                maxLength={2}
                value={form.uf}
                onChange={(e) => setField('uf', e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full h-11 px-3 rounded-lg border border-slate-200 uppercase focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="md:col-span-6">
              <label htmlFor="emp-msg" className="block font-label-md mb-1">
                Mensagem de Rodapé do Cupom (PDV)
              </label>
              <textarea
                id="emp-msg"
                rows={2}
                value={form.mensagem_cupom}
                onChange={(e) => setField('mensagem_cupom', e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-[#3DDB8F] hover:bg-[#32c77f] disabled:opacity-50 text-[#0F172A] font-headline-sm font-extrabold shadow-md flex items-center gap-2 transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">save</span>
            <span>{saving ? 'Salvando...' : 'Salvar Dados da Empresa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
