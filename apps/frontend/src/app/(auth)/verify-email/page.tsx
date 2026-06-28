'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type Status = 'loading' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Verification token missing.'); return; }

    api.get(`/auth/verify/${token}`)
      .then((res) => { setStatus('success'); setMessage(res.data.message); })
      .catch((err) => { setStatus('error'); setMessage(err?.response?.data?.message ?? 'Verification failed.'); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-card border rounded-2xl p-10 max-w-md w-full text-center space-y-6 shadow-xl">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <p className="text-lg font-medium">Verifying your email...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-green-500">Email Verified!</h1>
              <p className="text-muted-foreground mt-2">{message}</p>
            </div>
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <div>
              <h1 className="text-2xl font-bold text-destructive">Verification Failed</h1>
              <p className="text-muted-foreground mt-2">{message}</p>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/register">Back to Register</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
