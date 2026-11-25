import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  mockCategories,
  mockCustomers,
  mockMovements,
  mockPayables,
  mockProducts,
  mockSales,
  mockShifts,
  mockSuppliers,
  mockUsers,
} from '../data/mockData';
import type {
  CashShift,
  Category,
  CompanyData,
  Customer,
  PayableAccount,
  Product,
  Sale,
  StockMovement,
  Supplier,
  SystemUser,
} from '../types/erp';

export interface AuthUser {
  id: string;
  nome: string;
  email: string;
  perfil: 'ADMIN' | 'GERENTE' | 'OPERADOR';
  permissoes: Record<string, boolean>;
}

interface ErpContextValue {
  loading: boolean;
  dbConnected: boolean;
  currentUser: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshData: () => Promise<void>;
  products: Product[];
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  categories: Category[];
  addCategory: (category: Category) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  customers: Customer[];
  addCustomer: (customer: Customer) => Promise<Customer>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  movements: StockMovement[];
  addMovement: (movement: StockMovement) => Promise<void>;
  payables: PayableAccount[];
  addPayable: (payable: PayableAccount) => Promise<void>;
  updatePayable: (id: string, payable: Partial<PayableAccount>) => Promise<void>;
  deletePayable: (id: string) => Promise<void>;
  payPayable: (id: string) => Promise<void>;
  shifts: CashShift[];
  addShift: (shift: CashShift) => Promise<void>;
  users: SystemUser[];
  addUser: (user: SystemUser & { password?: string; pin?: string; permissions?: Record<string, boolean> }) => Promise<void>;
  updateUser: (
    id: string,
    user: Partial<SystemUser> & { active?: boolean; password?: string; pin?: string; permissions?: Record<string, boolean> }
  ) => Promise<void>;
  deleteUser: (id: string) => Promise<{ deleted?: boolean }>;
  sales: Sale[];
  addSale: (sale: Sale) => void;
  company: CompanyData | null;
  updateCompany: (data: CompanyData) => Promise<CompanyData>;
}

const ErpContext = createContext<ErpContextValue | null>(null);

async function apiRequest<T>(url: string, method: 'POST' | 'PUT' | 'DELETE', payload?: T) {
  const res = await fetch(url, {
    method,
    headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro na requisição (${res.status})`);
  }
  return res.json();
}

const apiPost = <T,>(url: string, payload: T) => apiRequest(url, 'POST', payload);
const apiPut = <T,>(url: string, payload: T) => apiRequest(url, 'PUT', payload);
const apiDelete = (url: string) => apiRequest(url, 'DELETE');

export function ErpProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = sessionStorage.getItem('geleia_tab_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [suppliers, setSuppliers] = useState<Supplier[]>(mockSuppliers);
  const [movements, setMovements] = useState<StockMovement[]>(mockMovements);
  const [payables, setPayables] = useState<PayableAccount[]>(mockPayables);
  const [shifts, setShifts] = useState<CashShift[]>(mockShifts);
  const [users, setUsers] = useState<SystemUser[]>(mockUsers);
  const [sales, setSales] = useState<Sale[]>(mockSales);
  const [company, setCompany] = useState<CompanyData | null>(null);

  const refreshData = useCallback(async (roleOverride?: string) => {
    try {
      const role = roleOverride ?? currentUser?.perfil ?? 'OPERADOR';
      const r = await fetch(`/api/bootstrap?role=${encodeURIComponent(role)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('API indisponível');
      const data = await r.json();
      setProducts(data.products);
      setCategories(data.categories);
      setCustomers(data.customers);
      setSuppliers(data.suppliers);
      setMovements(data.movements);
      setPayables(data.payables);
      setShifts(data.shifts);
      setUsers(data.users);
      setSales(data.sales);
      setCompany(data.company ?? null);
      setDbConnected(true);
    } catch {
      setDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.perfil]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  async function login(email: string, password: string) {
    const user = (await apiPost('/api/auth/login', { email, password })) as AuthUser;
    setCurrentUser(user);
    sessionStorage.setItem('geleia_tab_user', JSON.stringify(user));
    await refreshData(user.perfil);
  }

  function logout() {
    setCurrentUser(null);
    sessionStorage.removeItem('geleia_tab_user');
  }

  const value: ErpContextValue = {
    loading,
    dbConnected,
    currentUser,
    login,
    logout,
    refreshData,
    products,
    addProduct: async (p) => {
      await apiPost('/api/products', p);
      await refreshData();
    },
    updateProduct: async (id, p) => {
      await apiPut(`/api/products/${id}`, p);
      await refreshData();
    },
    deleteProduct: async (id) => {
      await apiDelete(`/api/products/${id}`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await refreshData();
    },
    categories,
    addCategory: async (c) => {
      await apiPost('/api/categories', c);
      await refreshData();
    },
    updateCategory: async (id, c) => {
      await apiPut(`/api/categories/${id}`, c);
      await refreshData();
    },
    deleteCategory: async (id) => {
      await apiDelete(`/api/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      await refreshData();
    },
    customers,
    addCustomer: async (c) => {
      const created = (await apiPost('/api/customers', c)) as Customer;
      await refreshData();
      return created;
    },
    updateCustomer: async (id, c) => {
      await apiPut(`/api/customers/${id}`, c);
      await refreshData();
    },
    deleteCustomer: async (id) => {
      await apiDelete(`/api/customers/${id}`);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      await refreshData();
    },
    suppliers,
    addSupplier: async (s) => {
      await apiPost('/api/suppliers', s);
      await refreshData();
    },
    updateSupplier: async (id, s) => {
      await apiPut(`/api/suppliers/${id}`, s);
      await refreshData();
    },
    deleteSupplier: async (id) => {
      await apiDelete(`/api/suppliers/${id}`);
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      await refreshData();
    },
    movements,
    addMovement: async (m) => {
      await apiPost('/api/movements', m);
      await refreshData();
    },
    payables,
    addPayable: async (p) => {
      await apiPost('/api/payables', p);
      await refreshData();
    },
    updatePayable: async (id, p) => {
      await apiPut(`/api/payables/${id}`, p);
      await refreshData();
    },
    deletePayable: async (id) => {
      await apiDelete(`/api/payables/${id}`);
      setPayables((prev) => prev.filter((p) => p.id !== id));
      await refreshData();
    },
    payPayable: async (id) => {
      await fetch(`/api/payables/${id}/pay`, { method: 'POST' });
      await refreshData();
    },
    shifts,
    addShift: async (s) => {
      await apiPost('/api/shifts/open', s);
      await refreshData();
    },
    users,
    addUser: async (u) => {
      await apiPost('/api/users', u);
      await refreshData();
    },
    updateUser: async (id, u) => {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(u),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao atualizar usuário.');
      }
      setUsers((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                name: u.name ?? item.name,
                email: u.email ?? item.email,
                role: u.role ?? item.role,
                status: u.active === undefined ? item.status : u.active ? 'Ativo' : 'Inativo',
                pin: u.pin ?? item.pin,
                permissions: u.permissions ?? item.permissions,
              }
            : item
        )
      );
      await refreshData();
    },
    deleteUser: async (id) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao excluir usuário.');
      }
      if (body.deleted) {
        setUsers((prev) => prev.filter((item) => item.id !== id));
      } else {
        setUsers((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: 'Inativo' } : item))
        );
      }
      await refreshData();
      return body;
    },
    sales,
    addSale: (s) => {
      setSales((prev) => [s, ...prev]);
    },
    company,
    updateCompany: async (data) => {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Erro ao salvar dados da empresa.');
      }
      setCompany(body);
      await refreshData();
      return body;
    },
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error('useErp deve ser usado dentro de ErpProvider');
  return ctx;
}
