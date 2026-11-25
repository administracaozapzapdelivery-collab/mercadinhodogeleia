export type PaymentMethod = 'PIX' | 'Débito' | 'Crédito' | 'Dinheiro' | 'Crediário';

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  unit: 'un' | 'kg' | 'L' | 'cx';
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
  abcClass: 'A' | 'B' | 'C';
  adminOnly?: boolean;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  productCount: number;
  marginTarget: number;
}

export interface Sale {
  id: string;
  cupom: string;
  date: string;
  customer: string;
  itemsCount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: 'Concluída' | 'Cancelada';
  operator: string;
  authorizedBy?: string | null;
  authorizationReason?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  cpf: string;
  creditLimit: number;
  currentDebt: number;
  status: 'Em dia' | 'Atenção' | 'Bloqueado';
  lastPurchase: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  contact: string;
  phone: string;
  category: string;
  leadTimeDays: number;
}

export interface StockMovement {
  id: string;
  date: string;
  productName: string;
  type: 'Entrada' | 'Saída' | 'Perda / Avaria' | 'Vencimento';
  quantity: number;
  reason: string;
  operator: string;
}

export interface PayableAccount {
  id: string;
  description: string;
  supplier: string;
  dueDate: string;
  amount: number;
  status: 'Pago' | 'Pendente' | 'Vencido';
  category: string;
}

export interface CashShift {
  id: string;
  register: string;
  operator: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  totalSales: number;
  expectedBalance: number;
  status: 'Aberto' | 'Fechado';
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Gerente' | 'Operador de Caixa' | 'Estoquista';
  status: 'Ativo' | 'Inativo';
  lastAccess: string;
  pin?: string;
  permissions?: Record<string, boolean>;
}

export interface CompanyData {
  id?: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  inscricao_estadual: string;
  nome_proprietario: string;
  cpf_proprietario: string;
  telefone: string;
  whatsapp: string;
  email: string;
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  mensagem_cupom: string;
}
