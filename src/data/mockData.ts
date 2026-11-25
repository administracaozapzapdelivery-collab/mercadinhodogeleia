import type {
  Product,
  Category,
  Sale,
  Customer,
  Supplier,
  StockMovement,
  PayableAccount,
  CashShift,
  SystemUser,
} from '../types/erp';

export const mockProducts: Product[] = [
  {
    id: '1',
    sku: 'BEB-001',
    barcode: '7894900011517',
    name: 'Refrigerante Coca-Cola 2L',
    category: 'Bebidas',
    unit: 'un',
    costPrice: 6.8,
    salePrice: 10.5,
    stock: 48,
    minStock: 15,
    expiryDate: '2027-03-15',
    abcClass: 'A',
  },
  {
    id: '2',
    sku: 'MER-014',
    barcode: '7896006716114',
    name: 'Arroz Tipo 1 Camil 5kg',
    category: 'Mercearia',
    unit: 'un',
    costPrice: 21.5,
    salePrice: 29.9,
    stock: 6,
    minStock: 12,
    expiryDate: '2027-08-20',
    abcClass: 'A',
  },
  {
    id: '3',
    sku: 'LAT-008',
    barcode: '7891000315507',
    name: 'Leite Integral Italac 1L',
    category: 'Laticínios',
    unit: 'un',
    costPrice: 3.9,
    salePrice: 5.49,
    stock: 5,
    minStock: 24,
    expiryDate: '2026-11-28',
    abcClass: 'A',
  },
  {
    id: '4',
    sku: 'PAD-003',
    barcode: '7898215150015',
    name: 'Pão Francês Tradicional',
    category: 'Padaria',
    unit: 'kg',
    costPrice: 8.2,
    salePrice: 16.9,
    stock: 18,
    minStock: 10,
    expiryDate: '2026-11-25',
    abcClass: 'A',
  },
  {
    id: '5',
    sku: 'LIM-022',
    barcode: '7891024132104',
    name: 'Detergente Ypê Neutro 500ml',
    category: 'Limpeza',
    unit: 'un',
    costPrice: 1.75,
    salePrice: 2.89,
    stock: 42,
    minStock: 20,
    expiryDate: '2028-01-10',
    abcClass: 'B',
  },
  {
    id: '6',
    sku: 'MER-031',
    barcode: '7896036090244',
    name: 'Óleo de Soja Liza 900ml',
    category: 'Mercearia',
    unit: 'un',
    costPrice: 5.4,
    salePrice: 7.79,
    stock: 4,
    minStock: 15,
    expiryDate: '2027-05-01',
    abcClass: 'A',
  },
  {
    id: '7',
    sku: 'LAT-019',
    barcode: '7891000100103',
    name: 'Iogurte Natural Nestlé 170g',
    category: 'Laticínios',
    unit: 'un',
    costPrice: 2.2,
    salePrice: 3.99,
    stock: 14,
    minStock: 10,
    expiryDate: '2026-11-27',
    abcClass: 'B',
  },
  {
    id: '8',
    sku: 'HOR-005',
    barcode: '2000000000051',
    name: 'Banana Prata Selecionada',
    category: 'Hortifrúti',
    unit: 'kg',
    costPrice: 4.1,
    salePrice: 7.49,
    stock: 22,
    minStock: 10,
    expiryDate: '2026-11-29',
    abcClass: 'B',
  },
];

export const mockCategories: Category[] = [
  { id: '1', name: 'Mercearia', description: 'Grãos, óleos, farinhas e enlatados', productCount: 412, marginTarget: 28 },
  { id: '2', name: 'Bebidas', description: 'Refrigerantes, sucos, águas e cervejas', productCount: 235, marginTarget: 35 },
  { id: '3', name: 'Laticínios', description: 'Leites, queijos, manteigas e iogurtes', productCount: 148, marginTarget: 30 },
  { id: '4', name: 'Padaria', description: 'Pães frescos, bolos e salgados', productCount: 84, marginTarget: 52 },
  { id: '5', name: 'Hortifrúti', description: 'Frutas, verduras e legumes frescos', productCount: 165, marginTarget: 42 },
  { id: '6', name: 'Limpeza', description: 'Detergentes, sabões e desinfetantes', productCount: 196, marginTarget: 34 },
];

export const mockSales: Sale[] = [
  { id: '1', cupom: '#004821', date: '24/11/2026 16:32', customer: 'Consumidor Final', itemsCount: 6, total: 68.4, paymentMethod: 'PIX', status: 'Concluída', operator: 'Maria Clara' },
  { id: '2', cupom: '#004820', date: '24/11/2026 16:18', customer: 'Dona Lúcia (Crediário)', itemsCount: 4, total: 42.9, paymentMethod: 'Crediário', status: 'Concluída', operator: 'Maria Clara' },
  { id: '3', cupom: '#004819', date: '24/11/2026 15:54', customer: 'Consumidor Final', itemsCount: 11, total: 134.2, paymentMethod: 'Crédito', status: 'Concluída', operator: 'Geleia' },
  { id: '4', cupom: '#004818', date: '24/11/2026 15:30', customer: 'Seu Antônio', itemsCount: 2, total: 18.0, paymentMethod: 'Dinheiro', status: 'Concluída', operator: 'Maria Clara' },
  { id: '5', cupom: '#004817', date: '24/11/2026 15:11', customer: 'Consumidor Final', itemsCount: 3, total: 29.7, paymentMethod: 'Débito', status: 'Cancelada', operator: 'Geleia' },
];

export const mockCustomers: Customer[] = [
  { id: '1', name: 'Dona Lúcia Ferreira', phone: '(11) 98412-3301', cpf: '123.456.789-00', creditLimit: 500, currentDebt: 184.5, status: 'Em dia', lastPurchase: '24/11/2026' },
  { id: '2', name: 'Seu Joaquim Almeida', phone: '(11) 97234-8820', cpf: '234.567.890-11', creditLimit: 350, currentDebt: 320.0, status: 'Atenção', lastPurchase: '20/11/2026' },
  { id: '3', name: 'Mariana Costa', phone: '(11) 99102-4419', cpf: '345.678.901-22', creditLimit: 600, currentDebt: 95.0, status: 'Em dia', lastPurchase: '22/11/2026' },
  { id: '4', name: 'Carlos Eduardo Silva', phone: '(11) 96551-1029', cpf: '456.789.012-33', creditLimit: 300, currentDebt: 315.8, status: 'Bloqueado', lastPurchase: '02/11/2026' },
];

export const mockSuppliers: Supplier[] = [
  { id: '1', name: 'Distribuidora Paulista Alimentos', cnpj: '12.345.678/0001-90', contact: 'Roberto Mendes', phone: '(11) 3344-5500', category: 'Mercearia', leadTimeDays: 2 },
  { id: '2', name: 'Bebidas Express Ltda', cnpj: '23.456.789/0001-01', contact: 'Fernanda Lima', phone: '(11) 3889-1200', category: 'Bebidas', leadTimeDays: 1 },
  { id: '3', name: 'Laticínios Vale Verde', cnpj: '34.567.890/0001-12', contact: 'Paulo Sérgio', phone: '(11) 4002-8922', category: 'Laticínios', leadTimeDays: 2 },
  { id: '4', name: 'CEASA Hortifrúti Direto', cnpj: '45.678.901/0001-23', contact: 'Marcos Rocha', phone: '(11) 99811-2233', category: 'Hortifrúti', leadTimeDays: 1 },
];

export const mockMovements: StockMovement[] = [
  { id: '1', date: '24/11/2026 14:10', productName: 'Refrigerante Coca-Cola 2L', type: 'Entrada', quantity: 24, reason: 'NF-e #99412 - Bebidas Express', operator: 'Geleia' },
  { id: '2', date: '24/11/2026 11:30', productName: 'Iogurte Natural Nestlé 170g', type: 'Perda / Avaria', quantity: -2, reason: 'Embalagem violada na prateleira', operator: 'João Pedro' },
  { id: '3', date: '23/11/2026 18:45', productName: 'Banana Prata Selecionada', type: 'Vencimento', quantity: -3, reason: 'Frutas maduras além do ponto de venda', operator: 'João Pedro' },
  { id: '4', date: '23/11/2026 09:15', productName: 'Arroz Tipo 1 Camil 5kg', type: 'Saída', quantity: -10, reason: 'Vendas consolidadas PDV', operator: 'Sistema' },
];

export const mockPayables: PayableAccount[] = [
  { id: '1', description: 'NF-e #99412 — Reposição Bebidas', supplier: 'Bebidas Express Ltda', dueDate: '26/11/2026', amount: 1480.0, status: 'Pendente', category: 'Fornecedores' },
  { id: '2', description: 'Energia Elétrica (Câmara Fria)', supplier: 'Enel Distribuição', dueDate: '25/11/2026', amount: 890.5, status: 'Pendente', category: 'Utilidades' },
  { id: '3', description: 'NF-e #88120 — Laticínios', supplier: 'Laticínios Vale Verde', dueDate: '20/11/2026', amount: 640.0, status: 'Vencido', category: 'Fornecedores' },
  { id: '4', description: 'Aluguel do Ponto Comercial', supplier: 'Imobiliária Central', dueDate: '15/11/2026', amount: 3200.0, status: 'Pago', category: 'Infraestrutura' },
];

export const mockShifts: CashShift[] = [
  { id: '1', register: 'Caixa 01 (Principal)', operator: 'Maria Clara', openedAt: '24/11/2026 07:30', openingBalance: 250.0, totalSales: 4825.9, expectedBalance: 5075.9, status: 'Aberto' },
  { id: '2', register: 'Caixa 01 (Principal)', operator: 'Geleia', openedAt: '23/11/2026 13:00', closedAt: '23/11/2026 21:00', openingBalance: 250.0, totalSales: 5390.4, expectedBalance: 5640.4, status: 'Fechado' },
  { id: '3', register: 'Caixa 02 (Rápido)', operator: 'João Pedro', openedAt: '23/11/2026 08:00', closedAt: '23/11/2026 14:00', openingBalance: 150.0, totalSales: 1940.0, expectedBalance: 2090.0, status: 'Fechado' },
];

export const mockUsers: SystemUser[] = [
  { id: '1', name: 'Geleia (Proprietário)', email: 'geleia@mercadinhodogeleia.com.br', role: 'Administrador', status: 'Ativo', lastAccess: 'Agora' },
  { id: '2', name: 'Maria Clara', email: 'maria.caixa@mercadinhodogeleia.com.br', role: 'Operador de Caixa', status: 'Ativo', lastAccess: 'Hoje, 16:32' },
  { id: '3', name: 'João Pedro', email: 'joao.estoque@mercadinhodogeleia.com.br', role: 'Estoquista', status: 'Ativo', lastAccess: 'Hoje, 14:10' },
  { id: '4', name: 'Carla Souza', email: 'carla.gerente@mercadinhodogeleia.com.br', role: 'Gerente', status: 'Inativo', lastAccess: '18/11/2026' },
];

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
