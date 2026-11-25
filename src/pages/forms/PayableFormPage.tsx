import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import type { PayableAccount } from '../../types/erp';
import { FormFooter, FormPageHeader } from '../../components/ui/FormLayout';

export function PayableFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { payables, addPayable, updatePayable, suppliers } = useErp();

  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState(suppliers[0]?.name ?? 'Despesa Fixa / Sem Fornecedor');
  const [category, setCategory] = useState('Compra de Mercadoria');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('2026-11-30');
  const [status, setStatus] = useState<PayableAccount['status']>('Pendente');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    const existing = payables.find((p) => p.id === id);
    if (!existing) return;
    setDescription(existing.description);
    setSupplier(existing.supplier || 'Despesa Fixa / Sem Fornecedor');
    setCategory(existing.category);
    setAmount(String(existing.amount));
    const iso = existing.dueDate.includes('/')
      ? existing.dueDate.split('/').reverse().join('-')
      : existing.dueDate;
    setDueDate(iso);
    setStatus(existing.status);
  }, [id, payables]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formattedDate = dueDate.includes('-')
      ? dueDate.split('-').reverse().join('/')
      : dueDate;

    const payload = {
      description: description.trim(),
      supplier,
      dueDate: formattedDate,
      amount: Number(amount) || 0,
      status,
      category,
    };
    if (isEdit && id) {
      await updatePayable(id, payload);
    } else {
      await addPayable({
        id: String(Date.now()),
        ...payload,
      });
    }
    navigate('/contas-a-pagar');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Contas a Pagar"
        backTo="/contas-a-pagar"
        icon={isEdit ? 'edit' : 'payments'}
        title={isEdit ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
        subtitle="Lance boletos de fornecedores ou despesas fixas do Mercadinho do Geleia"
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {/* Etapa 1 */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Dados do Boleto ou Despesa</h2>
            <span className="font-label-sm uppercase text-secondary">Etapa 1 de 3</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="md:col-span-2">
              <label htmlFor="pay-desc" className="block font-label-md mb-1">
                Descrição da Despesa <span className="text-error">*</span>
              </label>
              <input
                id="pay-desc"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: NF-e #10450 — Reposição Laticínios"
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="pay-sup" className="block font-label-md mb-1">
                Fornecedor Vinculado (Opcional)
              </label>
              <select
                id="pay-sup"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Despesa Fixa / Sem Fornecedor">Despesa Fixa / Sem Fornecedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} ({s.cnpj})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pay-cat" className="block font-label-md mb-1">
                Categoria da Despesa <span className="text-error">*</span>
              </label>
              <select
                id="pay-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option>Compra de Mercadoria</option>
                <option>Energia / Água / Internet</option>
                <option>Aluguel do Galpão</option>
                <option>Impostos / Simples Nacional / Taxas</option>
                <option>Manutenção e Equipamentos</option>
                <option>Folha e Encargos Funcionários</option>
              </select>
            </div>
          </div>
        </section>

        {/* Etapa 2 */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Prazos e Situação Financeira</h2>
            <span className="font-label-sm uppercase text-secondary">Etapa 2 de 3</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div>
              <label htmlFor="pay-amt" className="block font-label-md mb-1">
                Valor a Pagar (R$) <span className="text-error">*</span>
              </label>
              <input
                id="pay-amt"
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="pay-due" className="block font-label-md mb-1">
                Data de Vencimento <span className="text-error">*</span>
              </label>
              <input
                id="pay-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label htmlFor="pay-status" className="block font-label-md mb-1">
                Status do Pagamento <span className="text-error">*</span>
              </label>
              <select
                id="pay-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as PayableAccount['status'])}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="Pendente">Pendente (Aguardando)</option>
                <option value="Pago">Pago (Liquidado)</option>
                <option value="Vencido">Atrasado (Vencido)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Etapa 3 */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Linha Digitável e Observações</h2>
            <span className="font-label-sm uppercase text-secondary">Etapa 3 de 3</span>
          </div>

          <div>
            <label htmlFor="pay-bar" className="block font-label-md mb-1">
              Código de Barras / Linha Digitável (Opcional)
            </label>
            <input
              id="pay-bar"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Bipe com o leitor USB ou cole a linha digitável do boleto"
              className="w-full h-11 px-3 rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label htmlFor="pay-notes" className="block font-label-md mb-1">Observações Internas</label>
            <textarea
              id="pay-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações do Caixa / Financeiro"
              className="w-full p-3 rounded-lg border border-slate-200"
            />
          </div>

          <FormFooter
            onCancel={() => navigate('/contas-a-pagar')}
            submitLabel="Salvar Conta a Pagar"
            submitIcon="check"
          />
        </section>
      </form>
    </div>
  );
}
