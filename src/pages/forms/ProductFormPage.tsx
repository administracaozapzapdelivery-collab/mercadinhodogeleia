import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { formatBRL } from '../../data/mockData';
import type { Product } from '../../types/erp';
import { FormFooter, FormPageHeader, StatusToggleCard } from '../../components/ui/FormLayout';

export function ProductFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { products, addProduct, updateProduct, categories, suppliers } = useErp();

  const [active, setActive] = useState(true);
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? 'Mercearia');
  const [supplier, setSupplier] = useState(suppliers[0]?.name ?? '');
  const [unit, setUnit] = useState<Product['unit']>('un');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [marginInput, setMarginInput] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [adminOnly, setAdminOnly] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!id) return;
    const existing = products.find((p) => p.id === id);
    if (!existing) return;
    setBarcode(existing.barcode);
    setName(existing.name);
    setCategory(existing.category);
    setUnit(existing.unit);
    setCostPrice(String(existing.costPrice));
    setSalePrice(String(existing.salePrice));
    setMarginInput(
      existing.salePrice > 0
        ? (((existing.salePrice - existing.costPrice) / existing.salePrice) * 100).toFixed(1)
        : '0.0'
    );
    setStock(String(existing.stock));
    setMinStock(String(existing.minStock));
    setExpiryDate(existing.expiryDate ?? '');
    setAdminOnly(Boolean(existing.adminOnly));
  }, [id, products]);

  const cost = Number(costPrice) || 0;
  const sale = Number(salePrice) || 0;
  const profit = sale - cost;
  const marginPct = sale > 0 ? (profit / sale) * 100 : 0;

  function handleCostChange(val: string) {
    setCostPrice(val);
    const nextCost = Number(val) || 0;
    if (sale > 0) {
      setMarginInput((((sale - nextCost) / sale) * 100).toFixed(1));
    } else {
      setMarginInput('0.0');
    }
  }

  function handleSaleChange(val: string) {
    setSalePrice(val);
    const nextSale = Number(val) || 0;
    const currentMargin = Number(marginInput) || 0;
    if ((!costPrice || Number(costPrice) === 0) && currentMargin > 0 && nextSale > 0) {
      const generatedCost = Math.max(0, nextSale * (1 - currentMargin / 100));
      setCostPrice(generatedCost.toFixed(2));
    } else if (nextSale > 0) {
      setMarginInput((((nextSale - cost) / nextSale) * 100).toFixed(1));
    } else {
      setMarginInput('0.0');
    }
  }

  function handleMarginChange(val: string) {
    setMarginInput(val);
    const nextMargin = Number(val);
    if (!Number.isNaN(nextMargin) && sale > 0) {
      const generatedCost = Math.max(0, sale * (1 - nextMargin / 100));
      setCostPrice(generatedCost.toFixed(2));
    }
  }

  function generateInternalCode() {
    const rand = Math.floor(10000 + Math.random() * 90000);
    setBarcode(`INT-${rand}`);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || /^\d+$/.test(trimmedName)) {
      setNameError(true);
      setToast(
        'O nome do produto não pode conter apenas números (use o campo de código de barras para códigos numéricos).'
      );
      nameInputRef.current?.focus();
      return;
    }
    setNameError(false);
    const payload = {
      barcode: barcode.trim(),
      name: trimmedName,
      category,
      unit,
      costPrice: cost,
      salePrice: sale,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 5,
      expiryDate: expiryDate || undefined,
      adminOnly,
    };
    try {
      if (isEdit && id) {
        await updateProduct(id, payload);
      } else {
        await addProduct({
          id: String(Date.now()),
          sku: `PRD-${Math.floor(100 + Math.random() * 900)}`,
          ...payload,
          abcClass: 'B',
        });
      }
      navigate('/produtos');
    } catch (err) {
      setToast((err as Error).message || 'Não foi possível salvar o produto.');
    }
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-space-lg">
      {toast && (
        <div
          role="alert"
          className="fixed top-5 right-5 z-[80] max-w-md w-[calc(100%-2.5rem)] sm:w-auto flex items-center gap-3 px-4 py-3.5 rounded-xl bg-error text-white shadow-2xl border border-white/20"
        >
          <span className="material-symbols-outlined text-[22px] shrink-0">warning</span>
          <span className="font-label-md font-bold flex-1">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors shrink-0"
            aria-label="Fechar aviso"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}
      <FormPageHeader
        backLabel="Voltar para Produtos"
        backTo="/produtos"
        icon={isEdit ? 'edit' : 'inventory_2'}
        title={isEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}
        subtitle="Bipe o código de barras ou preencha os dados para liberar o item no PDV do Mercadinho do Geleia"
        rightSlot={
          <StatusToggleCard
            title="Status no Caixa"
            subtitle="Disponível para venda"
            checked={active}
            onChange={setActive}
          />
        }
      />

      <form onSubmit={handleSubmit} className="space-y-space-lg">
        {/* Pré-visualização no PDV */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-md">
          <div>
            <h2 className="font-headline-sm font-bold text-primary">Pré-visualização no Caixa (PDV)</h2>
            <p className="font-body-sm text-on-surface-variant">
              Assim o botão rápido e o preço aparecerão para o operador na frente de loja.
            </p>
          </div>
          <div className="w-full md:w-72 p-4 rounded-xl border border-primary/20 bg-surface-container-low">
            <span className="font-label-sm uppercase text-secondary">{category}</span>
            <p className="font-label-lg font-bold text-on-surface mt-0.5 truncate">
              {name.trim() || 'Nome do produto'}
            </p>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-headline-sm font-extrabold text-primary tabular-nums">
                {formatBRL(sale)}
              </span>
              <span className="font-body-sm text-on-surface-variant">EAN: {barcode || '---'}</span>
            </div>
          </div>
        </section>

        {/* Identificação do Produto */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="pb-3 border-b border-surface-container">
            <h2 className="font-headline-sm font-bold text-primary">Identificação do Produto</h2>
            <p className="font-body-sm text-on-surface-variant">
              Informações fiscais, cadastrais e de agrupamento
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
            <div className="md:col-span-2">
              <label htmlFor="prod-barcode" className="block font-label-md mb-1">
                Código de Barras (EAN-13 ou Código Interno) <span className="text-error">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
                    barcode_scanner
                  </span>
                  <input
                    id="prod-barcode"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={generateInternalCode}
                  className="px-4 h-11 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-md font-bold text-primary whitespace-nowrap"
                >
                  Gerar Interno
                </button>
              </div>
              <p className="font-body-sm text-on-surface-variant mt-1">
                Para produtos pesáveis da padaria/açougue ou fracionados, use o gerador de código interno (INT-XXXXX).
              </p>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="prod-name" className="block font-label-md mb-1">
                Nome Completo do Produto <span className="text-error">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="prod-name"
                required
                maxLength={80}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(false);
                }}
                placeholder="Ex: Arroz Tipo 1 Camil 5kg"
                className={`w-full h-11 px-3 rounded-lg border ${
                  nameError ? 'border-error ring-2 ring-error/20' : 'border-slate-200'
                }`}
              />
            </div>

            <div>
              <label htmlFor="prod-cat" className="block font-label-md mb-1">
                Categoria <span className="text-error">*</span>
              </label>
              <select
                id="prod-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prod-sup" className="block font-label-md mb-1">
                Fornecedor / Distribuidor
              </label>
              <select
                id="prod-sup"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prod-unit" className="block font-label-md mb-1">
                Unidade de Medida <span className="text-error">*</span>
              </label>
              <select
                id="prod-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as Product['unit'])}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 bg-white"
              >
                <option value="un">UN — Unidade</option>
                <option value="kg">KG — Quilograma (Balança)</option>
                <option value="L">LT — Litro</option>
                <option value="cx">CX — Caixa Fechada</option>
              </select>
            </div>
          </div>
        </section>

        {/* Precificação, Estoque e Validade */}
        <section className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
            <div>
              <h2 className="font-headline-sm font-bold text-primary">Precificação, Estoque e Validade</h2>
              <p className="font-body-sm text-on-surface-variant">
                Defina margens, estoque de segurança e controle de vencimento
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-tertiary-fixed/40 text-tertiary font-label-md font-bold tabular-nums">
              Margem Estimada: {marginPct.toFixed(1)}% ({formatBRL(profit)} / {unit})
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
            <div>
              <label htmlFor="prod-cost" className="block font-label-md mb-1">Preço de Custo (R$)</label>
              <input
                id="prod-cost"
                type="number"
                step="0.01"
                placeholder="0,00"
                value={costPrice}
                onChange={(e) => handleCostChange(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="prod-sale" className="block font-label-md mb-1">
                Preço de Venda PDV (R$) <span className="text-error">*</span>
              </label>
              <input
                id="prod-sale"
                type="number"
                step="0.01"
                required
                placeholder="0,00"
                value={salePrice}
                onChange={(e) => handleSaleChange(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="prod-margin" className="block font-label-md mb-1">
                Margem Estimada (%)
              </label>
              <input
                id="prod-margin"
                type="number"
                step="0.1"
                max="100"
                placeholder="0,0"
                value={marginInput}
                onChange={(e) => handleMarginChange(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="prod-stock" className="block font-label-md mb-1">Estoque Inicial</label>
              <input
                id="prod-stock"
                type="number"
                placeholder="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="prod-min" className="block font-label-md mb-1">Estoque Mínimo</label>
              <input
                id="prod-min"
                type="number"
                placeholder="5"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label htmlFor="prod-exp" className="block font-label-md mb-1">Data de Validade (Opcional)</label>
              <input
                id="prod-exp"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-200"
              />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2.5 pt-5 font-label-md cursor-pointer">
              <input
                type="checkbox"
                checked={adminOnly}
                onChange={(e) => setAdminOnly(e.target.checked)}
                className="w-4 h-4 accent-primary-container"
              />
              <span>Visível somente para Administrador</span>
            </label>
          </div>

          <FormFooter
            onCancel={() => navigate('/produtos')}
            submitLabel="Salvar Produto"
            submitIcon="check"
          />
        </section>
      </form>
    </div>
  );
}
