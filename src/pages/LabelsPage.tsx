import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useErp } from '../context/ErpContext';
import { formatBRL } from '../data/mockData';
import { PageHeader } from '../components/ui/SharedUI';
import { BarcodeSvg, getCode128Bars } from '../components/BarcodeSvg';

interface LabelPreset {
  id: string;
  label: string;
  group: 'A4' | 'Térmica';
  widthMm: number;
  heightMm: number;
  cols: number;
  compact?: boolean;
}

const LABEL_PRESETS: LabelPreset[] = [
  { id: 'a4-63x38', label: 'Folha A4 — 3 colunas (63,5 × 38 mm)', group: 'A4', widthMm: 63.5, heightMm: 38, cols: 3 },
  { id: 'a4-95x35', label: 'Folha A4 — 2 colunas Gôndola (95 × 35 mm)', group: 'A4', widthMm: 95, heightMm: 35, cols: 2 },
  { id: 'a4-46x25', label: 'Folha A4 — 4 colunas Compacta (46 × 28 mm)', group: 'A4', widthMm: 46, heightMm: 28, cols: 4, compact: true },
  { id: 't-105x30', label: 'Térmica — 105 × 30 mm (Gôndola Padrão Brasil)', group: 'Térmica', widthMm: 105, heightMm: 30, cols: 1 },
  { id: 't-105x40', label: 'Térmica — 105 × 40 mm (Gôndola Larga)', group: 'Térmica', widthMm: 105, heightMm: 40, cols: 1 },
  { id: 't-80x40', label: 'Térmica — 80 × 40 mm (Gôndola Média)', group: 'Térmica', widthMm: 80, heightMm: 40, cols: 1 },
  { id: 't-80x30', label: 'Térmica — 80 × 30 mm (Gôndola Compacta)', group: 'Térmica', widthMm: 80, heightMm: 30, cols: 1 },
  { id: 't-60x30', label: 'Térmica — 60 × 30 mm (Embalagem / Balança)', group: 'Térmica', widthMm: 60, heightMm: 30, cols: 1, compact: true },
  { id: 't-50x30', label: 'Térmica — 50 × 30 mm (Produto Pequeno)', group: 'Térmica', widthMm: 50, heightMm: 30, cols: 1, compact: true },
  { id: 't-40x25', label: 'Térmica — 40 × 25 mm (Mini Código de Barras)', group: 'Térmica', widthMm: 40, heightMm: 25, cols: 1, compact: true },
];

export function LabelsPage() {
  const { products, company } = useErp();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [presetId, setPresetId] = useState<string>('a4-63x38');
  const [showStoreName, setShowStoreName] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const preset = useMemo(
    () => LABEL_PRESETS.find((p) => p.id === presetId) ?? LABEL_PRESETS[0],
    [presetId]
  );

  useEffect(() => {
    const pid = searchParams.get('productId');
    if (pid && products.some((p) => p.id === pid)) {
      setQuantities((prev) => (prev[pid] ? prev : { ...prev, [pid]: 1 }));
    }
  }, [searchParams, products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    );
  }, [products, search]);

  function setQty(id: string, qty: number) {
    const safe = Math.max(0, Math.min(200, qty));
    setQuantities((prev) => {
      if (safe === 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: safe };
    });
  }

  function selectAllFiltered() {
    setQuantities((prev) => {
      const next = { ...prev };
      for (const p of filtered) {
        if (!next[p.id]) next[p.id] = 1;
      }
      return next;
    });
  }

  const labelsToPrint = useMemo(() => {
    const items: { key: string; product: (typeof products)[number] }[] = [];
    for (const p of products) {
      const count = quantities[p.id] ?? 0;
      for (let i = 0; i < count; i++) {
        items.push({ key: `${p.id}-${i}`, product: p });
      }
    }
    return items;
  }, [products, quantities]);

  const gridClass =
    preset.group === 'Térmica'
      ? 'flex flex-col items-center gap-3'
      : preset.cols === 2
        ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
        : preset.cols === 4
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5'
          : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3';

  const storeName = company?.nome_fantasia || 'Mercadinho do Geleia';

  function handleDownloadPdf() {
    if (labelsToPrint.length === 0) return;

    const isThermal = preset.group === 'Térmica';
    const pageW = isThermal ? preset.widthMm : 210;
    const pageH = isThermal ? preset.heightMm : 297;

    const doc = new jsPDF({
      orientation: isThermal && pageW > pageH ? 'landscape' : 'portrait',
      unit: 'mm',
      format: isThermal ? [pageW, pageH] : 'a4',
    });

    const cols = preset.cols;
    const margin = isThermal ? 1.5 : 8;
    const gap = isThermal ? 0 : 3;
    const cardW = isThermal ? pageW - margin * 2 : preset.widthMm;
    const cardH = isThermal ? pageH - margin * 2 : preset.heightMm;
    const rowsPerPage = isThermal ? 1 : Math.floor((pageH - margin * 2 + gap) / (cardH + gap));

    labelsToPrint.forEach(({ product }, idx) => {
      if (isThermal) {
        if (idx > 0) doc.addPage([pageW, pageH], pageW > pageH ? 'landscape' : 'portrait');
      } else {
        const perPage = cols * rowsPerPage;
        if (idx > 0 && idx % perPage === 0) doc.addPage('a4', 'portrait');
      }

      const posInPage = isThermal ? 0 : idx % (cols * rowsPerPage);
      const col = isThermal ? 0 : posInPage % cols;
      const row = isThermal ? 0 : Math.floor(posInPage / cols);
      const x = margin + col * (cardW + gap);
      const y = margin + row * (cardH + gap);

      // Borda da etiqueta
      doc.setDrawColor(180);
      doc.setLineDashPattern([1, 1], 0);
      doc.rect(x, y, cardW, cardH);
      doc.setLineDashPattern([], 0);

      let curY = y + (preset.compact ? 3 : 3.8);
      if (showStoreName) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(preset.compact ? 5.5 : 6.5);
        doc.setTextColor(90);
        doc.text(storeName.toUpperCase(), x + 2, curY, { maxWidth: cardW - 4 });
        curY += preset.compact ? 2.5 : 3.2;
      }

      // Nome do produto (máx. 2 linhas)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(preset.compact ? 7 : 8.5);
      doc.setTextColor(15);
      const maxNameLines = preset.heightMm <= 28 ? 1 : 2;
      const nameLines = (doc.splitTextToSize(product.name, cardW - 4) as string[]).slice(0, maxNameLines);
      doc.text(nameLines, x + 2, curY);
      curY += nameLines.length * (preset.compact ? 2.8 : 3.4) + 1;

      // Linha divisória + Preço
      doc.setDrawColor(210);
      doc.line(x + 2, curY, x + cardW - 2, curY);
      curY += preset.compact ? 4 : 5;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(preset.compact ? 5.8 : 7);
      doc.setTextColor(90);
      doc.text(`POR ${product.unit.toUpperCase()}`, x + 2, curY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(preset.compact ? 10 : 13);
      doc.setTextColor(0);
      doc.text(formatBRL(product.salePrice), x + cardW - 2, curY, { align: 'right' });

      curY += 1.6;
      doc.line(x + 2, curY, x + cardW - 2, curY);
      curY += 1.2;

      // Código de barras vetorial
      const code = product.barcode || product.sku;
      const { cleanValue, bars, totalWidth } = getCode128Bars(code);
      const barcodeAreaW = cardW - 4;
      const scale = barcodeAreaW / totalWidth;
      const barH = Math.max(4.5, y + cardH - curY - 4);

      doc.setFillColor(0, 0, 0);
      for (const b of bars) {
        doc.rect(x + 2 + b.x * scale, curY, b.w * scale, barH, 'F');
      }

      doc.setFont('courier', 'bold');
      doc.setFontSize(preset.compact ? 5.8 : 6.8);
      doc.setTextColor(0);
      doc.text(cleanValue, x + cardW / 2, curY + barH + 2.8, { align: 'center' });
    });

    doc.save(`etiquetas-${preset.id}.pdf`);
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="no-print">
        <PageHeader
          badge="Catálogo & Gôndola"
          title="Gerador de Etiquetas"
          subtitle="Selecione os produtos, defina as quantidades e imprima ou baixe o PDF com nome, preço e código de barras."
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={labelsToPrint.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-secondary hover:opacity-90 disabled:opacity-50 text-white font-label-lg font-bold shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                <span>Baixar PDF ({labelsToPrint.length})</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={labelsToPrint.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container hover:bg-primary disabled:opacity-50 text-white font-label-lg font-bold shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">print</span>
                <span>Imprimir ({labelsToPrint.length})</span>
              </button>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Painel de Seleção (oculto na impressão) */}
        <section className="no-print lg:col-span-5 bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-4 space-y-4">
          <div className="space-y-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto por nome, SKU ou código..."
              className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-secondary"
            />

            <div className="space-y-2">
              <div>
                <label htmlFor="lbl-format" className="block font-label-sm uppercase text-on-surface-variant mb-1">
                  Tamanho da Etiqueta ({preset.widthMm} × {preset.heightMm} mm)
                </label>
                <select
                  id="lbl-format"
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-slate-200 bg-white font-label-md"
                >
                  <optgroup label="Folha A4 (Recorte / Pimaco)">
                    {LABEL_PRESETS.filter((p) => p.group === 'A4').map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Impressora Térmica (Rolo em mm)">
                    {LABEL_PRESETS.filter((p) => p.group === 'Térmica').map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-label-md pt-1">
                <input
                  type="checkbox"
                  checked={showStoreName}
                  onChange={(e) => setShowStoreName(e.target.checked)}
                  className="w-4 h-4 accent-primary-container rounded"
                />
                <span>Exibir nome da loja na etiqueta</span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm font-bold text-primary"
              >
                Selecionar Filtrados ({filtered.length})
              </button>
              {labelsToPrint.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantities({})}
                  className="px-3 py-1.5 rounded-lg bg-error-container text-on-error-container font-label-sm font-bold"
                >
                  Limpar Seleção
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-surface-container max-h-[520px] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const q = quantities[p.id] ?? 0;
              return (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-label-md font-bold text-on-surface truncate">{p.name}</p>
                    <p className="font-body-sm text-on-surface-variant">
                      {formatBRL(p.salePrice)} / {p.unit} • {p.barcode || p.sku}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQty(p.id, q - 1)}
                      className="w-7 h-7 rounded-md border border-slate-200 flex items-center justify-center font-bold hover:bg-surface-container"
                      aria-label={`Diminuir etiquetas de ${p.name}`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={q}
                      onChange={(e) => setQty(p.id, Number(e.target.value) || 0)}
                      className="w-12 h-7 text-center rounded-md border border-slate-200 font-bold text-sm tabular-nums"
                      aria-label={`Quantidade de etiquetas de ${p.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => setQty(p.id, q + 1)}
                      className="w-7 h-7 rounded-md bg-primary-container text-white flex items-center justify-center font-bold hover:opacity-90"
                      aria-label={`Aumentar etiquetas de ${p.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Área de Pré-visualização e Impressão */}
        <section className="lg:col-span-7 bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-sm p-4">
          <div className="no-print flex items-center justify-between border-b border-surface-container pb-3 mb-4">
            <h2 className="font-headline-sm font-bold text-primary">
              Pré-visualização ({labelsToPrint.length}{' '}
              {labelsToPrint.length === 1 ? 'etiqueta' : 'etiquetas'})
            </h2>
            <span className="font-body-sm text-on-surface-variant">
              Pronto para leitura em leitor de código de barras
            </span>
          </div>

          {labelsToPrint.length === 0 ? (
            <div className="no-print py-16 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[44px] text-outline-variant mb-2 block">
                qr_code_2
              </span>
              <p className="font-label-lg font-bold text-on-surface">Nenhuma etiqueta selecionada</p>
              <p className="font-body-sm mt-1">
                Clique no botão <strong>+</strong> ao lado dos produtos para gerar suas etiquetas.
              </p>
            </div>
          ) : (
            <div className={`labels-print-area ${gridClass}`}>
              {labelsToPrint.map(({ key, product }) => (
                <div
                  key={key}
                  style={
                    preset.group === 'Térmica'
                      ? { width: `${preset.widthMm}mm`, minHeight: `${preset.heightMm}mm` }
                      : { minHeight: `${preset.heightMm}mm` }
                  }
                  className="label-card border border-slate-300 rounded-lg p-2.5 bg-white text-black flex flex-col justify-between gap-1"
                >
                  {showStoreName && (
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-600 truncate">
                      {storeName}
                    </p>
                  )}
                  <p
                    className={`${
                      preset.compact ? 'text-[11px]' : 'text-xs'
                    } font-extrabold leading-tight line-clamp-2`}
                  >
                    {product.name}
                  </p>
                  <div className="flex items-baseline justify-between border-y border-dashed border-slate-300 py-0.5 my-0.5">
                    <span className="text-[9px] font-semibold uppercase text-slate-600">
                      Por {product.unit}
                    </span>
                    <span
                      className={`${
                        preset.compact ? 'text-base' : 'text-xl'
                      } font-black tracking-tight tabular-nums`}
                    >
                      {formatBRL(product.salePrice)}
                    </span>
                  </div>
                  <BarcodeSvg
                    value={product.barcode || product.sku}
                    height={preset.compact ? 26 : 34}
                    showText
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
