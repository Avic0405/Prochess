import { Navbar } from '@/components/layout/Navbar';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* pb-24 clears the fixed mobile bottom nav; md:pb-0 keeps desktop/tablet exactly as before */}
      <main className="pb-24 md:pb-0">{children}</main>
    </div>
  );
}
