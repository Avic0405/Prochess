'use client';

import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';
import { InviteToast } from '@/components/chess/InviteToast';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useAuthStore.persist.rehydrate();

    const hasToken = Cookies.get('accessToken') || Cookies.get('refreshToken');
    if (hasToken) {
      // fetchMe triggers axios interceptor which auto-refreshes on 401 —
      // so a valid refreshToken is enough to restore the session.
      useAuthStore.getState().fetchMe().finally(() => {
        useAuthStore.getState().setHydrated(true);
      });
    } else {
      useAuthStore.getState().setHydrated(true);
    }
  }, []);

  return (
    <>
      {children}
      <InviteToast />
    </>
  );
}
