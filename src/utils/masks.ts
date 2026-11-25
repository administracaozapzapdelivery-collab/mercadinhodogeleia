// ==============================================================================
// MÁSCARAS E VALIDADORES — Mercadinho do Geleia
// ==============================================================================

// --- CPF ---
/** Aplica máscara: 000.000.000-00 */
export function maskCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Valida CPF (algoritmo oficial, aceita sem máscara) */
export function validateCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, '');
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === Number(cpf[10]);
}

// --- CNPJ ---
/** Aplica máscara: 00.000.000/0001-00 */
export function maskCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12)
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Valida CNPJ (algoritmo oficial, aceita sem máscara) */
export function validateCnpj(value: string): boolean {
  const cnpj = value.replace(/\D/g, '');
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calcDigit = (num: string, length: number) => {
    let sum = 0;
    let pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += Number(num[length - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  if (calcDigit(cnpj, 12) !== Number(cnpj[12])) return false;
  if (calcDigit(cnpj, 13) !== Number(cnpj[13])) return false;
  return true;
}

// --- TELEFONE ---
/** Aplica máscara: (00) 90000-0000 ou (00) 0000-0000 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  // 11 dígitos = celular com 9
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Valida telefone: aceita (XX) XXXX-XXXX ou (XX) 9XXXX-XXXX */
export function validatePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 11;
}

// --- CPF/CNPJ AUTOMÁTICO ---
/** Detecta tipo e aplica máscara automaticamente */
export function maskCpfOrCnpj(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 11) return maskCpf(value);
  return maskCnpj(value);
}

/** Detecta tipo e valida automaticamente */
export function validateCpfOrCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return validateCpf(value);
  if (digits.length === 14) return validateCnpj(value);
  return false;
}

/** Retorna mensagem de erro ou '' se válido */
export function cpfError(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return ''; // opcional
  if (digits.length !== 11) return 'CPF deve ter 11 dígitos.';
  if (!validateCpf(value)) return 'CPF inválido.';
  return '';
}

export function cnpjError(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return ''; // opcional
  if (digits.length !== 14) return 'CNPJ deve ter 14 dígitos.';
  if (!validateCnpj(value)) return 'CNPJ inválido.';
  return '';
}

export function phoneError(value: string, required = false): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) return required ? 'Telefone obrigatório.' : '';
  if (!validatePhone(value)) return 'Telefone inválido (mínimo 10 dígitos).';
  return '';
}
