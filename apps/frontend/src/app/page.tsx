import Link from 'next/link';
import { Button } from '@/components/ui/Button';

/* ─── Data ─────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: '♟',
    title: 'Real-Time Gameplay',
    desc: 'WebSocket-powered moves, live chat, and spectator mode. Play Bullet, Blitz, Rapid, or Classical — any time control you like.',
  },
  {
    icon: '💰',
    title: 'Paid Matches',
    desc: 'Stake real money with secure escrow. Winner takes 90%. Supports USD via Stripe and INR via Razorpay.',
  },
  {
    icon: '📊',
    title: 'ELO Rating System',
    desc: 'Track your growth with a live ELO rating, a personal rating-history chart, and a global leaderboard.',
  },
  {
    icon: '🤝',
    title: 'Social Features',
    desc: "Add friends, see who's online, and invite them to a custom game at any stake level you agree on.",
  },
  {
    icon: '🔒',
    title: 'Secure Payments',
    desc: 'PCI-compliant processing through trusted gateways. Every rupee or dollar sits in escrow until the game ends.',
  },
  {
    icon: '🕵️',
    title: 'Game Review',
    desc: 'Step through every move after the game, download the PGN, and study exactly where the match turned.',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Create your account',
    desc: 'Sign up in seconds — no credit card needed. Your ELO starts at 1 200 and climbs as you win.',
  },
  {
    num: '02',
    title: 'Choose your match',
    desc: 'Pick a free rated game or deposit funds and enter a paid match. Set the time control and stake you want.',
  },
  {
    num: '03',
    title: 'Play & get paid',
    desc: "Win the game, collect 90 % of the pot. Withdraw to your bank via Stripe or Razorpay instantly.",
  },
];

const STATS = [
  { value: '10 000+', label: 'Players' },
  { value: '250 000+', label: 'Games Played' },
  { value: '$500 000+', label: 'Paid Out' },
  { value: '99.9 %', label: 'Uptime' },
];

/* ─── Page ──────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
            <span className="text-2xl leading-none">♟</span>
            <span><span className="text-primary">Chess</span>Platform</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" size="sm" className="text-sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="text-sm">
              <Link href="/register">Sign up free</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 sm:px-6 text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-background to-background pointer-events-none" />
        {/* Decorative chess grid (top-right) */}
        <div
          aria-hidden
          className="absolute top-0 right-0 w-[280px] h-[280px] sm:w-[400px] sm:h-[400px] opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-conic-gradient(hsl(var(--foreground)) 0% 25%, transparent 0% 50%)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Bottom-left decor */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'repeating-conic-gradient(hsl(var(--foreground)) 0% 25%, transparent 0% 50%)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6 sm:space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-xs sm:text-sm text-primary font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
            Real-time Chess · Free &amp; Paid Matches
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
            Play Chess.{' '}
            <span className="text-primary block sm:inline">Win Real Money.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Challenge players worldwide in free rated games, or stake real money in paid
            matches with secure escrow. ELO-rated, lag-free, globally competitive.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 justify-center">
            <Button asChild size="lg" className="text-base sm:text-lg px-6 sm:px-10 h-12 sm:h-14 font-semibold">
              <Link href="/register">Get Started — It&apos;s Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base sm:text-lg px-6 sm:px-10 h-12 sm:h-14">
              <Link href="/login">Log In</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            No credit card required · Start playing in under 60 seconds
          </p>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <section className="border-y border-border bg-muted/30 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-2xl sm:text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-14 space-y-3">
            <p className="text-xs sm:text-sm uppercase tracking-widest text-primary font-semibold">
              Platform features
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              Everything you need to compete
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              From your first free game to high-stakes paid matches — we&apos;ve built every tool a serious chess player needs.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-5 sm:p-6 rounded-2xl border bg-card hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
              >
                <div className="text-3xl sm:text-4xl mb-3 sm:mb-4 leading-none">{f.icon}</div>
                <h3 className="text-base sm:text-lg font-semibold mb-1.5 sm:mb-2 group-hover:text-primary transition-colors">
                  {f.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14 space-y-3">
            <p className="text-xs sm:text-sm uppercase tracking-widest text-primary font-semibold">
              How it works
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold">
              Up and running in 3 steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative">
            {/* Connector line (desktop) */}
            <div
              aria-hidden
              className="hidden md:block absolute top-8 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px bg-border"
            />

            {STEPS.map((step) => (
              <div key={step.num} className="flex flex-col items-center text-center gap-3 sm:gap-4">
                <div className="relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
                  <span className="text-lg sm:text-xl font-extrabold text-primary">{step.num}</span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold text-base sm:text-lg">{step.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center space-y-5 sm:space-y-7">
          <div className="text-4xl sm:text-5xl">♟</div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-snug">
            Ready to test your game?
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
            Join thousands of players already competing on ProChess.live. Create a free
            account and make your first move in under a minute.
          </p>
          <div className="flex flex-col xs:flex-row gap-3 sm:gap-4 justify-center">
            <Button asChild size="lg" className="text-base sm:text-lg px-8 sm:px-12 h-12 sm:h-14 font-semibold">
              <Link href="/register">Create Free Account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base sm:text-lg px-8 sm:px-12 h-12 sm:h-14">
              <Link href="/leaderboard">View Leaderboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/20 py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <span className="text-xl leading-none">♟</span>
            <span><span className="text-primary">ProChess</span>.live</span>
          </div>
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            © {new Date().getFullYear()} ProChess.live. All rights reserved.
          </p>
          <div className="flex items-center gap-4 sm:gap-6 text-xs text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Login</Link>
            <Link href="/register" className="hover:text-foreground transition-colors">Sign Up</Link>
            <Link href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
          </div>
        </div>
      </footer>

    </main>
  );
}
