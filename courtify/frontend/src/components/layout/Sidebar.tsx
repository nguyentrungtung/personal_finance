import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  PiggyBank,
  Gem,
  Landmark,
  Calendar,
  BarChart2,
  Settings,
  Zap,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { clsx } from 'clsx';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NAV_LINKS = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/ledger', label: t('nav.ledger'), icon: BookOpen },
    { to: '/investment', label: t('nav.investmentLedger'), icon: TrendingUp },
    { to: '/savings', label: t('nav.savings'), icon: PiggyBank },
    { to: '/metals', label: t('nav.metals'), icon: Gem },
    { to: '/loans', label: t('nav.loans'), icon: Landmark },
    { to: '/calendar', label: t('nav.calendar'), icon: Calendar },
    { to: '/analytics', label: t('nav.analytics'), icon: BarChart2 },
    { to: '/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={clsx(
          'fixed inset-0 bg-black/60 z-20 transition-opacity lg:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={clsx(
          'fixed left-0 top-0 h-screen w-56 bg-surface-card border-r border-surface-border flex flex-col z-30 transition-transform lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Main navigation"
      >
      {/* Logo */}
      <div className="h-14 px-6 flex items-center border-b border-surface-border">
        <span className="text-lg font-bold text-text-primary tracking-tight">COURTIFY</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        <ul role="list" className="space-y-0.5">
          {NAV_LINKS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors',
                    isActive
                      ? 'border-l-2 border-brand-green text-brand-green bg-brand-green/10 pl-[10px]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                  )
                }
                aria-label={label}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User area */}
      <div className="px-4 py-3 border-t border-surface-border">
        {user && (
          <div className="mb-3">
            <div className="flex items-center gap-2">
              {user.avatar_path ? (
                <img
                  src={`${API_BASE}${user.avatar_path}`}
                  alt={user.full_name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-brand-green/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-brand-green">
                    {user.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{user.full_name}</p>
                {user.professional_title && (
                  <p className="text-xs text-text-muted truncate">{user.professional_title}</p>
                )}
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 rounded bg-brand-green/10 border border-brand-green/20 text-xs font-medium text-brand-green hover:bg-brand-green/20 transition-colors"
          aria-label={t('nav.upgradeToPro')}
        >
          <Zap size={12} aria-hidden="true" />
          {t('nav.upgradeToPro')}
        </button>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
          aria-label="Sign out"
        >
          <LogOut size={12} aria-hidden="true" />
          {t('nav.signOut', { defaultValue: 'Sign out' })}
        </button>
      </div>
    </aside>
    </>
  );
}
