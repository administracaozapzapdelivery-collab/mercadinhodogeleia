import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useErp } from '../../context/ErpContext';
import { FormFooter, FormPageHeader, StatusToggleCard } from '../../components/ui/FormLayout';

const labelColors = [
  { hex: '#551BB3', name: 'Roxo Geleia', darkText: false },
  { hex: '#268FBE', name: 'Azul Petróleo', darkText: false },
  { hex: '#2CB8B2', name: 'Turquesa', darkText: false },
  { hex: '#3DDB8F', name: 'Verde Menta', darkText: true },
  { hex: '#A9F04D', name: 'Verde Lima', darkText: true },
];

export function CategoryFormPage() {
  const navigate = useNavigate();
  const { addCategory } = useErp();

  const [active, setActive] = useState(true);
  const [name, setName] = useState('Laticínios e Frios');
  const [description, setDescription] = useState(
    'Seção refrigerada contendo queijos finos, leites integrais e desnatados, embutidos fatiados e manteigas coloniais.'
  );
  const [selectedColor, setSelectedColor] = useState(labelColors[0]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    addCategory({
      id: String(Date.now()),
      name: name.trim(),
      description: description.trim() || 'Sem descrição adicional',
      productCount: 0,
      marginTarget: 32,
    });
    navigate('/categorias');
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-space-lg">
      <FormPageHeader
        backLabel="Voltar para Categorias"
        backTo="/categorias"
        icon="category"
        title="Cadastrar Nova Categoria"
        subtitle="Crie ou edite uma seção para organizar os produtos do Mercadinho do Geleia"
        rightSlot={
          <StatusToggleCard
            title="Categoria Ativa"
            subtitle="Visível no PDV e Catálogo"
            checked={active}
            onChange={setActive}
          />
        }
      />

      <form
        onSubmit={handleSubmit}
        className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-space-xl space-y-space-xl"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-surface-container">
          <span className="material-symbols-outlined text-primary-container text-[20px]">
            label_important
          </span>
          <h2 className="font-headline-sm font-bold text-primary">Dados da Categoria</h2>
        </div>

        <div className="space-y-space-lg">
          <div>
            <label htmlFor="cat-name" className="block font-label-md text-on-surface mb-1.5">
              Nome da Categoria <span className="text-error">*</span>
            </label>
            <div className="relative">
              <input
                id="cat-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Laticínios e Frios"
                className="w-full h-11 pl-3.5 pr-10 rounded-lg border border-slate-200 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
              />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                edit
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="cat-desc" className="font-label-md text-on-surface">
                Descrição
              </label>
              <span className="font-body-sm text-on-surface-variant">Opcional</span>
            </div>
            <textarea
              id="cat-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva os tipos de produtos que compõem esta seção..."
              className="w-full p-3.5 rounded-lg border border-slate-200 bg-white text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>

          <div className="pt-2">
            <h3 className="font-label-lg font-bold text-on-surface">Cor da Etiqueta no Sistema</h3>
            <p className="font-body-sm text-on-surface-variant mt-0.5">
              Escolha uma cor de destaque para identificar rapidamente esta categoria nas tabelas e no PDV.
            </p>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {labelColors.map((color) => {
                  const isSelected = selectedColor.hex === color.hex;
                  return (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      title={color.name}
                      style={{ backgroundColor: color.hex }}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                        isSelected ? 'ring-2 ring-offset-2 ring-primary-container scale-105' : 'hover:scale-105'
                      }`}
                    >
                      {isSelected && (
                        <span
                          className={`material-symbols-outlined text-[18px] font-bold ${
                            color.darkText ? 'text-on-surface' : 'text-white'
                          }`}
                        >
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col sm:items-end gap-1">
                <span className="font-label-sm uppercase text-on-surface-variant">
                  Visualização no Balcão:
                </span>
                <span
                  style={{ backgroundColor: selectedColor.hex }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-label-md font-bold shadow-sm ${
                    selectedColor.darkText ? 'text-on-surface' : 'text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">local_offer</span>
                  <span>{name.trim() || 'Nova Categoria'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <FormFooter
          onCancel={() => navigate('/categorias')}
          submitLabel="Salvar Categoria"
          submitIcon="check"
        />
      </form>
    </div>
  );
}
