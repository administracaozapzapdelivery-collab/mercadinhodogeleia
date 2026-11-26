import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { formatBRL } from '../../data/mockData';
import { FormFooter, FormPageHeader, StatusToggleCard } from '../../components/ui/FormLayout';
import { maskCpf, maskPhone, cpfError, phoneError } from '../../utils/masks';

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { customers, addCustomer, updateCustomer } = useErp();

  const [fiadoEnabled, setFiadoEnabled] = useState(true);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState('300');
  const [dueDay, setDueDay] = useState('Todo dia 10');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    const existing = customers.find((c) => c.id === id);
    if (!existing) return;
    setName(existing.name);
    setCpf(existing.cpf === '000.000.000-00' ? '' : existing.cpf);
    setPhone(existing.phone);
    setCreditLimit(String(existing.creditLimit));
    setFiadoEnabled(existing.status !== 'Bloqueado');
  }, [id, customers]);

  const limitNum = Number(creditLimit) || 0;
  const isBalcao = isEdit && ['venda no balcão', 'vendas no balcão'].includes(name.trim().toLowerCase());
  const cpfErr = submitted ? cpfError(cpf) : '';
  const phoneErr = submitted ? phoneError(phone, !isBalcao) : '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (cpfError(cpf) || phoneError(phone, !isBalcao)) return;
    const payload = {
      name: name.trim(),
      cpf: cpf.trim() || '000.000.000-00',
      phone: phone.trim(),
      creditLimit: isBalcao ? 0 : limitNum,
      status: (isBalcao || fiadoEnabled ? 'Em dia' : 'Bloqueado') as 'Em dia' | 'Bloqueado',
    };
    if (isEdit && id) {
      await updateCustomer(id, payload);
    } else {
      await addCustomer({
        id: String(Date.now()),
        ...payload,
        currentDebt: 0,
        lastPurchase: 'Novo cadastro',
      });
    }
    navigate('/clientes');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Clientes"
        backTo="/clientes"
        icon={isEdit ? 'edit' : 'person_add'}
        title={isEdit ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}
        subtitle="Adicione os dados de contato e defina o limite de crédito para compras no crediário no Mercadinho do Geleia."
        rightSlot={
          !isBalcao ? (
            <StatusToggleCard
              title="Crediário Liberado no PDV"
              subtitle="Ativo para vendas no caixa"
              checked={fiadoEnabled}
              onChange={setFiadoEnabled}
            />
          ) : undefined
        }
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {/* Identificação e WhatsApp */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
            <span className="material-symbols-outlined text-primary-container text-[20px]">badge</span>
            <h2 className="font-headline-sm font-bold text-primary">Identificação e WhatsApp</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="md:col-span-2">
              <label htmlFor="cli-name" className="block font-label-md mb-1">
                Nome Completo <span className="text-error">*</span>
              </label>
              <input
                id="cli-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Dona Maria da Silva"
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="cli-cpf" className="block font-label-md mb-1">CPF</label>
              <input
                id="cli-cpf"
                value={cpf}
                onChange={(e) => setCpf(maskCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`w-full h-11 px-3 rounded-lg border ${cpfErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {cpfErr && <p className="font-body-sm text-error mt-1">{cpfErr}</p>}
            </div>
            <div>
              <label htmlFor="cli-phone" className="block font-label-md mb-1">
                Telefone / WhatsApp <span className="text-error">*</span>
              </label>
              <input
                id="cli-phone"
                required
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(11) 99999-9999"
                maxLength={15}
                className={`w-full h-11 px-3 rounded-lg border ${phoneErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {phoneErr ? (
                <p className="font-body-sm text-error mt-1">{phoneErr}</p>
              ) : (
                <p className="font-body-sm text-on-surface-variant mt-1">
                  Usado para envio de comprovantes e lembretes de cobrança
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label htmlFor="cli-addr" className="block font-label-md mb-1">Endereço / Referência</label>
              <input
                id="cli-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número e ponto de referência na vizinhança"
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </section>

        {/* Configuração de Crédito (Fiado) */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          {!isBalcao && (
            <>
              <div className="pb-3 border-b border-surface-container">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary-container text-[20px]">
                    account_balance_wallet
                  </span>
                  <h2 className="font-headline-sm font-bold text-primary">Configuração de Crédito (Crediário)</h2>
                </div>
                <p className="font-body-sm text-on-surface-variant mt-0.5">
                  Defina o teto máximo de compras a prazo e condições de quitação no balcão do Mercadinho do Geleia.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div>
                  <label htmlFor="cli-limit" className="block font-label-md mb-1">
                    Limite de Crédito (R$) <span className="text-error">*</span>
                  </label>
                  <input
                    id="cli-limit"
                    type="number"
                    step="10"
                    required
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-200"
                  />
                  <p className="font-body-sm text-on-surface-variant mt-1">
                    Valor máximo simultâneo autorizado no PDV
                  </p>
                </div>

                <div>
                  <label htmlFor="cli-day" className="block font-label-md mb-1">
                    Dia Preferencial de Pagamento
                  </label>
                  <select
                    id="cli-day"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
                  >
                    <option>Todo dia 05</option>
                    <option>Todo dia 10</option>
                    <option>Todo dia 15</option>
                    <option>Todo dia 20</option>
                    <option>Semanal / Sexta-feira</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between">
                <div>
                  <span className="font-label-sm uppercase text-secondary">Saldo Devedor Atual • Novo Cliente</span>
                  <p className="font-headline-sm font-extrabold text-on-surface tabular-nums">R$ 0,00</p>
                </div>
                <div className="text-right">
                  <span className="font-label-sm uppercase text-on-surface-variant">Crédito Disponível</span>
                  <p className="font-headline-sm font-extrabold text-tertiary tabular-nums">
                    {formatBRL(limitNum)}
                  </p>
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="cli-notes" className="block font-label-md mb-1">Observações Internas</label>
            <textarea
              id="cli-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações operacionais visíveis apenas para os operadores de caixa no PDV."
              className="w-full p-3 rounded-lg border border-slate-200"
            />
          </div>

          <FormFooter
            note="Campos com * são obrigatórios para emissão no caixa"
            onCancel={() => navigate('/clientes')}
            submitLabel="Salvar Cliente"
            submitIcon="check_circle"
          />
        </section>

        <div className="p-4 rounded-xl bg-primary-fixed/40 border border-primary-fixed text-on-primary-fixed flex items-start gap-3">
          <span className="material-symbols-outlined text-primary-container">lightbulb</span>
          <p className="font-body-sm">
            <strong>Dica Operacional do Geleia:</strong> Clientes com limite aprovado aparecem automaticamente na busca rápida do PDV de balcão ao digitar o nome ou os 4 últimos dígitos do CPF.
          </p>
        </div>
      </form>
    </div>
  );
}
