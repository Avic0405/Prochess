'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';
import { trackGoogleLogin, trackLogin } from '@/lib/analytics/events';

function OAuthSuccessInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const error = searchParams.get('error');
    const provider = searchParams.get('provider');

    if (error) {
      router.replace(`/login?error=${error}`);
      return;
    }

    if (token) {
      Cookies.set('accessToken', token, {
        expires: 1 / 96,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      if (refreshToken) {
        Cookies.set('refreshToken', refreshToken, {
          expires: 7,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
      }
      useAuthStore
        .getState()
        .fetchMe()
        .then(() => {
          const userId = useAuthStore.getState().user?.id;
          if (provider === 'google') {
            trackGoogleLogin({ userId });
          } else {
            trackLogin({ method: 'facebook', userId });
          }
          router.replace('/dashboard');
        })
        .catch(() => {
          router.replace('/login?error=Authentication+failed');
        });
    } else {
      router.replace('/login');
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OAuthSuccessInner />
    </Suspense>
  );
}
