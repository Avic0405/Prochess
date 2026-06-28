'use client';

import { useEffect } from 'react';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';
import { InviteToast } from '@/components/chess/InviteToast';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (Cookies.get('accessToken')) {
      useAuthStore.getState().fetchMe();
    }
  }, []);

  return (
    <>
      {children}
      <InviteToast />
    </>
  );
}
