import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ErpProvider } from './context/ErpContext';
import { ErpLayout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PdvPage } from './pages/PdvPage';
import { SalesPage } from './pages/SalesPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { MovementsPage } from './pages/MovementsPage';
import { ExpiryAlertsPage } from './pages/ExpiryAlertsPage';
import { CustomersPage } from './pages/CustomersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { PayablesPage } from './pages/PayablesPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { CompanyDataPage } from './pages/CompanyDataPage';
import { LabelsPage } from './pages/LabelsPage';
import { CategoryFormPage } from './pages/forms/CategoryFormPage';
import { ProductFormPage } from './pages/forms/ProductFormPage';
import { CustomerFormPage } from './pages/forms/CustomerFormPage';
import { SupplierFormPage } from './pages/forms/SupplierFormPage';
import { PayableFormPage } from './pages/forms/PayableFormPage';
import { UserFormPage } from './pages/forms/UserFormPage';
import { MovementFormPage } from './pages/forms/MovementFormPage';
import { CashShiftFormPage } from './pages/forms/CashShiftFormPage';

export function App() {
  return (
    <ErpProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/pdv" element={<PdvPage />} />

            <Route element={<ErpLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/vendas-e-cupons" element={<SalesPage />} />

            <Route path="/produtos" element={<ProductsPage />} />
            <Route path="/produtos/novo" element={<ProductFormPage />} />
            <Route path="/etiquetas" element={<LabelsPage />} />

            <Route path="/categorias" element={<CategoriesPage />} />
            <Route path="/categorias/nova" element={<CategoryFormPage />} />

            <Route path="/movimentacoes-e-perdas" element={<MovementsPage />} />
            <Route path="/movimentacoes-e-perdas/nova" element={<MovementFormPage />} />

            <Route path="/alerta-de-validade" element={<ExpiryAlertsPage />} />

            <Route path="/clientes" element={<CustomersPage />} />
            <Route path="/clientes/novo" element={<CustomerFormPage />} />

            <Route path="/fornecedores" element={<SuppliersPage />} />
            <Route path="/fornecedores/novo" element={<SupplierFormPage />} />

            <Route path="/fluxo-de-caixa" element={<CashFlowPage />} />
            <Route path="/fluxo-de-caixa/abertura-fechamento" element={<CashShiftFormPage />} />

            <Route path="/contas-a-pagar" element={<PayablesPage />} />
            <Route path="/contas-a-pagar/nova" element={<PayableFormPage />} />

            <Route path="/relatorios" element={<ReportsPage />} />

            <Route path="/usuarios-e-permissoes" element={<UsersPage />} />
            <Route path="/usuarios-e-permissoes/novo" element={<UserFormPage />} />

            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/dados-da-empresa" element={<CompanyDataPage />} />
          </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ErpProvider>
  );
}

export default App;
