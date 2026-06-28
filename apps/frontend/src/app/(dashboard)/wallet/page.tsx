'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Wallet, ArrowDownLeft, ArrowUpRight, Lock, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  GAME_STAKE: 'Game Stake (Escrow)',
  GAME_WIN: 'Game Winnings',
  GAME_REFUND: 'Draw Refund',
  COMMISSION: 'Platform Fee',
};

const TYPE_SIGN: Record<string, 'credit' | 'debit' | 'neutral'> = {
  DEPOSIT: 'credit',
  WITHDRAWAL: 'debit',
  GAME_STAKE: 'debit',
  GAME_WIN: 'credit',
  GAME_REFUND: 'credit',
  COMMISSION: 'debit',
};

export default function WalletPage() {
  const { user } = useAuthStore();
  const currency = (user?.region ?? 'USD') as 'USD' | 'INR';

  const { data: balance, isLoading: balanceLoading } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get('/wallet/balance').then((r) => r.data),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions'],
    queryFn: () => api.get('/wallet/transactions?limit=30').then((r) => r.data),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      <h1 className="text-2xl font-bold flex items-center gap-3">
        <Wallet className="w-6 h-6 text-primary" /> My Wallet
      </h1>

      {/* Balance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 rounded-2xl p-6">
          <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
          {balanceLoading ? (
            <div className="h-9 w-32 bg-muted rounded animate-pulse" />
          ) : (
            <p className="text-3xl sm:text-4xl font-bold">
              {formatCurrency(balance?.balance ?? 0, balance?.currency ?? currency)}
            </p>
          )}
        </div>

        <div className="bg-card border rounded-2xl p-6">
          <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> In Escrow
          </p>
          {balanceLoading ? (
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
          ) : (
            <p className="text-3xl sm:text-4xl font-bold text-muted-foreground">
              {formatCurrency(balance?.lockedBalance ?? 0, balance?.currency ?? currency)}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Locked in active games</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button asChild className="gap-2">
          <Link href="/payment">
            <ArrowDownLeft className="w-4 h-4" /> Deposit
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/wallet/withdraw">
            <ArrowUpRight className="w-4 h-4" /> Withdraw
          </Link>
        </Button>
      </div>

      {/* Transaction history */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold">Transaction History</h2>
        </div>

        {txLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : !txData?.transactions?.length ? (
          <div className="p-8 text-center text-muted-foreground">No transactions yet</div>
        ) : (
          <div className="divide-y">
            {txData.transactions.map((tx: any) => {
              const sign = TYPE_SIGN[tx.type] ?? 'neutral';
              const label = TYPE_LABELS[tx.type] ?? tx.type;

              return (
                <div key={tx.id} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      sign === 'credit' && 'bg-green-500/10',
                      sign === 'debit' && 'bg-destructive/10',
                      sign === 'neutral' && 'bg-muted',
                    )}>
                      {sign === 'credit'
                        ? <ArrowDownLeft className="w-5 h-5 text-green-500" />
                        : <ArrowUpRight className={cn('w-5 h-5', sign === 'debit' ? 'text-destructive' : 'text-muted-foreground')} />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString('en', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={cn(
                      'font-semibold',
                      sign === 'credit' && 'text-green-500',
                      sign === 'debit' && 'text-destructive',
                    )}>
                      {sign === 'credit' ? '+' : sign === 'debit' ? '-' : ''}
                      {formatCurrency(tx.amount, tx.currency ?? currency)}
                    </p>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      tx.status === 'COMPLETED' && 'bg-green-500/10 text-green-500',
                      tx.status === 'PENDING' && 'bg-yellow-500/10 text-yellow-500',
                      tx.status === 'FAILED' && 'bg-destructive/10 text-destructive',
                    )}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
