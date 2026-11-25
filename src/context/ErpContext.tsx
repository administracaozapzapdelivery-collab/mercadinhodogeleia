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
  deleteProduct: (id: string) => Promise<void>;
  categories: Category[];
  addCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  customers: Customer[];
  addCustomer: (customer: Customer) => Promise<Customer>;
  suppliers: Supplier[];
  addSupplier: (supplier: Supplier) => Promise<void>;
  movements: StockMovement[];
  addMovement: (movement: StockMovement) => Promise<void>;
  payables: PayableAccount[];
  addPayable: (payable: PayableAccount) => Promise<void>;
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

async function apiPost<T>(url: string, payload: T) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro na requisição (${res.status})`);
  }
  return res.json();
}

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
    deleteProduct: async (id) => {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      await refreshData();
    },
    categories,
    addCategory: async (c) => {
      await apiPost('/api/categories', c);
      await refreshData();
    },
    deleteCategory: async (id) => {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao excluir categoria.');
      }
      setCategories((prev) => prev.filter((c) => c.id !== id));
      await refreshData();
    },
    customers,
    addCustomer: async (c) => {
      const created = (await apiPost('/api/customers', c)) as Customer;
      await refreshData();
      return created;
    },
    suppliers,
    addSupplier: async (s) => {
      await apiPost('/api/suppliers', s);
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
