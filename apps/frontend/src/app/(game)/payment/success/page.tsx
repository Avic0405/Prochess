'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['wallets'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
    queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['my-stats'] });
  }, [queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-card border rounded-2xl p-10 max-w-md w-full text-center space-y-6 shadow-xl">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
        <div>
          <h1 className="text-3xl font-bold text-green-500">Payment Successful!</h1>
          <p className="text-muted-foreground mt-2">
            Your funds have been added to your wallet.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/lobby">Find a Match</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/wallet">View Wallet</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
