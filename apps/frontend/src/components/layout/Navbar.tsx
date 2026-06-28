'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { cn } from '@/lib/utils';

import { API_BASE } from '@/lib/api';

function NavAvatar({ src, username, size }: { src?: string | null; username: string; size: number }) {
  if (src) {
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt={username} className="rounded-full object-cover ring-2 ring-primary/20" style={{ width: size, height: size }} />
    );
  }
  return (
    <div
      className="rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary ring-2 ring-primary/20"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {username[0].toUpperCase()}
    </div>
  );
}
import {
  Sun, Moon, LogOut, LayoutDashboard, Swords,
  Trophy, Wallet, Users, Menu, X, ChevronRight, Settings, History,
} from 'lucide-react';

const NAV_LINKS = [
  { href: '/dashboard',   label: 'Dashboard',   icon: LayoutDashboard, color: 'text-blue-500'   },
  { href: '/lobby',       label: 'Play',         icon: Swords,          color: 'text-green-500'  },
  { href: '/leaderboard', label: 'Leaderboard',  icon: Trophy,          color: 'text-yellow-500' },
  { href: '/friends',     label: 'Friends',      icon: Users,           color: 'text-purple-500' },
  { href: '/history',     label: 'History',      icon: History,         color: 'text-orange-400' },
  { href: '/wallet',      label: 'Wallet',       icon: Wallet,          color: 'text-emerald-500'},
  { href: '/settings',    label: 'Settings',     icon: Settings,        color: 'text-slate-400'  },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="font-bold text-xl flex items-center gap-2 shrink-0">
            <span className="text-2xl">♟</span>
            <span><span className="text-primary">Chess</span>Platform</span>
          </Link>

          {/* Desktop nav links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
              {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    pathname.startsWith(href)
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {isAuthenticated && user ? (
              <>
                <NotificationBell />

                {/* Avatar — desktop only (mobile shows in drawer) */}
                <Link
                  href={`/profile/${user.username}`}
                  className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <NavAvatar src={user.avatar} username={user.username} size={32} />
                  <span className="hidden md:block text-sm font-medium">{user.username}</span>
                </Link>

                {/* Logout — desktop only */}
                <button
                  onClick={logout}
                  className="hidden sm:flex p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Hamburger — mobile only */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <div className="hidden sm:flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login">Login</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/register">Sign Up</Link>
                  </Button>
                </div>
                {/* Mobile login/signup */}
                <button
                  onClick={() => setMobileOpen(true)}
                  className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile Drawer ─────────────────────────────────────── */}

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-[280px] bg-background border-l shadow-2xl',
          'flex flex-col transition-transform duration-300 ease-in-out md:hidden',
          mobileOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <Link href="/" className="font-bold text-lg flex items-center gap-2" onClick={() => setMobileOpen(false)}>
            <span className="text-xl">♟</span>
            <span><span className="text-primary">Chess</span>Platform</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User profile section */}
        {isAuthenticated && user && (
          <Link
            href={`/profile/${user.username}`}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-5 py-4 border-b hover:bg-muted/50 transition-colors group"
          >
            <NavAvatar src={user.avatar} username={user.username} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </Link>
        )}

        {/* Nav links */}
        {isAuthenticated ? (
          <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
            {NAV_LINKS.map(({ href, label, icon: Icon, color }, i) => {
              const isActive = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    'group relative overflow-hidden',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                    isActive ? 'bg-primary/20' : 'bg-muted group-hover:bg-muted-foreground/10',
                  )}>
                    <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : color)} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                  <ChevronRight className={cn(
                    'w-4 h-4 transition-all duration-200 shrink-0',
                    isActive ? 'opacity-0' : 'opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5',
                  )} />
                </Link>
              );
            })}
          </nav>
        ) : (
          <div className="flex-1 flex flex-col gap-3 p-5">
            <Button asChild className="w-full">
              <Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/register" onClick={() => setMobileOpen(false)}>Sign Up</Link>
            </Button>
          </div>
        )}

        {/* Drawer footer */}
        {isAuthenticated && (
          <div className="border-t px-3 py-3 space-y-1">
            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-blue-400" />}
              </div>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>

            {/* Logout */}
            <button
              onClick={() => { logout(); setMobileOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <LogOut className="w-4 h-4" />
              </div>
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
