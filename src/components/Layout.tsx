import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useErp } from '../context/ErpContext';

interface AppNotification {
  id: string;
  tipo: string;
  severidade: 'CRITICA' | 'ALERTA' | 'INFO';
  titulo: string;
  mensagem: string;
  link: string;
  lida: boolean;
  createdAt: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: string;
  badgeTone?: 'info' | 'danger';
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
      { label: 'Vendas e Cupons', path: '/vendas-e-cupons', icon: 'receipt_long' },
      { label: 'Comandas', path: '/comandas', icon: 'restaurant' },
    ],
  },
  {
    title: 'Catálogo e Estoque',
    items: [
      { label: 'Produtos', path: '/produtos', icon: 'inventory_2', badgeTone: 'info' },
      { label: 'Categorias', path: '/categorias', icon: 'category' },
      { label: 'Movimentações e Perdas', path: '/movimentacoes-e-perdas', icon: 'swap_horiz' },
      { label: 'Alerta de Validade', path: '/alerta-de-validade', icon: 'event_busy', badgeTone: 'danger' },
      { label: 'Gerador de Etiquetas', path: '/etiquetas', icon: 'qr_code_2' },
    ],
  },
  {
    title: 'Pessoas e Parceiros',
    items: [
      { label: 'Clientes (Crediário)', path: '/clientes', icon: 'group' },
      { label: 'Fornecedores', path: '/fornecedores', icon: 'local_shipping' },
    ],
  },
  {
    title: 'Financeiro e Gestão',
    items: [
      { label: 'Fluxo de Caixa', path: '/fluxo-de-caixa', icon: 'account_balance_wallet' },
      { label: 'Contas a Pagar', path: '/contas-a-pagar', icon: 'payments' },
      { label: 'Relatórios (Curva ABC)', path: '/relatorios', icon: 'analytics' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Usuários e Permissões', path: '/usuarios-e-permissoes', icon: 'admin_panel_settings' },
      { label: 'Configurações', path: '/configuracoes', icon: 'settings' },
    ],
  },
];

const routeTitles: Record<string, string> = {
  '/dashboard': 'Visão Geral — Mercadinho do Geleia',
  '/vendas-e-cupons': 'Vendas e Cupons Fiscais',
  '/comandas': 'Comandas e Mesas',
  '/produtos': 'Produtos e Estoque',
  '/produtos/novo': 'Cadastrar Novo Produto',
  '/categorias': 'Categorias de Produtos',
  '/categorias/nova': 'Cadastrar Nova Categoria',
  '/movimentacoes-e-perdas': 'Movimentações e Perdas',
  '/movimentacoes-e-perdas/nova': 'Nova Movimentação de Estoque',
  '/alerta-de-validade': 'Alerta de Validade',
  '/etiquetas': 'Gerador de Etiquetas',
  '/clientes': 'Clientes e Controle de Crediário',
  '/clientes/novo': 'Cadastrar Novo Cliente',
  '/fornecedores': 'Fornecedores e Parceiros',
  '/fornecedores/novo': 'Cadastrar Novo Fornecedor',
  '/fluxo-de-caixa': 'Fluxo de Caixa e Turnos',
  '/fluxo-de-caixa/abertura-fechamento': 'Abertura e Fechamento de Caixa',
  '/contas-a-pagar': 'Contas a Pagar',
  '/contas-a-pagar/nova': 'Nova Conta a Pagar',
  '/relatorios': 'Relatórios e Curva ABC',
  '/usuarios-e-permissoes': 'Usuários e Permissões',
  '/usuarios-e-permissoes/novo': 'Cadastrar Usuário',
  '/configuracoes': 'Configurações do Sistema',
  '/dados-da-empresa': 'Dados da Empresa',
};

export function ErpLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, company, products, logout } = useErp();

  const fetchNotifications = useCallback(async () => {
    try {
      const role = encodeURIComponent(currentUser?.perfil ?? '');
      const res = await fetch(`/api/notifications?role=${role}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unreadCount ?? 0));
    } catch {
      // silencia falha transitória de rede
    }
  }, [currentUser?.perfil]);

  useEffect(() => {
    void fetchNotifications();
    fetch('/api/products/expiring')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setExpiringCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setExpiringCount(0));
    const timer = setInterval(() => {
      void fetchNotifications();
    }, 60000);
    return () => clearInterval(timer);
  }, [fetchNotifications, location.pathname, products.length]);

  async function markNotificationRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lida: true }),
    });
  }

  async function markAllNotificationsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, lida: true })));
    setUnreadCount(0);
    const role = encodeURIComponent(currentUser?.perfil ?? '');
    await fetch(`/api/notifications/read-all?role=${role}`, { method: 'PATCH' });
  }

  async function deleteNotification(id: string) {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.lida) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
  }

  async function clearReadNotifications() {
    setNotifications((prev) => prev.filter((n) => !n.lida));
    const role = encodeURIComponent(currentUser?.perfil ?? '');
    await fetch(`/api/notifications?role=${role}`, { method: 'DELETE' });
  }

  const headerTitle = routeTitles[location.pathname] ?? `${company?.nome_fantasia || 'Mercadinho do Geleia'} — ERP`;

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between bg-primary-container text-on-primary select-none">
      <div className="flex flex-col min-h-0">
        <div className="p-space-lg flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-8 h-8 rounded-lg bg-tertiary-fixed flex items-center justify-center text-tertiary font-extrabold text-sm">
              MG
            </div>
            <span className="font-headline-sm text-headline-sm font-bold tracking-tight text-on-primary">
              Geleia ERP
            </span>
          </div>
          <span className="bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm px-2 py-0.5 rounded-full uppercase">
            Gestão &amp; PDV
          </span>
        </div>

        <div className="px-space-lg pb-space-md">
          <a
            href="/pdv"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center justify-center gap-space-sm py-3 px-space-md rounded-lg bg-tertiary-fixed-dim hover:bg-tertiary-fixed text-tertiary font-label-lg text-label-lg font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-[20px]">point_of_sale</span>
            <span>Abrir Frente de Caixa</span>
          </a>
        </div>

        <div className="overflow-y-auto flex-1 px-space-md space-y-space-md pb-space-lg">
          {navGroups.map((group) => (
            <nav key={group.title} className="space-y-space-xs">
              <span className="font-label-sm text-label-sm tracking-wider uppercase text-on-primary-container/80 px-space-sm py-1 block">
                {group.title}
              </span>
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-space-sm py-2 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white font-bold border-l-4 border-tertiary-fixed'
                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    <span className="font-label-md text-label-md">{item.label}</span>
                  </div>
                  {(() => {
                    const dynamicBadge =
                      item.path === '/produtos'
                        ? products.length > 0
                          ? String(products.length)
                          : undefined
                        : item.path === '/alerta-de-validade'
                          ? expiringCount > 0
                            ? String(expiringCount)
                            : undefined
                          : item.badge;
                    if (!dynamicBadge) return null;
                    return (
                      <span
                        className={`font-label-sm text-label-sm px-1.5 py-0.5 font-bold ${
                          item.badgeTone === 'danger'
                            ? 'bg-error text-on-error rounded-full'
                            : 'bg-secondary-container text-on-secondary-container rounded'
                        }`}
                      >
                        {dynamicBadge}
                      </span>
                    );
                  })()}
                </NavLink>
              ))}
            </nav>
          ))}
        </div>
      </div>

      <div className="p-space-md border-t border-white/10 bg-primary-container">
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center justify-center gap-space-sm py-2.5 px-space-md rounded-lg text-white/90 hover:text-white bg-white/10 hover:bg-error/30 border border-white/10 font-label-md text-label-md font-semibold transition-all active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Sair do Sistema</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-0 h-full w-[260px] z-50 shadow-2xl">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[270px] max-w-[85vw] h-full z-10 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="lg:pl-[260px]">
        <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-[70px] bg-surface-container-lowest border-b border-surface-container shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-lg lg:px-space-xl">
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-primary hover:bg-surface-container transition-colors"
              aria-label="Abrir menu"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm font-bold text-primary truncate max-w-[210px] sm:max-w-none">
                {headerTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm sm:gap-space-md">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low border border-secondary-container">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary-fixed opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary-fixed-dim" />
              </span>
              <span className="font-label-md text-label-md font-bold text-on-surface">
                Caixa 01: Aberto
              </span>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  const next = !notifOpen;
                  setNotifOpen(next);
                  setUserMenuOpen(false);
                  if (next) void fetchNotifications();
                }}
                className="relative p-2 text-on-surface-variant hover:text-on-surface rounded-full hover:bg-surface-container transition-colors"
                title="Notificações"
                aria-label="Abrir notificações"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-xl z-50 flex flex-col max-h-[480px]">
                    <div className="px-4 py-3 border-b border-surface-container flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-headline-sm font-bold text-primary text-sm">
                          Notificações
                        </span>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-error/10 text-error font-label-sm font-bold">
                            {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={() => void markAllNotificationsRead()}
                            className="font-label-sm font-bold text-secondary hover:underline"
                            title="Marcar todas como lidas"
                          >
                            Ler todas
                          </button>
                        )}
                        {notifications.some((n) => n.lida) && (
                          <button
                            type="button"
                            onClick={() => void clearReadNotifications()}
                            className="font-label-sm font-bold text-on-surface-variant hover:text-error"
                            title="Excluir todas as notificações já lidas"
                          >
                            Limpar lidas
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-y-auto divide-y divide-surface-container flex-1">
                      {notifications.length === 0 ? (
                        <div className="py-10 px-4 text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-[36px] text-tertiary-fixed-dim mb-2">
                            notifications_off
                          </span>
                          <p className="font-label-md font-bold text-on-surface">
                            Tudo em dia!
                          </p>
                          <p className="font-body-sm mt-0.5">
                            Nenhuma notificação pendente no momento.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const icon =
                            n.tipo === 'VALIDADE'
                              ? 'event_busy'
                              : n.tipo === 'ESTOQUE'
                                ? 'inventory_2'
                                : n.tipo === 'CONTA_PAGAR'
                                  ? 'payments'
                                  : n.tipo === 'CREDIARIO'
                                    ? 'group'
                                    : 'point_of_sale';
                          const toneClass =
                            n.severidade === 'CRITICA'
                              ? 'text-error bg-error/10'
                              : n.severidade === 'ALERTA'
                                ? 'text-amber-600 bg-amber-50'
                                : 'text-secondary bg-secondary/10';

                          return (
                            <div
                              key={n.id}
                              className={`p-3 flex items-start gap-3 transition-colors ${
                                n.lida
                                  ? 'bg-surface-container-lowest opacity-70'
                                  : 'bg-primary/[0.03]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (!n.lida) void markNotificationRead(n.id);
                                  setNotifOpen(false);
                                  navigate(n.link);
                                }}
                                className="flex items-start gap-3 flex-1 min-w-0 text-left group"
                              >
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${toneClass}`}>
                                  <span className="material-symbols-outlined text-[18px]">{icon}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    {!n.lida && (
                                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                                    )}
                                    <p className="font-label-md font-bold text-on-surface group-hover:text-primary truncate">
                                      {n.titulo}
                                    </p>
                                  </div>
                                  <p className="font-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                                    {n.mensagem}
                                  </p>
                                  <span className="font-label-sm text-[10px] text-on-surface-variant/80 mt-1 block">
                                    {n.createdAt}
                                  </span>
                                </div>
                              </button>

                              <div className="flex flex-col gap-1 shrink-0">
                                {!n.lida && (
                                  <button
                                    type="button"
                                    onClick={() => void markNotificationRead(n.id)}
                                    className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                                    title="Marcar como lida"
                                    aria-label="Marcar como lida"
                                  >
                                    <span className="material-symbols-outlined text-[17px]">done</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void deleteNotification(n.id)}
                                  className="p-1 rounded-md text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                  title="Excluir notificação"
                                  aria-label="Excluir notificação"
                                >
                                  <span className="material-symbols-outlined text-[17px]">delete</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative pl-2 border-l border-surface-container">
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-surface-container-low transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="font-label-md text-label-md text-on-surface font-bold">
                    {currentUser?.nome ?? 'Usuário'}
                  </span>
                  <span className="font-label-sm text-[10px] text-secondary uppercase">
                    {currentUser?.perfil ?? 'OPERADOR'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  {userMenuOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-60 bg-surface-container-lowest rounded-xl border border-slate-200 shadow-xl py-2 z-50">
                    <div className="px-4 py-2 border-b border-surface-container">
                      <p className="font-label-sm text-on-surface-variant uppercase">
                        {company?.nome_fantasia || 'Mercadinho do Geleia'}
                      </p>
                      <p className="font-body-sm text-on-surface font-semibold truncate">
                        {currentUser?.email}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/dados-da-empresa');
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-surface-container-low font-label-md font-bold text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">storefront</span>
                      <span>Dados da Empresa</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/configuracoes');
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-surface-container-low font-label-md text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      <span>Configurações</span>
                    </button>

                    <div className="my-1 border-t border-surface-container" />

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2.5 hover:bg-error-container/50 font-label-md font-semibold text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      <span>Sair do Sistema</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="w-full pt-[70px] bg-surface min-h-screen">
          <div className="flex flex-col w-full p-space-lg lg:p-space-xl gap-space-xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
