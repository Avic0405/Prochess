'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Swords, Users, Trophy, Wallet, Settings } from 'lucide-react';

const BOTTOM_NAV_ITEMS = [
  { href: '/dashboard',   label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/lobby',       label: 'Play',       icon: Swords },
  { href: '/friends',     label: 'Friends',    icon: Users },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/wallet',      label: 'Wallet',     icon: Wallet },
  { href: '/settings',    label: 'Settings',   icon: Settings },
] as const;

/**
 * Fixed bottom navigation — mobile only (<768px, matches the `md` breakpoint
 * the rest of Navbar already uses to split desktop/tablet from mobile).
 * Replaces the hamburger + slide-out drawer for the 6 primary destinations;
 * desktop/tablet keep the existing top nav row untouched.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) return null;

  const activeIndex = BOTTOM_NAV_ITEMS.findIndex((item) => pathname.startsWith(item.href));

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-[env(safe-area-inset-bottom)] bg-background/80 backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/70 border-t border-white/10 rounded-t-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
    >
      <div className="relative grid grid-cols-6">
        {/* Animated active indicator — a purple glow pill that slides beneath
            the active icon. Pure CSS transform, no measured DOM widths
            needed since every column is an equal 1/6 of the grid. */}
        {activeIndex >= 0 && (
          <div
            className="absolute top-1.5 h-[calc(100%-0.75rem)] w-[calc(100%/6)] rounded-xl bg-primary/10 transition-transform duration-300 ease-out"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
            aria-hidden="true"
          />
        )}

        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 min-h-[56px] py-2',
                'transition-colors duration-200 active:scale-95',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform duration-200',
                  isActive && 'scale-110 [filter:drop-shadow(0_0_6px_currentColor)]',
                )}
              />
              <span className={cn('text-[10px] font-medium leading-none', isActive && 'font-semibold')}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
