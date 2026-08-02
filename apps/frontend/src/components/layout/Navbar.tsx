'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileBottomNav } from './MobileBottomNav';
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
  Trophy, Wallet, Users, Settings, History,
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

  return (
    <>
      <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="font-bold text-xl flex items-center gap-2 shrink-0">
            <span className="text-2xl">♟</span>
            <span><span className="text-primary">ProChess</span>.live</span>
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

                {/* Avatar — desktop only; on mobile it's reachable via Settings → View public profile */}
                <Link
                  href={`/profile/${user.username}`}
                  className="hidden sm:flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <NavAvatar src={user.avatar} username={user.username} size={32} />
                  <span className="hidden md:block text-sm font-medium">{user.username}</span>
                </Link>

                {/* Logout — now shown on all sizes; the mobile drawer that used to hold this is gone */}
                <button
                  onClick={logout}
                  className="flex p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <MobileBottomNav />
    </>
  );
}
