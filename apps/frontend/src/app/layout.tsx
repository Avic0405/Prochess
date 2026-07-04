import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Toaster } from '@/components/ui/Toaster';
import '@/styles/globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://prochess.live';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#6D28D9',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  applicationName: 'ProChess.live',
  title: {
    default: 'ProChess.live — Play Chess. Win Real Money.',
    template: '%s | ProChess.live',
  },
  description:
    'Play real-money chess online. Free and paid matches with live matchmaking, ELO ratings, and instant payouts. Join ProChess.live today.',
  keywords: [
    'chess', 'online chess', 'play chess for money', 'paid chess',
    'chess platform', 'real money chess', 'chess betting', 'ProChess',
    'multiplayer chess', 'chess ELO', 'chess tournaments',
  ],
  authors: [{ name: 'ProChess.live', url: BASE_URL }],
  creator: 'ProChess.live',
  publisher: 'ProChess.live',

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },

  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/favicon-64x64.png', sizes: '64x64', type: 'image/png' },
      { url: '/icons/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icons/maskable-icon-512.png', color: '#6D28D9' },
    ],
  },

  manifest: '/site.webmanifest',

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'ProChess.live',
    title: 'ProChess.live — Play Chess. Win Real Money.',
    description:
      'Real-money chess with live matchmaking, ELO ratings, and instant payouts. Play free or stake money. Join now.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'ProChess.live — Play Chess. Win Real Money.',
        type: 'image/png',
      },
    ],
  },

  twitter: {
    card: 'summary_large_image',
    site: '@prochesslive',
    creator: '@prochesslive',
    title: 'ProChess.live — Play Chess. Win Real Money.',
    description:
      'Real-money chess with live matchmaking, ELO ratings, and instant payouts.',
    images: ['/og-image.png'],
  },

  alternates: {
    canonical: BASE_URL,
  },

  other: {
    'msapplication-TileColor': '#6D28D9',
    'msapplication-config': '/browserconfig.xml',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'ProChess',
    'format-detection': 'telephone=no',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <QueryProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
