import React, { useState } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl border border-slate-200/80 shadow-sm">
      <div className="flex flex-col">
        {badge && (
          <div className="flex items-center gap-space-xs mb-1">
            <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
              {badge}
            </span>
          </div>
        )}
        <h1 className="font-headline-md text-headline-md text-primary">{title}</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-space-sm">{actions}</div>}
    </section>
  );
}

interface StatusBadgeProps {
  label: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const toneClasses: Record<NonNullable<StatusBadgeProps['tone']>, string> = {
  success: 'bg-tertiary-fixed/40 text-tertiary border border-tertiary-fixed-dim/50',
  warning: 'bg-amber-100 text-amber-900 border border-amber-200',
  danger: 'bg-error-container text-on-error-container border border-error/20',
  info: 'bg-secondary-fixed text-on-secondary-fixed border border-secondary-container/50',
  neutral: 'bg-surface-container text-on-surface-variant border border-outline-variant/40',
};

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-bold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-space-lg py-space-md border-b border-surface-container bg-surface-container-low/50">
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="p-space-lg">{children}</div>
      </div>
    </div>
  );
}

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {}

export function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Visualizar senha'}
        title={visible ? 'Ocultar senha' : 'Visualizar senha'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-[19px]">
          {visible ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
