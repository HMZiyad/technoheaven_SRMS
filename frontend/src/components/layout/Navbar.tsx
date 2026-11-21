import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  Layers,
  BarChart3,
  PlusCircle,
  ListFilter,
  User as UserIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocket } from '../../hooks/useSocket';
import { RoleBadge } from '../common/Badge';
import { NotificationBell } from './NotificationBell';
import { Role } from '../../types';
import { cn } from '../../utils/cn';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuthStore();
  const { status: socketStatus } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isSupervisorOrAdmin =
    user?.role === Role.SUPERVISOR || user?.role === Role.ADMIN;

  const navLinks = [
    { label: 'Requests', path: '/requests', icon: ListFilter },
    { label: 'New Request', path: '/requests/new', icon: PlusCircle },
    ...(isSupervisorOrAdmin
      ? [{ label: 'Analytics', path: '/analytics', icon: BarChart3 }]
      : []),
  ];

  const getConnectionPill = () => {
    switch (socketStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        );
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
            Reconnecting
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Offline
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          {/* Left section: Logo & App Title */}
          <div className="flex items-center gap-7">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="h-8 w-8 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-xs group-hover:bg-primary-700 transition">
                <Layers className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base text-slate-900 tracking-tight leading-none group-hover:text-primary-600 transition">
                  SRMS
                </span>
                <span className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                  Real-Time Services
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            {user && (
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition',
                        isActive
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Right section: Status, User, Logout */}
          <div className="hidden md:flex items-center gap-4">
            {/* Live Socket Status Pill */}
            {user && getConnectionPill()}

            {user ? (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <NotificationBell />

                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-semibold text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-800 leading-tight">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight">
                      {user.email}
                    </span>
                  </div>
                </div>

                <RoleBadge role={user.role} />

                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-3.5 py-2 rounded-lg shadow-sm transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            {user && <NotificationBell />}
            {user && getConnectionPill()}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              aria-label="Open main menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-3 shadow-lg">
          {user && (
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{user.name}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
              </div>
              <RoleBadge role={user.role} />
            </div>
          )}

          {user && (
            <div className="space-y-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.path;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}

          {user ? (
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-md transition"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Navbar;
