import type { ReactNode } from 'react';
import { Modal } from './SharedUI';

interface CrudActionButtonsProps {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  extra?: ReactNode;
}

export function CrudActionButtons({ onView, onEdit, onDelete, extra }: CrudActionButtonsProps) {
  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      {extra}
      <button
        type="button"
        onClick={onView}
        className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 inline-flex items-center justify-center transition-colors"
        title="Ver detalhes"
        aria-label="Ver detalhes"
      >
        <span className="material-symbols-outlined text-[18px]">visibility</span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 inline-flex items-center justify-center transition-colors"
        title="Editar"
        aria-label="Editar"
      >
        <span className="material-symbols-outlined text-[18px]">edit</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 inline-flex items-center justify-center transition-colors"
        title="Excluir"
        aria-label="Excluir"
      >
        <span className="material-symbols-outlined text-[18px]">delete</span>
      </button>
    </div>
  );
}

interface DeleteConfirmModalProps {
  open: boolean;
  title?: string;
  itemLabel: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmModal({
  open,
  title = 'Confirmar Exclusão',
  itemLabel,
  loading = false,
  error,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900">
          <span className="material-symbols-outlined text-[22px] text-red-600 shrink-0">warning</span>
          <p className="font-body-md">
            Tem certeza que deseja excluir <strong>{itemLabel}</strong>? Esta ação não poderá ser desfeita.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-error-container text-on-error-container font-label-md font-bold">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 font-label-md font-bold hover:bg-surface-container-low"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-label-md font-bold"
          >
            {loading ? 'Excluindo...' : 'Confirmar Exclusão'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
