import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { FormFooter, FormPageHeader, StatusToggleCard } from '../../components/ui/FormLayout';
import { maskCnpj, maskPhone, cnpjError, phoneError } from '../../utils/masks';

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function SupplierFormPage() {
  const navigate = useNavigate();
  const { addSupplier } = useErp();

  const [active, setActive] = useState(true);
  const [name, setName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [category, setCategory] = useState('Mercearia');
  const [leadTimeDays, setLeadTimeDays] = useState('2');
  const [visitDays, setVisitDays] = useState<string[]>(['Qua', 'Sex']);
  const [submitted, setSubmitted] = useState(false);

  const cnpjErr = submitted ? cnpjError(cnpj) : '';
  const phoneErr = submitted ? phoneError(phone, true) : '';

  function toggleDay(day: string) {
    setVisitDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (cnpjError(cnpj) || phoneError(phone, true)) return;
    addSupplier({
      id: String(Date.now()),
      name: name.trim(),
      cnpj: cnpj.trim(),
      contact: contact.trim() || 'Comercial',
      phone: phone.trim(),
      category,
      leadTimeDays: Number(leadTimeDays) || 2,
    });
    navigate('/fornecedores');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Fornecedores"
        backTo="/fornecedores"
        icon="local_shipping"
        title="Cadastrar Novo Fornecedor"
        subtitle="Adicione distribuidoras, atacadistas e parceiros de abastecimento do Mercadinho do Geleia"
        rightSlot={
          <StatusToggleCard
            title="Fornecedor Ativo"
            subtitle="Ativo para Pedidos"
            checked={active}
            onChange={setActive}
          />
        }
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {/* Identificação Fiscal */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Identificação Fiscal</h2>
            <p className="font-body-sm text-on-surface-variant">
              Dados tributários e de faturamento da empresa parceira.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div>
              <label htmlFor="sup-name" className="block font-label-md mb-1">
                Razão Social / Nome Fantasia <span className="text-error">*</span>
              </label>
              <input
                id="sup-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="sup-cnpj" className="block font-label-md mb-1">
                CNPJ <span className="text-error">*</span>
              </label>
              <input
                id="sup-cnpj"
                required
                value={cnpj}
                onChange={(e) => setCnpj(maskCnpj(e.target.value))}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className={`w-full h-11 px-3 rounded-lg border ${cnpjErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {cnpjErr && <p className="font-body-sm text-error mt-1">{cnpjErr}</p>}
            </div>
          </div>
        </section>

        {/* Contato Comercial */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Contato Comercial e Reposição</h2>
            <p className="font-body-sm text-on-surface-variant">
              Canais diretos para negociação, envio de espelho de pedido e emergências.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div>
              <label htmlFor="sup-phone" className="block font-label-md mb-1">
                Telefone / WhatsApp <span className="text-error">*</span>
              </label>
              <input
                id="sup-phone"
                required
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                placeholder="(00) 90000-0000"
                maxLength={15}
                className={`w-full h-11 px-3 rounded-lg border ${phoneErr ? 'border-error ring-1 ring-error' : 'border-slate-200'}`}
              />
              {phoneErr && <p className="font-body-sm text-error mt-1">{phoneErr}</p>}
            </div>
            <div>
              <label htmlFor="sup-email" className="block font-label-md mb-1">E-mail para Pedidos</label>
              <input
                id="sup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="sup-contact" className="block font-label-md mb-1">Nome do Vendedor</label>
              <input
                id="sup-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </section>

        {/* Logística de Entrega */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Logística de Entrega</h2>
            <p className="font-body-sm text-on-surface-variant">
              Prazos e rotas programadas de descarregamento no estoque central do mercado.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div>
              <label htmlFor="sup-cat" className="block font-label-md mb-1">Categoria Principal</label>
              <input
                id="sup-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="sup-lead" className="block font-label-md mb-1">
                Prazo Médio de Entrega (dias) <span className="text-error">*</span>
              </label>
              <input
                id="sup-lead"
                type="number"
                min={1}
                required
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <span className="block font-label-md mb-2">Dias de Visita / Entrega</span>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((day) => {
                const selected = visitDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3.5 py-2 rounded-lg font-label-md font-bold transition-colors ${
                      selected
                        ? 'bg-primary-container text-white'
                        : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <p className="font-body-sm text-on-surface-variant mt-2">
              Entregas programadas: {visitDays.length > 0 ? visitDays.join(', ') : 'Nenhum dia selecionado'}
            </p>
          </div>

          <FormFooter
            note="* Campos são obrigatórios para emissão de pedidos de compra"
            onCancel={() => navigate('/fornecedores')}
            submitLabel="Salvar Fornecedor"
            submitIcon="check"
          />
        </section>
      </form>
    </div>
  );
}
