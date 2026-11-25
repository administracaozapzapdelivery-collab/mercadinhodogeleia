import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FormPageHeaderProps {
  backLabel: string;
  backTo: string;
  icon: string;
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}

export function FormPageHeader({
  backLabel,
  backTo,
  icon,
  title,
  subtitle,
  rightSlot,
}: FormPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-space-md">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="inline-flex items-center gap-1.5 text-on-surface-variant hover:text-primary font-label-md font-semibold w-fit transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        <span>{backLabel}</span>
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex items-start gap-space-md">
          <div className="w-11 h-11 rounded-xl bg-surface-container-lowest border border-slate-200 shadow-sm flex items-center justify-center text-primary-container shrink-0">
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
          </div>
          <div>
            <h1 className="font-headline-md text-headline-md text-primary font-bold">{title}</h1>
            <p className="font-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>
          </div>
        </div>
        {rightSlot}
      </div>
    </div>
  );
}

interface StatusToggleCardProps {
  title: string;
  subtitle: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function StatusToggleCard({ title, subtitle, checked, onChange }: StatusToggleCardProps) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-surface-container-lowest border border-slate-200 shadow-sm cursor-pointer select-none min-w-[240px]">
      <div>
        <p className="font-label-md font-bold text-on-surface">{title}</p>
        <p className="font-body-sm text-on-surface-variant">{subtitle}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-primary-container rounded cursor-pointer"
      />
    </label>
  );
}

interface FormFooterProps {
  note?: string;
  onCancel: () => void;
  submitLabel: string;
  submitIcon?: string;
}

export function FormFooter({
  note = '* Campos de preenchimento obrigatório',
  onCancel,
  submitLabel,
  submitIcon = 'check',
}: FormFooterProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-md border-t border-surface-container">
      <span className="font-body-sm text-on-surface-variant">{note}</span>
      <div className="flex items-center justify-end gap-space-sm">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-surface-container-low text-on-surface font-label-lg font-semibold transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#3DDB8F] hover:bg-[#32c77f] text-[#0F172A] font-label-lg font-bold shadow-sm transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[18px]">{submitIcon}</span>
          <span>{submitLabel}</span>
        </button>
      </div>
    </div>
  );
}
