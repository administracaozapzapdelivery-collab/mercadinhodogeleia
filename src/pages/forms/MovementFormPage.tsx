import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { formatBRL } from '../../data/mockData';
import type { StockMovement } from '../../types/erp';
import { FormFooter, FormPageHeader } from '../../components/ui/FormLayout';

const movementOptions: {
  type: StockMovement['type'];
  title: string;
  desc: string;
  icon: string;
}[] = [
  {
    type: 'Entrada',
    title: 'Entrada (Compra / Reposição)',
    desc: 'Soma ao estoque atual',
    icon: 'archive',
  },
  {
    type: 'Perda / Avaria',
    title: 'Perda / Vencimento / Avaria',
    desc: 'Subtrai do estoque atual',
    icon: 'delete_sweep',
  },
  {
    type: 'Saída',
    title: 'Ajuste / Saída Manual',
    desc: 'Correção de inventário',
    icon: 'balance',
  },
];

export function MovementFormPage() {
  const navigate = useNavigate();
  const { products, addMovement } = useErp();

  const [type, setType] = useState<StockMovement['type']>('Entrada');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(24);
  const [reason, setReason] = useState('NF-e #4589 - Reposição de fornecedor');

  const product = products.find((p) => p.id === selectedProductId) ?? products[0];
  const delta = type === 'Entrada' ? quantity : -quantity;
  const projectedStock = (product?.stock ?? 0) + delta;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    addMovement({
      id: String(Date.now()),
      date: '24/11/2026 17:20',
      productName: product.name,
      type,
      quantity: delta,
      reason: reason.trim(),
      operator: 'Geleia (Administrador)',
    });
    navigate('/movimentacoes-e-perdas');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Movimentações"
        backTo="/movimentacoes-e-perdas"
        icon="sync_alt"
        title="Nova Movimentação de Estoque"
        subtitle="Registre entradas de compras, baixas por vencimento/avaria ou ajustes de inventário no Mercadinho do Geleia"
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {/* 1. Tipo de Movimentação */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div>
            <h2 className="font-headline-sm font-bold text-primary">
              1. Tipo de Movimentação <span className="text-error">*</span>
            </h2>
            <p className="font-body-sm text-on-surface-variant">Escolha a natureza da operação de estoque</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
            {movementOptions.map((opt) => {
              const active = type === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setType(opt.type)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    active
                      ? 'border-primary-container bg-primary-fixed/30 ring-2 ring-primary-container/30'
                      : 'border-slate-200 bg-white hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="material-symbols-outlined text-primary-container">{opt.icon}</span>
                    {active && (
                      <span className="px-2 py-0.5 rounded-full bg-primary-container text-white font-label-sm font-bold">
                        Selecionado ✓
                      </span>
                    )}
                  </div>
                  <p className="font-label-lg font-bold text-on-surface">{opt.title}</p>
                  <p className="font-body-sm text-on-surface-variant">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. Identificação do Produto */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div>
            <h2 className="font-headline-sm font-bold text-primary">
              2. Identificação do Produto <span className="text-error">*</span>
            </h2>
            <p className="font-body-sm text-on-surface-variant">Selecione o produto ou bipe o EAN</p>
          </div>

          <select
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — EAN: {p.barcode} (Atual: {p.stock} {p.unit})
              </option>
            ))}
          </select>

          {product && (
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-label-lg font-bold text-primary">{product.name}</p>
                <p className="font-body-sm text-on-surface-variant">
                  {product.category} • EAN: {product.barcode} • Custo: {formatBRL(product.costPrice)} • Venda:{' '}
                  {formatBRL(product.salePrice)}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-white border border-slate-200 font-label-md font-bold">
                Estoque Atual: {product.stock} {product.unit}
              </span>
            </div>
          )}
        </section>

        {/* 3. Quantidade e Motivo */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div>
            <h2 className="font-headline-sm font-bold text-primary">
              3. Quantidade e Motivo <span className="text-error">*</span>
            </h2>
            <p className="font-body-sm text-on-surface-variant">
              Especifique o montante movimentado e a justificativa fiscal/operacional
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-lg border border-slate-200 bg-white font-bold text-lg"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 h-10 text-center rounded-lg border border-slate-200 font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 rounded-lg border border-slate-200 bg-white font-bold text-lg"
              >
                +
              </button>
            </div>

            {product && (
              <div className="px-4 py-2 rounded-xl bg-tertiary-fixed/30 border border-tertiary-fixed-dim text-tertiary font-label-md font-bold tabular-nums">
                Novo estoque: {projectedStock} {product.unit} ({product.stock} atuais{' '}
                {delta >= 0 ? `+ ${delta}` : `- ${Math.abs(delta)}`})
              </div>
            )}
          </div>

          <div>
            <label htmlFor="mov-reason" className="block font-label-md mb-1">
              Motivo / Observação <span className="text-error">*</span>
            </label>
            <input
              id="mov-reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border border-slate-200"
            />
          </div>

          <FormFooter
            note="* Campos de preenchimento obrigatório para atualização do estoque"
            onCancel={() => navigate('/movimentacoes-e-perdas')}
            submitLabel="Confirmar Movimentação"
            submitIcon="check"
          />
        </section>
      </form>
    </div>
  );
}
