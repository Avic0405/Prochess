import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 flex justify-center">
        <Link href="/" className="font-bold text-xl flex items-center gap-2">
          ♟ <span className="text-primary">ProChess</span>.live
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
