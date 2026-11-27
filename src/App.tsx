import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErpProvider } from './context/ErpContext';
import { ErpLayout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

function lazyNamed<T extends Record<string, ComponentType>>(
  loader: () => Promise<T>,
  name: keyof T
) {
  return lazy(async () => ({ default: (await loader())[name] }));
}

const LoginPage = lazyNamed(() => import('./pages/LoginPage'), 'LoginPage');
const DashboardPage = lazyNamed(() => import('./pages/DashboardPage'), 'DashboardPage');
const PdvPage = lazyNamed(() => import('./pages/PdvPage'), 'PdvPage');
const SalesPage = lazyNamed(() => import('./pages/SalesPage'), 'SalesPage');
const ComandasPage = lazyNamed(() => import('./pages/ComandasPage'), 'ComandasPage');
const ProductsPage = lazyNamed(() => import('./pages/ProductsPage'), 'ProductsPage');
const CategoriesPage = lazyNamed(() => import('./pages/CategoriesPage'), 'CategoriesPage');
const MovementsPage = lazyNamed(() => import('./pages/MovementsPage'), 'MovementsPage');
const ExpiryAlertsPage = lazyNamed(() => import('./pages/ExpiryAlertsPage'), 'ExpiryAlertsPage');
const CustomersPage = lazyNamed(() => import('./pages/CustomersPage'), 'CustomersPage');
const SuppliersPage = lazyNamed(() => import('./pages/SuppliersPage'), 'SuppliersPage');
const CashFlowPage = lazyNamed(() => import('./pages/CashFlowPage'), 'CashFlowPage');
const PayablesPage = lazyNamed(() => import('./pages/PayablesPage'), 'PayablesPage');
const ReportsPage = lazyNamed(() => import('./pages/ReportsPage'), 'ReportsPage');
const UsersPage = lazyNamed(() => import('./pages/UsersPage'), 'UsersPage');
const SettingsPage = lazyNamed(() => import('./pages/SettingsPage'), 'SettingsPage');
const CompanyDataPage = lazyNamed(() => import('./pages/CompanyDataPage'), 'CompanyDataPage');
const LabelsPage = lazyNamed(() => import('./pages/LabelsPage'), 'LabelsPage');
const CategoryFormPage = lazyNamed(() => import('./pages/forms/CategoryFormPage'), 'CategoryFormPage');
const ProductFormPage = lazyNamed(() => import('./pages/forms/ProductFormPage'), 'ProductFormPage');
const CustomerFormPage = lazyNamed(() => import('./pages/forms/CustomerFormPage'), 'CustomerFormPage');
const SupplierFormPage = lazyNamed(() => import('./pages/forms/SupplierFormPage'), 'SupplierFormPage');
const PayableFormPage = lazyNamed(() => import('./pages/forms/PayableFormPage'), 'PayableFormPage');
const UserFormPage = lazyNamed(() => import('./pages/forms/UserFormPage'), 'UserFormPage');
const MovementFormPage = lazyNamed(() => import('./pages/forms/MovementFormPage'), 'MovementFormPage');
const CashShiftFormPage = lazyNamed(() => import('./pages/forms/CashShiftFormPage'), 'CashShiftFormPage');

export function App() {
  return (
    <ErpProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-on-surface-variant font-label-lg">
              Carregando módulo...
            </div>
          }
        >
          <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/pdv" element={<PdvPage />} />

            <Route element={<ErpLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/vendas-e-cupons" element={<SalesPage />} />
            <Route path="/comandas" element={<ComandasPage />} />

            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/produtos/novo" element={<ProductFormPage />} />
            <Route path="/produtos/:id/editar" element={<ProductFormPage />} />
            <Route path="/etiquetas" element={<LabelsPage />} />

            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/categorias/nova" element={<CategoryFormPage />} />
            <Route path="/categorias/:id/editar" element={<CategoryFormPage />} />

            <Route path="/movimentacoes-e-perdas" element={<MovementsPage />} />
            <Route path="/movimentacoes-e-perdas/nova" element={<MovementFormPage />} />

            <Route path="/alerta-de-validade" element={<ExpiryAlertsPage />} />

            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/clientes/novo" element={<CustomerFormPage />} />
            <Route path="/clientes/:id/editar" element={<CustomerFormPage />} />

            <Route path="/fornecedores" element={<SuppliersPage />} />
            <Route path="/fornecedores/novo" element={<SupplierFormPage />} />
            <Route path="/fornecedores/:id/editar" element={<SupplierFormPage />} />

            <Route path="/fluxo-de-caixa" element={<CashFlowPage />} />
            <Route path="/fluxo-de-caixa/abertura-fechamento" element={<CashShiftFormPage />} />

            <Route path="/contas-a-pagar" element={<PayablesPage />} />
            <Route path="/contas-a-pagar/nova" element={<PayableFormPage />} />
            <Route path="/contas-a-pagar/:id/editar" element={<PayableFormPage />} />

            <Route path="/relatorios" element={<ReportsPage />} />

            <Route path="/usuarios-e-permissoes" element={<UsersPage />} />
            <Route path="/usuarios-e-permissoes/novo" element={<UserFormPage />} />

            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/dados-da-empresa" element={<CompanyDataPage />} />
          </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ErpProvider>
  );
}

export default App;
